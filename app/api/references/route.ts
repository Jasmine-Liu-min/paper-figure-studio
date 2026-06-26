import { NextResponse } from "next/server";
import { referenceGallery, selectReferences } from "@/lib/figure/referenceGallery";
import { FigureType } from "@/lib/types";

const figureTypes = new Set(["method-framework", "experiment-flow", "graphical-abstract", "mechanism", "comparison", "timeline", "neural-network", "data-pipeline"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const figureTypeValue = url.searchParams.get("figureType") || "method-framework";
  const figureType = (figureTypes.has(figureTypeValue) ? figureTypeValue : "method-framework") as FigureType;
  const field = url.searchParams.get("field") || "";
  const keywords = (url.searchParams.get("keywords") || "").split(",").map((item) => item.trim()).filter(Boolean);
  const text = url.searchParams.get("text") || "";
  return NextResponse.json({
    references: field || keywords.length || text ? selectReferences(figureType, field, keywords, text) : referenceGallery.filter((item) => item.figureType === figureType).slice(0, 3)
  });
}
