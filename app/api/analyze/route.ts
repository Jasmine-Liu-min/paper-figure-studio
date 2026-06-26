import { NextResponse } from "next/server";
import { analyzePaper } from "@/lib/figure/paperAnalyzer";
import { parsePaperFile } from "@/lib/parsers/mineru";
import { saveAnalysis } from "@/lib/infra/storage";
import { clampTextWithFlag } from "@/lib/utils";
import { clientKey, rateLimit } from "@/lib/infra/rateLimit";
import { AspectRatio, FigureType } from "@/lib/types";

const figureTypes = new Set(["method-framework", "experiment-flow", "graphical-abstract", "mechanism", "comparison", "timeline", "neural-network", "data-pipeline"]);
const aspectRatios = new Set(["1:1", "4:3", "16:9", "3:2"]);

export async function POST(request: Request) {
  const limit = rateLimit(`analyze:${clientKey(request)}`);
  if (!limit.ok) {
    return NextResponse.json({ error: `请求过于频繁，请 ${limit.retryAfter}s 后重试。` }, { status: 429 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  const formData = contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded") ? await request.formData() : null;
  const jsonData = formData ? null : await request.json().catch(() => ({}));
  const readField = (key: string) => formData?.get(key)?.toString() ?? (typeof jsonData?.[key] === "string" ? jsonData[key] : "");
  const file = formData?.get("file");
  const figureTypeValue = readField("figureType");
  const aspectRatioValue = readField("aspectRatio");
  const parsed = {
    text: readField("text"),
    field: readField("field") || "人工智能",
    figureType: (figureTypes.has(figureTypeValue) ? figureTypeValue : "method-framework") as FigureType,
    purpose: readField("purpose") || "论文投稿",
    aspectRatio: (aspectRatios.has(aspectRatioValue) ? aspectRatioValue : "16:9") as AspectRatio,
    palette: readField("palette") || "journal balanced",
    style: readField("style") || "clean vector academic style"
  };

  const pasted = clampTextWithFlag(parsed.text);
  let parserMessage = pasted.truncated ? "已分析粘贴文本（论文较长，仅分析了前一部分内容）。" : "Text input analyzed locally.";
  let parserStatus: "text" | "mineru" | "fallback" | "failed" = "text";
  let text = pasted.text;
  let fileName: string | undefined;

  if (file instanceof File && file.size > 0) {
    fileName = file.name;
    const parsedFile = await parsePaperFile(file);
    parserMessage = parsedFile.message;
    parserStatus = parsedFile.status;
    if (parsedFile.text) text = parsedFile.text;
  }

  if (!text) {
    return NextResponse.json(
      {
        error: parserMessage || "No paper text available. Paste paper abstract or configure the PDF parser."
      },
      { status: 422 }
    );
  }

  const result = await analyzePaper({ ...parsed, text, fileName }, parserMessage);
  result.parser.status = parserStatus;
  await saveAnalysis(result);
  return NextResponse.json(result);
}
