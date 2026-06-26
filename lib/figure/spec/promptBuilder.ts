import { PaperInput, PaperStructure, FigureObject, FigureSpec, ReferenceFigure } from "../../types";
import { palettePromptText } from "../../palettes";
import { architecturePromptLines } from "./architectureBuilder";

export function promptFromSpec(spec: FigureSpec, references: ReferenceFigure[], input: PaperInput) {
  const grouped = groupedObjectsForPrompt(spec);
  const evidence = spec.evidenceMapping.slice(0, 8);
  const supported = evidence.filter((mapping) => mapping.risk === "low").map((mapping) => mapping.claim);
  const tentative = evidence.filter((mapping) => mapping.risk !== "low").map((mapping) => mapping.claim);
  const typeGuide = figureTypePromptGuide(spec.figureType);
  const referenceCues = references
    .flatMap((reference) => [reference.layoutPattern, reference.visualLanguage, ...reference.promptHints])
    .filter(Boolean)
    .slice(0, 7);
  const architecturePrompt = spec.architecture ? architecturePromptLines(spec.architecture) : [];

  return [
    "IMAGE GENERATION PROMPT FOR A SCIENTIFIC PAPER FIGURE",
    "",
    "Global description:",
    `Create a cautious, publication-ready ${typeGuide.name} for ${input.field || "a research paper"} in a ${input.aspectRatio} canvas. Use a white or near-white background, flat vector-like academic graphics, and a single dominant reading direction: ${typeGuide.readingDirection}. Do not place the figure caption or a decorative title inside the image.`,
    `Scientific message: ${trimPromptSentence(spec.thesis, 320)}.`,
    `Quality target: ${input.purpose || "journal manuscript / academic presentation"}. The image must look like a formal research schematic, not a marketing poster, stock illustration, dashboard mockup, or generic flowchart.`,
    "",
    "Panel-by-panel layout:",
    ...architecturePrompt,
    ...spec.panels.slice(0, 6).map((panel, index) => {
      const objects = grouped.get(panel.id) ?? [];
      const objectText = objects.length
        ? objects.map((object) => `"${object.label}" as a ${object.kind} component`).join("; ")
        : "keep this region visually quiet with no invented components";
      return `${index + 1}. ${panel.title}: ${panel.summary} Place this as ${typeGuide.panelPlacement[index] ?? "a clearly separated region"} with a very light tinted background, 1.5pt border, 8px rounded corners, and at least 16px gutter from adjacent regions. Include: ${objectText}.`;
    }),
    "",
    "Objects and visual metaphors:",
    ...spec.objects.slice(0, 9).map((object) => `- Draw "${object.label}" as ${visualMetaphorFor(object)}. Use a short readable label only; do not add extra explanatory paragraphs inside the box. Evidence confidence: ${Math.round(object.confidence * 100)}%.`),
    "",
    "Arrows and annotations:",
    spec.arrows.length
      ? spec.arrows
          .slice(0, 10)
          .map((arrow) => `- Connect "${labelForObject(spec.objects, arrow.from)}" to "${labelForObject(spec.objects, arrow.to)}" with a ${arrow.relation === "feedback" ? "dashed curved" : arrow.relation === "contrast" ? "thin contrast" : "solid directional"} arrow labeled "${arrow.label}".`)
          .join("\n")
      : "- Use only the minimum arrows needed to explain the reading order.",
    typeGuide.annotationRule,
    "",
    "Evidence discipline and scientific caution:",
    supported.length ? `Supported claims to show normally: ${supported.map((item) => `"${item}"`).join(", ")}.` : "No claim has strong direct evidence; keep the figure conservative.",
    tentative.length ? `Tentative or weakly supported items: ${tentative.map((item) => `"${item}"`).join(", ")}. Render these with dashed borders, muted labels, or a small verification marker rather than strong causal language.` : "No weak-evidence items detected in the current FigureSpec.",
    "Never invent datasets, numeric results, disease categories, molecular pathways, layer names, parameter counts, or performance values that are not explicitly present in the supplied content.",
    "If text is hard to render, prefer simple English labels with the exact concepts listed above; avoid random pseudo-text.",
    "",
    "Style specification:",
    `Palette instruction: ${palettePrompt(input.palette)}.`,
    "Typography: Inter, Helvetica, or Arial-like sans-serif; 14pt maximum for section headers, 9-11pt for component labels; bold headers, regular body labels. Text must remain horizontal and legible.",
    "Geometry: soft scientific pastels, rounded rectangles for processes, cylinders or file-like icons for datasets, compact tensor/card shapes for models, small chart or heatmap thumbnails for outputs. Use no gradients, no 3D perspective, no glow, no dark canvas, and no photorealistic stock imagery.",
    "Spacing: at least 70% of the canvas should remain white or near-white. Keep boxes aligned to a grid, avoid overlaps, keep arrowheads outside label text, and leave comfortable margins around every label.",
    referenceCues.length ? `Reference pattern cues learned from the gallery: ${referenceCues.join(" | ")}.` : "",
    "",
    "Final rendering checklist:",
    "The final image should have a coherent scientific story, readable labels, no fabricated claims, no caption text inside the figure, no watermark, no random UI elements, no cramped one-row layout, and no decorative objects that do not encode information."
  ]
    .filter(Boolean)
    .join("\n");
}

