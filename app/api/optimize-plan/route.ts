import { NextResponse } from "next/server";
import { buildMermaid, renderFigureSvg } from "@/lib/figure/figureRenderer";
import { captionFromSpec, optimizePlan, promptFromSpec, specModules, specRelationships } from "@/lib/figure/figureSpec";
import { FigurePlan, PaperInput, PaperStructure } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    plan?: FigurePlan;
    input?: PaperInput;
    structure?: PaperStructure;
    editedModules?: string[];
    aspectRatio?: string;
    palette?: string;
  };

  if (!body.plan?.spec || !body.input || !body.structure) {
    return NextResponse.json({ error: "plan.spec, input and structure are required." }, { status: 422 });
  }

  const editedModules = Array.isArray(body.editedModules) ? body.editedModules.filter(Boolean) : [];
  const plan: FigurePlan = editedModules.length
    ? {
        ...body.plan,
        spec: {
          ...body.plan.spec,
          objects: body.plan.spec.objects.map((object, index) => ({
            ...object,
            label: editedModules[index] || object.label
          }))
        }
      }
    : body.plan;
  const optimized = optimizePlan(plan, body.input);
  if (!optimized.spec) return NextResponse.json({ error: "optimized spec is missing." }, { status: 500 });

  const modules = specModules(optimized.spec);
  const references = optimized.references ?? [];
  const nextPlan: FigurePlan = {
    ...optimized,
    modules,
    relationships: specRelationships(optimized.spec),
    caption: captionFromSpec(optimized.spec, body.structure),
    prompt: promptFromSpec(optimized.spec, references, body.input),
    mermaid: buildMermaid(modules, 0, optimized.spec.figureType),
    svg: renderFigureSvg(
      optimized.name,
      modules,
      body.palette || body.input.palette,
      body.aspectRatio || body.input.aspectRatio,
      0,
      optimized.spec.figureType,
      optimized.spec
    )
  };

  return NextResponse.json({ plan: nextPlan });
}
