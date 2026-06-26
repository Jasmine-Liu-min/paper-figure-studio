import { AnalysisResult, FigurePlan, PaperInput, PaperSection, PaperStructure } from "../types";
import { hashId } from "../utils";
import { buildMermaid, renderFigureSvg } from "./figureRenderer";
import { normalizeLlmPlan, planWithLlm } from "../providers/llmProviders";
import { selectReferences } from "./referenceGallery";
import { buildFigureSpec, captionFromSpec, criticReview, promptFromSpec, specModules, specRelationships } from "./figureSpec";

const stopWords = new Set([
  "the",
  "and",
  "with",
  "from",
  "that",
  "this",
  "using",
  "based",
  "通过",
  "研究",
  "方法",
  "模型",
  "实验",
  "结果",
  "本文",
  "一种"
]);

export async function analyzePaper(input: PaperInput, parserMessage = "Text input analyzed locally"): Promise<AnalysisResult> {
  const fallbackStructure = extractStructure(input.text, input.field);
  const llmResult = await planWithLlm(input, fallbackStructure);
  const structure = llmResult.ok && llmResult.structure ? llmResult.structure : fallbackStructure;
  const references = selectReferences(input.figureType, input.field, structure.keywords, input.text);
  const rawPlans = llmResult.ok
    ? llmResult.plans.map((plan, index) => {
        const normalized = normalizeLlmPlan(plan, index);
        const spec = buildFigureSpec(input, structure, references, normalized.name, normalized.modules, normalized.layout, index);
        if (normalized.diagram) spec.architecture = normalized.diagram;
        const modules = specModules(spec);
        const relationships = specRelationships(spec);
        const critic = criticReview(spec, references, input);
        return {
          ...normalized,
          score: critic.total,
          template: input.figureType,
          modules,
          relationships,
          visualNotes: normalized.visualNotes?.length ? normalized.visualNotes : visualNotesFor(input.figureType),
          caption: captionFromSpec(spec, structure),
          prompt: promptFromSpec(spec, references, input),
          mermaid: buildMermaid(modules, index, input.figureType),
          svg: renderFigureSvg(normalized.name, modules, input.palette, input.aspectRatio, index, input.figureType, spec),
          spec,
          references,
          critic,
          iterations: []
        };
      })
    : buildFigurePlans(input, structure, references);
  const plans = rawPlans
    .map((plan) => ({ ...plan, score: scorePlan(plan, input) }))
    .sort((a, b) => b.score - a.score);

  return {
    projectId: hashId("project"),
    createdAt: new Date().toISOString(),
    input,
    structure,
    plans,
    selectedPlanId: plans[0]?.id ?? "",
    parser: {
      status: input.fileName?.toLowerCase().endsWith(".pdf") ? "fallback" : "text",
      message: parserMessage
    },
    planner: {
      status: llmResult.ok ? "llm" : "fallback",
      provider: llmResult.provider,
      message: llmResult.message
    }
  };
}

function extractStructure(text: string, field: string): PaperStructure {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.length > 8 && line.length < 120) ?? `${field || "Research"} figure project`;
  const abstract = pickSection(text, ["abstract", "摘要"], 850) || lines.slice(0, 5).join(" ");
  const methodsText = pickSection(text, ["method", "methods", "方法", "approach"], 1200) || text.slice(0, 1300);
  const resultsText = pickSection(text, ["result", "results", "结果", "evaluation"], 900) || text.slice(-1000);

  return {
    title,
    abstract,
    methods: splitIntoSections(methodsText, "Method"),
    results: splitIntoSections(resultsText, "Finding"),
    keywords: extractKeywords(text, field),
    limitations: inferLimitations(text)
  };
}

function pickSection(text: string, markers: string[], max: number) {
  const lower = text.toLowerCase();
  const index = markers.map((marker) => lower.indexOf(marker.toLowerCase())).find((pos) => pos >= 0);
  if (index === undefined) return "";
  return text.slice(index, index + max).replace(/\s+/g, " ").trim();
}

function splitIntoSections(value: string, fallbackPrefix: string): PaperSection[] {
  const sentences = value.split(/[。.!?；;]\s*/).map((item) => item.trim()).filter(Boolean);
  const chunks = sentences.slice(0, 6);
  return chunks.length
    ? chunks.map((content, index) => ({ title: `${fallbackPrefix} ${index + 1}`, content }))
    : [{ title: `${fallbackPrefix} 1`, content: value.slice(0, 260) }];
}

