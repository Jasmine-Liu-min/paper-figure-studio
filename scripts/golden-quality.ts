import { buildMermaid, renderFigureSvg } from "../lib/figure/figureRenderer";
import { buildFigureSpec, captionFromSpec, criticReview, promptFromSpec, specModules, specRelationships } from "../lib/figure/figureSpec";
import { selectReferences } from "../lib/figure/referenceGallery";
import { FigureType, PaperInput, PaperStructure } from "../lib/types";

type GoldenCase = {
  name: string;
  input: PaperInput;
  structure: PaperStructure;
  modules: string[];
  expectedBlocks: string[];
  expectedPrompt: string[];
  expectedSvg: string[];
};

const common = {
  purpose: "journal manuscript",
  aspectRatio: "16:9" as const,
  palette: "journal",
  style: "clean academic vector schematic"
};

const cases: GoldenCase[] = [
  {
    name: "statistics-ml",
    input: {
      ...common,
      field: "统计学 / 机器学习",
      figureType: "method-framework",
      text: "We study a statistical machine learning workflow for credit risk prediction. The method defines a prediction target, checks sampling bias and missingness, builds normalized features, trains an XGBoost model with cross-validation, and reports AUC with uncertainty intervals. The figure must not invent causal claims or sample sizes."
    },
    structure: structureOf(
      "Uncertainty-aware statistical ML workflow",
      "A statistical machine learning workflow defines a prediction target, sampling assumptions, feature normalization, XGBoost training, cross-validation, AUC, and uncertainty intervals.",
      "Methods include missingness checks, normalized features, XGBoost model selection, and cross-validation.",
      "Results report AUC and robustness checks without fabricated sample sizes."
    ),
    modules: ["Prediction target", "Observed data", "Missingness check", "Feature normalization", "XGBoost model", "Cross-validation", "AUC", "Uncertainty interval", "Decision output"],
    expectedBlocks: ["Statistical question", "Data and sampling", "Feature design", "Evaluation and uncertainty"],
    expectedPrompt: ["Statistical question", "uncertainty", "Never invent"],
    expectedSvg: ["Statistical guardrails", "Evaluation and", "Decision output"]
  },
  {
    name: "recommender-search",
    input: {
      ...common,
      field: "搜索推荐系统",
      figureType: "neural-network",
      text: "The recommender system uses user profile signals, item features, query intent, two-tower embedding retrieval, ANN vector search, a deep ranking model, diversity-aware re-ranking constraints, served top-K recommendation feed, and online feedback from click and dwell logs. A/B tests are used for online metrics."
    },
    structure: structureOf(
      "Search and recommendation loop",
      "A recommender system combines user signals, item features, two-tower retrieval, ANN search, deep ranking, re-ranking constraints, top-K serving, and online feedback.",
      "Methods include candidate retrieval, ranking model, diversity constraints, click logs, dwell logs, and A/B tests.",
      "Results are evaluated with online metrics and behavior feedback."
    ),
    modules: ["User profile", "Item features", "Query intent", "Two-tower embeddings", "ANN vector search", "Deep ranking model", "Diversity re-ranking", "Top-K feed", "Online feedback"],
    expectedBlocks: ["User and item signals", "Candidate retrieval", "Ranking model", "Served results", "Online feedback"],
    expectedPrompt: ["Architecture blueprint", "top-K", "feedback"],
    expectedSvg: ["Search / recommendation loop", "Candidate retrieval", "Online feedback"]
  },
  {
    name: "image-processing",
    input: {
      ...common,
      field: "图像处理 / 深度学习",
      figureType: "neural-network",
      text: "The image processing model performs segmentation on microscopy images. The pipeline uses image input frames, label masks, resizing and normalization, U-Net encoder-decoder backbone with multi-scale features and attention module, segmentation head, Dice and IoU metrics, qualitative visual examples, and failure cases. No parameter count is provided."
    },
    structure: structureOf(
      "Image segmentation architecture",
      "The image processing model performs segmentation with microscopy image frames, masks, preprocessing, U-Net backbone, attention, segmentation head, Dice, IoU, and visual evidence.",
      "Methods include resize, normalization, multi-scale U-Net encoder-decoder, attention module, and segmentation head.",
      "Results include Dice, IoU, qualitative examples, and failure cases."
    ),
    modules: ["Image frames", "Label masks", "Resize crop", "Normalization", "U-Net encoder-decoder", "Attention module", "Segmentation head", "Dice IoU", "Visual evidence"],
    expectedBlocks: ["Image / video input", "Preprocessing", "U-Net encoder-decoder", "Segmentation head", "Visual evidence"],
    expectedPrompt: ["Architecture blueprint", "Segmentation head", "no fabricated"],
    expectedSvg: ["Image processing / deep vision workflow", "feature maps", "Visual evidence"]
  }
];

let failures = 0;
for (const item of cases) {
  const references = selectReferences(item.input.figureType, item.input.field, item.structure.keywords, item.input.text);
  const spec = buildFigureSpec(item.input, item.structure, references, item.name, item.modules, "golden-quality layout", 0);
  const modules = specModules(spec);
  const prompt = promptFromSpec(spec, references, item.input);
  const caption = captionFromSpec(spec, item.structure);
  const critic = criticReview(spec, references, item.input);
  const svg = renderFigureSvg(item.name, modules, item.input.palette, item.input.aspectRatio, 0, item.input.figureType, spec);
  const mermaid = buildMermaid(modules, 0, item.input.figureType);
  const relationships = specRelationships(spec);

  assert(item.name, "architecture exists", Boolean(spec.architecture));
  for (const expected of item.expectedBlocks) assert(item.name, `architecture block: ${expected}`, spec.architecture?.blocks.some((block) => block.title.includes(expected)));
  for (const expected of item.expectedPrompt) assert(item.name, `prompt contains: ${expected}`, prompt.toLowerCase().includes(expected.toLowerCase()));
  for (const expected of item.expectedSvg) assert(item.name, `svg contains: ${expected}`, svg.includes(expected));
  assert(item.name, "critic score usable", critic.total >= 60);
  assert(item.name, "caption mentions caution", /verify|verified|support/i.test(caption));
  assert(item.name, "relationships generated", relationships.length >= 3);
  assert(item.name, "mermaid generated", mermaid.length >= 30);
}

if (failures) {
  console.error(`\n${failures} golden quality check(s) failed.`);
  process.exit(1);
}

console.log(`\nGolden quality checks passed: ${cases.length} cases.`);

function structureOf(title: string, abstract: string, method: string, result: string): PaperStructure {
  return {
    title,
    abstract,
    methods: [{ title: "Method", content: method }],
    results: [{ title: "Result", content: result }],
    keywords: keywords(`${title} ${abstract} ${method} ${result}`),
    limitations: ["No fabricated metrics, sample sizes, or causal claims."]
  };
}

function keywords(text: string) {
  return Array.from(new Set(text.toLowerCase().split(/[^a-zA-Z0-9\u4e00-\u9fa5-]+/).filter((word) => word.length > 3))).slice(0, 18);
}

function assert(caseName: string, label: string, condition: unknown) {
  if (condition) return;
  failures += 1;
  console.error(`[${caseName}] failed: ${label}`);
}
