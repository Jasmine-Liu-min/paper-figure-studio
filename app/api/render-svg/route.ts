import { NextResponse } from "next/server";
import { buildMermaid, renderFigureSvg } from "@/lib/figure/figureRenderer";
import { FigureSpec, FigureType } from "@/lib/types";
import { specModules } from "@/lib/figure/figureSpec";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    name?: string;
    modules?: string[];
    palette?: string;
    aspectRatio?: string;
    variant?: number;
    figureType?: FigureType;
    spec?: FigureSpec;
  };
  const modules = body.spec ? specModules(body.spec) : Array.isArray(body.modules) ? body.modules.filter(Boolean).slice(0, 8) : [];
  if (!modules.length) {
    return NextResponse.json({ error: "modules are required." }, { status: 422 });
  }
  const variant = Number.isFinite(body.variant) ? Number(body.variant) : 0;
  const figureType = body.spec?.figureType ?? body.figureType;
  return NextResponse.json({
    svg: renderFigureSvg(body.name || body.spec?.title || "Edited Figure", modules, body.palette || "journal balanced", body.aspectRatio || "16:9", variant, figureType, body.spec),
    mermaid: buildMermaid(modules, variant, figureType)
  });
}