function extractKeywords(text: string, field: string) {
  const words = text
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word.toLowerCase()));
  const ranked = new Map<string, number>();
  for (const word of words) ranked.set(word, (ranked.get(word) ?? 0) + 1);
  const keywords = [...ranked.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([word]) => word);
  return Array.from(new Set([field, ...keywords].filter(Boolean))).slice(0, 9);
}

function inferLimitations(text: string) {
  const hints = ["small sample", "limited", "future work", "局限", "不足", "未来"];
  const found = hints.filter((hint) => text.toLowerCase().includes(hint.toLowerCase()));
  return found.length ? found.map((hint) => `Mentions ${hint}`) : ["Requires human verification before publication"];
}

function buildFigurePlans(input: PaperInput, structure: PaperStructure, references = selectReferences(input.figureType, input.field, structure.keywords, input.text)): FigurePlan[] {
  const moduleNames = deriveModules(input, structure);
  const relationships = moduleNames.slice(0, -1).map((module, index) => `${module} -> ${moduleNames[index + 1]}`);
  const variants = variantsFor(input.figureType);

  return variants.map((variant, index) => {
    const spec = buildFigureSpec(input, structure, references, variant.name, moduleNames, variant.layout, index);
    const specModuleNames = specModules(spec);
    const specRelationshipNames = specRelationships(spec);
    const critic = criticReview(spec, references, input);
    const prompt = promptFromSpec(spec, references, input);
    return {
      id: hashId("plan"),
      name: variant.name,
      score: critic.total,
      rationale: variant.rationale,
      layout: variant.layout,
      caption: captionFromSpec(spec, structure),
      modules: specModuleNames,
      relationships: specRelationshipNames.length ? specRelationshipNames : relationships,
      template: input.figureType,
      visualNotes: visualNotesFor(input.figureType),
      prompt,
      negativePrompt:
        "low resolution, blurry text, fake data labels, crowded layout, decorative stock photo, illegible annotations, watermark",
      mermaid: buildMermaid(specModuleNames, index, input.figureType),
      svg: renderFigureSvg(variant.name, specModuleNames, input.palette, input.aspectRatio, index, input.figureType, spec),
      spec,
      references,
      critic,
      iterations: []
    };
  });
}

function deriveModules(input: PaperInput, structure: PaperStructure) {
  const keyword = titleCase(structure.keywords.find((item) => item !== input.field) || input.field || "Domain Context");
  const method = compactLabel(structure.methods[0]?.content || "Core Method");
  const result = compactLabel(structure.results[0]?.content || "Evidence");
  const purpose = compactLabel(input.purpose || "Publication Output");
  const maps: Record<string, string[]> = {
    "method-framework": ["Research Gap", "Input Data", "Preprocessing", method, result, purpose],
    "experiment-flow": ["Sample / Dataset", "Protocol Setup", "Intervention", "Measurement", "Statistical Analysis", "Validation"],
    "graphical-abstract": ["Research Problem", keyword, method, result, "Key Contribution"],
    mechanism: ["Trigger / Condition", "Core Pathway", "Mediator", "State Change", "Observed Outcome"],
    comparison: ["Research Problem", "Baseline Method", "Proposed Method", result, "Practical Gain"],
    timeline: ["Question", "Data Collection", method, "Experiment", result, "Next Step"],
    "neural-network": ["Input Data", "Encoder", "Representation Fusion", "Prediction Head", "Loss / Objective", result],
    "data-pipeline": ["Raw Data", "Cleaning", "Feature Extraction", "Quality Control", "Analysis", result]
  };
  return Array.from(new Set(maps[input.figureType] ?? maps["method-framework"])).slice(0, 7);
}

function compactLabel(value: string) {
  return titleCase(
    value
      .replace(/摘要|方法|结果|本文|研究|实验/g, "")
      .split(/[，,。.;；]/)[0]
      .trim()
      .slice(0, 36) || value.slice(0, 24)
  );
}

