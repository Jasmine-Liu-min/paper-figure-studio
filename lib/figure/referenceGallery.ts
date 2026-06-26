import { FigureType, ReferenceFigure } from "../types";

export const referenceGallery: ReferenceFigure[] = [
  {
    id: "ref-method-layered",
    title: "Layered Method Architecture",
    figureType: "method-framework",
    fieldTags: ["ai", "science", "method", "framework", "model"],
    useCase: "Show how research problem, data, method, validation, and contribution connect.",
    layoutPattern: "Left-to-right pipeline with an evidence lane and a contribution lane.",
    visualLanguage: "Vector cards, compact labels, one strong arrow direction, restrained accent colors.",
    components: ["Research gap", "Input evidence", "Preprocessing", "Core model", "Validation", "Contribution"],
    promptHints: ["journal-ready vector schematic", "clear method architecture", "evidence lane below the main pipeline"],
    criticChecklist: ["Every method block must map to paper text.", "Validation should not claim numbers unless supplied.", "Labels should stay under six words."]
  },
  {
    id: "ref-experiment-protocol",
    title: "Experimental Protocol With Controls",
    figureType: "experiment-flow",
    fieldTags: ["experiment", "protocol", "biology", "evaluation", "assay"],
    useCase: "Explain reproducible experimental steps and their controls/readouts.",
    layoutPattern: "Numbered vertical protocol with side lanes for controls and measured outcomes.",
    visualLanguage: "Step badges, sample/readout icons, clear separation between action and evidence.",
    components: ["Sample", "Preparation", "Intervention", "Measurement", "Analysis", "Controls"],
    promptHints: ["numbered scientific protocol", "controls and readouts lane", "reproducible workflow diagram"],
    criticChecklist: ["Controls/readouts must be named only if present.", "Do not mix causal mechanism with protocol order.", "Avoid long paragraph labels."]
  },
  {
    id: "ref-graphical-abstract",
    title: "Problem-to-Impact Graphical Abstract",
    figureType: "graphical-abstract",
    fieldTags: ["abstract", "summary", "poster", "overview", "impact"],
    useCase: "Summarize the paper for a broad reader without losing the evidence chain.",
    layoutPattern: "Central contribution surrounded by problem, data, method, evidence, and impact.",
    visualLanguage: "Hub-and-spoke or staged arc, minimal text, one visual metaphor grounded in the field.",
    components: ["Problem", "Data", "Method", "Evidence", "Contribution", "Impact"],
    promptHints: ["graphical abstract", "central contribution", "problem to impact story"],
    criticChecklist: ["Impact must be phrased conservatively.", "The central claim needs supporting evidence.", "Avoid stock-photo style decoration."]
  },
  {
    id: "ref-mechanism-causal",
    title: "Mechanism and Causal Pathway",
    figureType: "mechanism",
    fieldTags: ["mechanism", "causal", "biology", "chemistry", "pathway"],
    useCase: "Show a supported mechanism from trigger to outcome with optional feedback.",
    layoutPattern: "Directed pathway with mediator/state nodes and explicit feedback only when supported.",
    visualLanguage: "Pathway nodes, molecule/cell glyphs, causal arrows, dashed uncertain feedback.",
    components: ["Trigger", "Pathway", "Mediator", "State change", "Outcome", "Feedback"],
    promptHints: ["mechanistic pathway diagram", "causal arrows", "dashed feedback if uncertain"],
    criticChecklist: ["Do not infer biological pathways absent from text.", "Mark uncertain links as tentative.", "Separate observation from mechanism."]
  },
  {
    id: "ref-comparison-two-column",
    title: "Baseline vs Proposed Comparison",
    figureType: "comparison",
    fieldTags: ["comparison", "baseline", "ablation", "evaluation", "benchmark"],
    useCase: "Compare baseline and proposed approach with the same evidence criteria.",
    layoutPattern: "Symmetric two-column layout with a shared evaluation strip and conclusion.",
    visualLanguage: "Balanced columns, matched card counts, neutral baseline, highlighted proposed method.",
    components: ["Problem", "Baseline", "Proposed method", "Shared metric", "Evidence", "Conclusion"],
    promptHints: ["two-column comparison", "shared evaluation criteria", "balanced baseline and proposed method"],
    criticChecklist: ["Do not exaggerate superiority without results.", "Use identical criteria in both columns.", "Keep conclusion tied to evidence."]
  },
  {
    id: "ref-timeline-study",
    title: "Study Timeline and Milestones",
    figureType: "timeline",
    fieldTags: ["timeline", "study", "planning", "milestone", "schedule"],
    useCase: "Show research phases, study visits, or project milestones.",
    layoutPattern: "Horizontal milestone axis with alternating concise phase cards.",
    visualLanguage: "Small numbered nodes, phase bands, time axis, restrained annotations.",
    components: ["Question", "Collection", "Method", "Experiment", "Result", "Next step"],
    promptHints: ["research timeline", "milestone map", "phase bands"],
    criticChecklist: ["Timeline should not imply causality.", "Dates should not be invented.", "Milestones should be short."]
  },
  {
    id: "ref-neural-architecture",
    title: "Neural Network Architecture",
    figureType: "neural-network",
    fieldTags: ["neural", "network", "deep learning", "transformer", "cnn", "ai"],
    useCase: "Explain model inputs, representation blocks, fusion, prediction heads, and losses.",
    layoutPattern: "Layered blocks from inputs to encoder/fusion/head with optional loss/evaluation lane.",
    visualLanguage: "Stacked tensors, block groups, skip arrows, compact model labels.",
    components: ["Inputs", "Encoder", "Fusion", "Prediction head", "Loss", "Evaluation"],
    promptHints: ["neural network architecture figure", "tensor blocks", "model pipeline"],
    criticChecklist: ["Do not invent layers not mentioned.", "Loss/metrics require textual evidence.", "Avoid unreadable tensor labels."]
  },
  {
    id: "ref-data-pipeline",
    title: "Data Processing Pipeline",
    figureType: "data-pipeline",
    fieldTags: ["data", "pipeline", "preprocessing", "dataset", "workflow"],
    useCase: "Show how raw data becomes curated features, analysis, and outputs.",
    layoutPattern: "Swimlane pipeline with raw data, cleaning, transformation, analysis, and output.",
    visualLanguage: "Dataset cylinders, process cards, quality-control checkpoints, output panels.",
    components: ["Raw data", "Cleaning", "Transformation", "Quality control", "Analysis", "Output"],
    promptHints: ["data processing pipeline", "quality control checkpoints", "swimlane workflow"],
    criticChecklist: ["Data transformations must match text.", "Do not imply hidden data sources.", "QC criteria should be conservative."]
  }
];

export function selectReferences(figureType: FigureType, field: string, keywords: string[], text: string, count = 3) {
  const haystack = `${field} ${keywords.join(" ")} ${text.slice(0, 1600)}`.toLowerCase();
  return referenceGallery
    .map((reference) => {
      let score = reference.figureType === figureType ? 12 : 0;
      for (const tag of reference.fieldTags) if (haystack.includes(tag.toLowerCase())) score += 3;
      for (const component of reference.components) if (haystack.includes(component.toLowerCase())) score += 1;
      if (figureType === "method-framework" && reference.figureType === "data-pipeline") score += 2;
      if (figureType === "graphical-abstract" && reference.figureType === "method-framework") score += 2;
      return { reference, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((item) => item.reference);
}
