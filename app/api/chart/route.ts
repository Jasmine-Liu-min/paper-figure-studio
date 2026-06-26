import { NextResponse } from "next/server";
import { generateChartCode, isChartType, ChartLibrary } from "@/lib/chart/chartGenerator";
import { reviewChartCode } from "@/lib/chart/chartCritic";
import { saveChartProject } from "@/lib/infra/storage";
import { clientKey, rateLimit } from "@/lib/infra/rateLimit";

export async function POST(request: Request) {
  const limit = rateLimit(`chart:${clientKey(request)}`);
  if (!limit.ok) {
    return NextResponse.json({ error: `请求过于频繁，请 ${limit.retryAfter}s 后重试。` }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    data?: string;
    chartType?: string;
    library?: string;
    title?: string;
    xLabel?: string;
    yLabel?: string;
    palette?: string;
    notes?: string;
  };

  const data = (body.data ?? "").trim();
  if (!data) {
    return NextResponse.json({ error: "请粘贴数据或描述要画的图表内容。" }, { status: 422 });
  }

  const library: ChartLibrary = body.library === "ggplot2" ? "ggplot2" : "seaborn";
  const chartType = body.chartType && isChartType(body.chartType) ? body.chartType : "bar";

  const input = {
    data,
    chartType,
    library,
    title: body.title?.trim() || undefined,
    xLabel: body.xLabel?.trim() || undefined,
    yLabel: body.yLabel?.trim() || undefined,
    palette: body.palette?.trim() || undefined,
    notes: body.notes?.trim() || undefined
  };

  const result = await generateChartCode(input);
  const critic = reviewChartCode({ chartType, library, code: result.code, data });
  const stored = await saveChartProject({
    name: body.title?.trim() || `${chartType} chart`,
    input: {
      data,
      chartType,
      library,
      title: body.title?.trim() || "",
      xLabel: body.xLabel?.trim() || "",
      yLabel: body.yLabel?.trim() || "",
      palette: body.palette?.trim() || "paper-pro",
      notes: body.notes?.trim() || ""
    },
    result,
    critic
  });

  return NextResponse.json({ ...result, critic, projectId: stored.id, savedAt: stored.updatedAt });
}