function variantsFor(figureType: PaperInput["figureType"]) {
  const variants = {
    "method-framework": [
      ["Layered Method Framework", "pipeline with input evidence, processing modules, validation lane", "Best for explaining the full method architecture."],
      ["System Architecture Overview", "stacked architecture with data, model, evaluation, and output layers", "Best for technical method sections."],
      ["Reviewer-Oriented Method Story", "left-to-right research narrative with evidence callouts", "Best for making the contribution easy to review."]
    ],
    "experiment-flow": [
      ["Experimental Protocol Flow", "vertical protocol timeline with controls and readout lane", "Best for methods and experimental design."],
      ["Assay and Measurement Workflow", "sample preparation, intervention, measurement, analysis, validation", "Best for wet-lab or evaluation pipelines."],
      ["Reproducibility Checklist Figure", "stepwise protocol with inputs, controls, outputs, and checkpoints", "Best for reproducibility-focused papers."]
    ],
    "graphical-abstract": [
      ["Graphical Abstract Hub", "central contribution with surrounding problem, data, method, evidence, impact", "Best for visual abstracts and posters."],
      ["Contribution-Centered Summary", "hub-and-spoke layout emphasizing the novelty", "Best for conference first-page visuals."],
      ["Problem-to-Impact Snapshot", "compact high-level summary from challenge to impact", "Best for broad audiences."]
    ],
    mechanism: [
      ["Mechanistic Pathway Diagram", "trigger, pathway, mediator, state change, outcome with feedback", "Best for biological or causal mechanisms."],
      ["Causal Mechanism Model", "directed causal chain with feedback regulation", "Best for explaining why the method works."],
      ["Process Mechanism Summary", "multi-node mechanism with intermediate state and readout", "Best for discussion sections."]
    ],
    comparison: [
      ["Baseline vs Proposed Comparison", "two-column comparison with shared evidence and conclusion", "Best for method comparison figures."],
      ["Ablation and Gain Summary", "side-by-side baseline/proposed with readout strip", "Best for evaluation sections."],
      ["Competitive Advantage Panel", "contrastive layout showing where the proposed method improves", "Best for reviewer persuasion."]
    ],
    timeline: [
      ["Research Timeline", "milestone sequence across research phases", "Best for project plans and process overviews."],
      ["Study Milestone Map", "alternating milestone cards on a horizontal time axis", "Best for grant or thesis planning."],
      ["Experiment Schedule Figure", "ordered phases from question to publication output", "Best for protocol schedules."]
    ],
    "neural-network": [
      ["Neural Architecture Overview", "input, encoder, fusion, prediction head, loss, and evaluation lane", "Best for model architecture figures."],
      ["Model Block Diagram", "layered neural network blocks with evidence and output panels", "Best for AI methods sections."],
      ["Representation Learning Pipeline", "data-to-representation-to-output workflow with validation", "Best for multimodal AI papers."]
    ],
    "data-pipeline": [
      ["Data Processing Pipeline", "raw data, cleaning, transformation, quality control, analysis, output", "Best for data-centric papers."],
      ["Dataset-to-Evidence Workflow", "swimlane showing curation, features, model, evidence, and final artifact", "Best for reproducibility."],
      ["Quality-Control Pipeline", "processing stages with checkpoints and supported outputs", "Best for methods appendices."]
    ]
  } satisfies Record<PaperInput["figureType"], string[][]>;
  return variants[figureType].map(([name, layout, rationale]) => ({ name, layout, rationale }));
}

function visualNotesFor(figureType: PaperInput["figureType"]) {
  const notes = {
    "method-framework": ["Use a clear left-to-right pipeline.", "Separate input evidence from validation evidence.", "Keep every module label action-oriented."],
    "experiment-flow": ["Use numbered protocol steps.", "Reserve a side lane for controls/readouts.", "Avoid decorative arrows that obscure reproducibility."],
    "graphical-abstract": ["Place the contribution at the center.", "Use surrounding panels for problem, data, method, evidence, and impact.", "Keep text short enough for poster use."],
    mechanism: ["Show causal direction explicitly.", "Use feedback/regulation only when supported by the text.", "Distinguish trigger, mediator, state change, and outcome."],
    comparison: ["Keep baseline and proposed method symmetric.", "Use a shared evidence/conclusion strip.", "Avoid claiming numeric gains unless present in the paper."],
    timeline: ["Use phase ordering instead of causal arrows.", "Keep each milestone short.", "Use alternating labels to avoid crowding."],
    "neural-network": ["Only include layers mentioned in the text.", "Show input-output dimensionality only when supplied.", "Separate architecture from evaluation claims."],
    "data-pipeline": ["Make data provenance explicit.", "Use quality-control checkpoints conservatively.", "Do not invent hidden data sources."]
  };
  return notes[figureType];
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
    .join(" ");
}

function scorePlan(plan: FigurePlan, input: PaperInput) {
  if (plan.critic) return plan.critic.total;
  if (plan.score >= 0 && plan.score <= 100 && !Number.isNaN(plan.score)) return plan.score;
  let score = 78;
  if (plan.modules.length >= 5) score += 5;
  if (plan.prompt.includes(input.field)) score += 4;
  if (input.figureType === "graphical-abstract" && plan.name.includes("Abstract")) score += 9;
  if (input.figureType === "experiment-flow" && plan.layout.includes("pipeline")) score += 7;
  if (input.purpose.length > 3) score += 3;
  return Math.min(score, 98);
}
