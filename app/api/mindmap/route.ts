import { NextResponse } from "next/server";
import { generateMindmap } from "@/lib/mindmap/mindmapGenerator";
import { parsePaperFile } from "@/lib/parsers/mineru";
import { clampTextWithFlag } from "@/lib/utils";
import { clientKey, rateLimit } from "@/lib/infra/rateLimit";
import { MindmapResult } from "@/lib/types";

export async function POST(request: Request) {
  const limit = rateLimit(`mindmap:${clientKey(request)}`);
  if (!limit.ok) {
    return NextResponse.json({ error: `请求过于频繁，请 ${limit.retryAfter}s 后重试。` }, { status: 429 });
  }
  const formData = await request.formData();
  const file = formData.get("file");
  const pasted = clampTextWithFlag(formData.get("text")?.toString() ?? "");
  let text = pasted.text;
  let sourceName: string | undefined;
  let parser: MindmapResult["parser"] = {
    status: "text" as const,
    message: pasted.truncated ? "已分析粘贴文本（论文较长，仅分析了前一部分内容）。" : "Text input analyzed locally."
  };

  if (file instanceof File && file.size > 0) {
    sourceName = file.name;
    const parsedFile = await parsePaperFile(file);
    parser = {
      status: parsedFile.status,
      message: parsedFile.message
    };
    if (parsedFile.text) text = parsedFile.text;
  }

  if (!text) {
    return NextResponse.json(
      {
        error: parser.message || "No paper text available. Upload a parseable PDF/TXT/Markdown file or paste text."
      },
      { status: 422 }
    );
  }

  const result = await generateMindmap(text, sourceName, parser);
  return NextResponse.json(result);
}