export function captionFromSpec(spec: FigureSpec, structure: PaperStructure) {
  const evidence = spec.evidenceMapping
    .filter((mapping) => mapping.risk !== "high")
    .slice(0, 3)
    .map((mapping) => mapping.claim)
    .join("; ");
  return `${spec.title}. The figure summarizes ${structure.title} by organizing the main research context, method components, and supported evidence${evidence ? ` (${evidence})` : ""}. Claims with limited support should be verified against the source text before publication.`;
}

function groupedObjectsForPrompt(spec: FigureSpec) {
  const map = new Map<string, FigureObject[]>();
  for (const object of spec.objects) {
    map.set(object.panelId, [...(map.get(object.panelId) ?? []), object]);
  }
  return map;
}

function labelForObject(objects: FigureObject[], id: string) {
  return objects.find((object) => object.id === id)?.label ?? id;
}

function figureTypePromptGuide(figureType: PaperInput["figureType"]) {
  const guides: Record<PaperInput["figureType"], { name: string; readingDirection: string; panelPlacement: string[]; annotationRule: string }> = {
    "method-framework": {
      name: "overall method framework diagram",
      readingDirection: "left-to-right pipeline with grouped stages",
      panelPlacement: ["left input stage", "left-center evidence/input lane", "central method stage", "right-center reasoning stage", "right validation lane", "far-right output stage"],
      annotationRule: "Use 4-6 major stage groups: Inputs, Feature Extraction, Fusion / Reasoning, Outputs / Validation. Do not put every item in one row; use grouped stage panels."
    },
    "experiment-flow": {
      name: "experimental protocol diagram",
      readingDirection: "top-to-bottom numbered workflow",
      panelPlacement: ["top context strip", "first numbered step", "middle protocol step", "measurement step", "side controls lane", "bottom readout lane"],
      annotationRule: "Use numbered circles, a vertical spine, a separate controls lane, and a separate readout lane."
    },
    "graphical-abstract": {
      name: "graphical abstract",
      readingDirection: "problem to contribution to evidence",
      panelPlacement: ["upper-left problem", "left data/context", "center contribution", "right method/evidence", "lower-right output", "bottom implication"],
      annotationRule: "Use a central contribution node and surrounding evidence-grounded components; avoid broad claims or decorative metaphors."
    },
    mechanism: {
      name: "mechanism diagram",
      readingDirection: "causal pathway with tentative links clearly marked",
      panelPlacement: ["left trigger", "upper mediator", "central mechanism", "lower state change", "right outcome", "bottom caveat"],
      annotationRule: "Use solid arrows only for supported causal steps and dashed arrows for uncertain feedback or hypotheses."
    },
    comparison: {
      name: "comparison / ablation figure",
      readingDirection: "left-to-right comparison under shared criteria",
      panelPlacement: ["left baseline column", "right proposed column", "shared metric strip", "evidence strip", "conclusion strip", "risk note"],
      annotationRule: "Use balanced columns and identical evaluation criteria; do not exaggerate superiority unless the input text supplies evidence."
    },
    timeline: {
      name: "research timeline",
      readingDirection: "left-to-right chronological axis",
      panelPlacement: ["first milestone", "second milestone", "third milestone", "fourth milestone", "evidence checkpoint", "next step"],
      annotationRule: "Use milestone nodes and alternating compact cards; do not invent dates."
    },
    "neural-network": {
      name: "neural network architecture diagram",
      readingDirection: "left-to-right layer pipeline with optional macro-micro callout",
      panelPlacement: ["input modality block", "encoder block", "fusion block", "prediction head", "loss/evaluation lane", "output block"],
      annotationRule: "Use tensor-like blocks for encoders, a clearly labeled fusion/attention module, prediction heads, and dashed optional loss or evidence links only if supported."
    },
    "data-pipeline": {
      name: "data processing pipeline diagram",
      readingDirection: "left-to-right swimlane pipeline",
      panelPlacement: ["raw data lane", "cleaning lane", "feature transformation lane", "quality-control lane", "analysis lane", "output lane"],
      annotationRule: "Use dataset cylinders, process cards, quality-control checkpoints, and output panels with no hidden data sources."
    }
  };
  return guides[figureType];
}

function visualMetaphorFor(object: FigureObject) {
  const label = object.label.toLowerCase();
  if (/ct|图像|影像|image|scan/.test(label)) return "a small medical-image thumbnail or image card";
  if (/病历|文本|text|record|摘要/.test(label)) return "a document/text-card icon with two short horizontal lines";
  if (/实验室|指标|metric|auc|f1|召回|score|评分/.test(label)) return "a compact chart or metric badge";
  if (/编码器|encoder|model|模型|网络/.test(label)) return "a rounded model block with subtle internal layer bars";
  if (/注意力|attention|融合|fusion/.test(label)) return "a central fusion block with crossing arrows or attention grid";
  if (/热力图|heatmap/.test(label)) return "a tiny heatmap thumbnail";
  if (object.kind === "dataset") return "a dataset card or cylinder";
  if (object.kind === "output") return "an output panel with a compact result badge";
  if (object.kind === "metric" || object.kind === "finding") return "a small evidence chart";
  return "a clean rounded scientific component card";
}

function palettePrompt(value: string) {
  return palettePromptText(value);
}

function trimPromptSentence(value: string, max: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length <= max ? cleaned : `${cleaned.slice(0, max - 1)}…`;
}
