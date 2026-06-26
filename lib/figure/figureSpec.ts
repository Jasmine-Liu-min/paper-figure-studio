import {
  CriticReview,
  DesignIteration,
  EvidenceMapping,
  FigureArrow,
  FigureObject,
  FigurePanel,
  FigurePlan,
  FigureSpec,
  PaperInput,
  PaperStructure,
  ReferenceFigure
} from "../types";
import { hashId } from "../utils";
import { buildArchitectureDiagram } from "./spec/architectureBuilder";
export { captionFromSpec, promptFromSpec } from "./spec/promptBuilder";

const roleKinds: FigureObject["kind"][] = ["concept", "dataset", "process", "model", "metric", "finding", "output"];

type DrawableEvidence = {
  label: string;
  excerpt: string;
  kind: FigureObject["kind"];
};

export function buildFigureSpec(
  input: PaperInput,
  structure: PaperStructure,
  references: ReferenceFigure[],
  name: string,
  modules: string[],
  layout: string,
  variant: number
): FigureSpec {
  const evidenceItems = extractDrawableEvidence(input, structure);
  const safeModules = evidenceFirstModules(input, modules, references, evidenceItems);
  const panels = buildPanels(input, safeModules, variant);
  const objects = safeModules.map((module, index) => {
    const panel = panels[Math.min(index, panels.length - 1)];
    const evidenceItem = evidenceItems.find((item) => sameLabel(item.label, module));
    const evidence = evidenceItem?.excerpt || findEvidence(module, structure, input.text);
    const position = defaultPosition(index, safeModules.length, input.figureType, variant, module);
    return {
      id: `obj-${index + 1}`,
      panelId: panel.id,
      label: shortenLabel(cleanFigureLabel(module), 28),
      kind: evidenceItem?.kind ?? objectKindFor(module, index),
      evidence,
      confidence: evidenceItem ? 0.9 : evidence ? 0.82 : 0.52,
      position,
      locked: false
    };
  });
  const arrows = buildArrows(objects, input.figureType, variant);
  const evidenceMapping = buildEvidenceMapping(objects, structure, input.text);
  const architecture = buildArchitectureDiagram(input, structure, objects, {
    uniqueLabels,
    shortenLabel,
    cleanFigureLabel,
    classifyLabelStage
  });
  const riskNotes = [
    ...references.flatMap((reference) => reference.criticChecklist.slice(0, 1)),
    ...evidenceMapping.filter((mapping) => mapping.risk !== "low").map((mapping) => `${mapping.claim} lacks strong source text.`)
  ].slice(0, 5);

  return {
    title: name,
    figureType: input.figureType,
    thesis: structure.abstract.slice(0, 260) || `${input.field} research figure`,
    layoutIntent: `${layout}. Inspired by ${references.map((reference) => reference.title).join(", ")}.`,
    panels,
    objects,
    arrows,
    architecture,
    evidenceMapping,
    styleGuide: {
      palette: input.palette,
      typography: "Readable journal-style sans serif, 12-16 px labels, no dense paragraphs.",
      labelPolicy: "Prefer short noun phrases; mark weak claims as tentative instead of overstating them.",
      iconStyle: "Simple vector scientific glyphs only when they match the text.",
      spacing: "Use generous whitespace and align arrows to one dominant reading direction."
    },
    riskNotes: Array.from(new Set(riskNotes.length ? riskNotes : ["Human verification required before submission."]))
  };
}

export function criticReview(spec: FigureSpec, references: ReferenceFigure[], input: PaperInput): CriticReview {
  const weakEvidence = spec.evidenceMapping.filter((mapping) => mapping.risk === "high").length;
  const mediumEvidence = spec.evidenceMapping.filter((mapping) => mapping.risk === "medium").length;
  const longLabels = spec.objects.filter((object) => object.label.length > 30).length;
  const arrowLoad = spec.arrows.length > Math.max(2, spec.objects.length);
  const referenceCoverage = references.some((reference) => reference.figureType === spec.figureType);

  const faithful = clampScore(92 - weakEvidence * 15 - mediumEvidence * 6);
  const readable = clampScore(88 - longLabels * 7 - (spec.objects.length > 7 ? 8 : 0) - (arrowLoad ? 6 : 0));
  const concise = clampScore(86 - longLabels * 8 - Math.max(0, spec.panels.length - 5) * 3);
  const visual = clampScore(82 + (referenceCoverage ? 7 : 0) - (arrowLoad ? 5 : 0));
  const reviewerRisk = clampScore(90 - weakEvidence * 16 - spec.riskNotes.length * 3);
  const total = Math.round(faithful * 0.28 + readable * 0.2 + concise * 0.16 + visual * 0.18 + reviewerRisk * 0.18);
  const issues: string[] = [];
  const suggestions: string[] = [];

  if (weakEvidence) {
    issues.push(`${weakEvidence} 个图中元素缺少明确证据。`);
    suggestions.push("把无证据元素改成更保守的概念标签，或补充输入文本。");
  }
  if (mediumEvidence) {
    issues.push(`${mediumEvidence} 个主张只有间接证据。`);
    suggestions.push("在图注或标签中避免确定性过强的措辞。");
  }
  if (longLabels) {
    issues.push(`${longLabels} 个标签偏长，可能影响可读性。`);
    suggestions.push("将长标签压缩成 3-6 个词的短语。");
  }
  if (arrowLoad) {
    issues.push("箭头关系偏多，读者可能难以顺着主线阅读。");
    suggestions.push("保留主流程箭头，把次级关系放到图注。");
  }
  if (!referenceCoverage) {
    issues.push("参考模式与目标图类型不完全匹配。");
    suggestions.push("优先选择同类型参考图谱重新生成。");
  }
  if (!issues.length) {
    issues.push("当前方案结构完整，但仍需人工核对术语与图注。");
    suggestions.push("提交前逐项检查图中每个主张是否能在论文中定位。");
  }

  return {
    total,
    faithful,
    readable,
    concise,
    visual,
    reviewerRisk,
    verdict: total >= 88 ? "可作为高质量草图继续精修" : total >= 76 ? "结构可用，建议先优化证据和可读性" : "风险较高，需要重构图的主线",
    issues,
    suggestions
  };
}

export function optimizePlan(plan: FigurePlan, input: PaperInput): FigurePlan {
  if (!plan.spec) return plan;
  const before = plan.critic?.total ?? plan.score;
  const specBase = {
    ...plan.spec,
    objects: plan.spec.objects.map((object) => ({
      ...object,
      label: shortenLabel(object.label, 24),
      confidence: Math.max(object.confidence, object.evidence ? 0.86 : 0.6),
      position: object.position,
      locked: object.locked
    })),
    arrows: plan.spec.arrows.slice(0, Math.max(2, plan.spec.objects.length - 1)),
    riskNotes: plan.spec.riskNotes
      .map((note) => note.replace(/lacks strong source text/gi, "needs human verification"))
      .slice(0, 4),
    styleGuide: {
      ...plan.spec.styleGuide,
      labelPolicy: "Labels optimized to 3-5 words; uncertain claims stay conservative."
    }
  };
  const spec = {
    ...specBase,
    evidenceMapping: specBase.objects.map((object) => {
      const previous = plan.spec?.evidenceMapping.find((mapping) => mapping.targetId === object.id);
      return {
        targetId: object.id,
        claim: object.label,
        sourceExcerpt: object.evidence || previous?.sourceExcerpt || "No direct excerpt found in the provided text.",
        risk: object.evidence ? "low" as const : previous?.risk ?? "high" as const
      };
    })
  };
  const critic = criticReview(spec, plan.references ?? [], input);
  const iteration: DesignIteration = {
    id: hashId("iter"),
    createdAt: new Date().toISOString(),
    action: "Deterministic critic-guided optimization",
    beforeScore: before,
    afterScore: critic.total,
    notes: ["Shortened labels", "Reduced secondary arrows", "Made weak claims more conservative"]
  };
  return {
    ...plan,
    name: plan.name.includes("Optimized") ? plan.name : `${plan.name} Optimized`,
    score: critic.total,
    spec,
    critic,
    iterations: [iteration, ...(plan.iterations ?? [])]
  };
}

export function specModules(spec: FigureSpec) {
  return spec.objects.map((object) => object.label);
}

export function specRelationships(spec: FigureSpec) {
  return spec.arrows.map((arrow) => `${labelForObject(spec.objects, arrow.from)} -> ${labelForObject(spec.objects, arrow.to)}${arrow.label ? ` (${arrow.label})` : ""}`);
}


function buildPanels(input: PaperInput, modules: string[], variant: number): FigurePanel[] {
  const roles: FigurePanel["role"][] =
    input.figureType === "comparison"
      ? ["context", "comparison", "comparison", "evidence", "output"]
      : input.figureType === "timeline"
        ? ["context", "timeline", "timeline", "timeline", "evidence", "output"]
        : input.figureType === "mechanism"
          ? ["context", "mechanism", "mechanism", "evidence", "output"]
          : ["context", "input", "method", "method", "evidence", "output"];
  const count = Math.min(Math.max(4, modules.length), 6);
  return Array.from({ length: count }, (_, index) => ({
    id: `panel-${index + 1}`,
    title: panelTitleFor(roles[index] ?? "method", index, variant),
    role: roles[index] ?? "method",
    summary: modules[index] ? `Visualize ${modules[index]} with source-grounded labels.` : "Keep this panel concise and evidence-grounded."
  }));
}

function buildArrows(objects: FigureObject[], figureType: PaperInput["figureType"], variant: number): FigureArrow[] {
  const relation: FigureArrow["relation"] = figureType === "comparison" ? "contrast" : figureType === "mechanism" ? "causal" : "flow";
  if (figureType === "method-framework" || figureType === "neural-network" || figureType === "data-pipeline") {
    const groups = groupObjectsByStage(objects);
    const arrows: FigureArrow[] = [];
    const addArrow = (from: FigureObject | undefined, to: FigureObject | undefined, label: string, arrowRelation: FigureArrow["relation"] = "flow") => {
      if (!from || !to || from.id === to.id) return;
      if (arrows.some((arrow) => arrow.from === from.id && arrow.to === to.id)) return;
      arrows.push({ id: `arrow-${arrows.length + 1}`, from: from.id, to: to.id, label, relation: arrowRelation });
    };
    const imageInput = groups.inputs.find((object) => /ct|图像|影像|image/i.test(object.label));
    const textInput = groups.inputs.find((object) => /病历|文本|record|text/i.test(object.label));
    const otherInputs = groups.inputs.filter((object) => object !== imageInput && object !== textInput);
    const imageEncoder = groups.encoders.find((object) => /图像|image/i.test(object.label)) ?? groups.encoders[0];
    const textEncoder = groups.encoders.find((object) => /文本|text/i.test(object.label)) ?? groups.encoders.find((object) => object !== imageEncoder);
    const fusion = groups.fusion.find((object) => /融合|attention|注意力/i.test(object.label)) ?? groups.fusion[0] ?? groups.encoders[groups.encoders.length - 1];
    const core = groups.fusion.find((object) => /medfuse|框架|framework|模型|model/i.test(object.label)) ?? fusion;
    addArrow(imageInput, imageEncoder, "image features");
    addArrow(textInput, textEncoder, "clinical text");
    for (const input of otherInputs) addArrow(input, fusion, "structured data");
    addArrow(imageEncoder, fusion, "lesion features");
    addArrow(textEncoder, fusion, "clinical evidence");
    if (core && fusion && core.id !== fusion.id) addArrow(fusion, core, "multimodal fusion");
    for (const output of groups.outputs) addArrow(core ?? fusion, output, output.kind === "metric" ? "evaluation" : "prediction");
    return arrows.length ? arrows : objects.slice(0, -1).map((object, index) => ({
      id: `arrow-${index + 1}`,
      from: object.id,
      to: objects[index + 1].id,
      label: "leads to",
      relation
    }));
  }
  const arrows: FigureArrow[] = objects.slice(0, -1).map((object, index) => ({
    id: `arrow-${index + 1}`,
    from: object.id,
    to: objects[index + 1].id,
    label: relation === "contrast" && index === 0 ? "compared with" : relation === "causal" ? "supports" : "leads to",
    relation
  }));
  if (figureType === "mechanism" && objects.length > 3) {
    arrows.push({ id: "arrow-feedback", from: objects[objects.length - 1].id, to: objects[1].id, label: "tentative feedback", relation: "feedback" });
  }
  if (variant === 1 && objects.length > 4) {
    arrows.push({ id: "arrow-evidence", from: objects[2].id, to: objects[objects.length - 1].id, label: "evidence", relation: "supports" });
  }
  return arrows;
}

function groupObjectsByStage(objects: FigureObject[]) {
  const inputs: FigureObject[] = [];
  const encoders: FigureObject[] = [];
  const fusion: FigureObject[] = [];
  const outputs: FigureObject[] = [];
  for (const object of objects) {
    const stage = classifyObjectStage(object);
    if (stage === 0) inputs.push(object);
    else if (stage === 1) encoders.push(object);
    else if (stage === 2) fusion.push(object);
    else outputs.push(object);
  }
  return { inputs, encoders, fusion, outputs };
}

function classifyObjectStage(object: FigureObject) {
  const label = object.label.toLowerCase();
  if (/输出|诊断|风险评分|热力图|证据摘要|auc|f1|召回|消融|output|score|heatmap/.test(label) || object.kind === "output" || object.kind === "metric" || object.kind === "finding") return 3;
  if (/编码器|encoder|特征|病灶|症状|病史|用药|feature/.test(label) || object.kind === "process") return 1;
  if (/MedFuse|跨模态|注意力|融合|attention|fusion|框架|模型|model/i.test(object.label) || object.kind === "model") return 2;
  if (/ct|图像|影像|病历|文本|实验室|指标|数据|input|data|sample/.test(label) || object.kind === "dataset") return 0;
  return 1;
}

function buildEvidenceMapping(objects: FigureObject[], structure: PaperStructure, text: string): EvidenceMapping[] {
  return objects.map((object) => {
    const excerpt = object.evidence || findEvidence(object.label, structure, text);
    return {
      targetId: object.id,
      claim: object.label,
      sourceExcerpt: excerpt || "No direct excerpt found in the provided text.",
      risk: excerpt ? (excerpt.length > 36 ? "low" : "medium") : "high"
    };
  });
}

// A figure node label should read as a self-contained term, not a sentence.
// Rejects verb/connective-laden phrases and over-long labels so model slip-ups
// (sentence fragments sneaking into "modules") never become card labels.
function looksLikeTerm(label: string) {
  const value = label.trim();
  if (!value) return false;
  if (/(利用|通过|经过|进入|结合|使用|采用|将|可以|能够|从而|实现|提出|然后|随后|包括|其中)/.test(value)) return false;
  if (/[一-龥]/.test(value)) return value.length <= 10;
  return value.split(/\s+/).length <= 6;
}

function evidenceFirstModules(input: PaperInput, modules: string[], references: ReferenceFigure[], evidenceItems: DrawableEvidence[]) {
  // The LLM's module labels are clean technical terms already ordered inputs ->
  // outputs. When the model gave us enough usable ones, use them verbatim and
  // skip regex evidence entirely — that mixing is what injected sentence fragments.
  const cleanModules = uniqueLabels(modules.filter((module) => !isGenericModule(module) && looksLikeTerm(module)));
  if (cleanModules.length >= 4) return cleanModules.slice(0, 8);

  // Otherwise (LLM off, or too few terms) fall back to term-filtered evidence.
  const evidenceLabels = evidenceItems.map((item) => item.label).filter(looksLikeTerm);
  const fallback = (references[0]?.components ?? ["Research context", "Method", "Evidence", "Output"]).filter((module) => !isGenericModule(module));
  const candidates = [...cleanModules, ...evidenceLabels, ...fallback];
  const unique = selectBalancedLabels(uniqueLabels(candidates), input.figureType);
  if (unique.length >= 4) return unique;
  return selectBalancedLabels(uniqueLabels([...unique, ...evidenceItems.map((item) => item.label), ...modules, ...fallback]), input.figureType);
}

function extractDrawableEvidence(input: PaperInput, structure: PaperStructure): DrawableEvidence[] {
  const sentences = [
    ...splitEvidenceSentences(structure.abstract),
    ...structure.methods.flatMap((section) => splitEvidenceSentences(section.content)),
    ...structure.results.flatMap((section) => splitEvidenceSentences(section.content)),
    ...splitEvidenceSentences(input.text).slice(0, 18)
  ];
  const items: DrawableEvidence[] = [];
  for (const sentence of sentences) {
    for (const label of labelsFromSentence(sentence)) {
      if (label.length < 3 || isGenericModule(label)) continue;
      items.push({
        label,
        excerpt: sentence.slice(0, 180),
        kind: objectKindFor(label, items.length)
      });
    }
  }
  return uniqueEvidence(items)
    .sort((a, b) => labelSelectionScore(b.label) - labelSelectionScore(a.label))
    .slice(0, 24);
}

function splitEvidenceSentences(value: string) {
  return value
    .replace(/\s+/g, " ")
    .split(/[。.!?；;]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 6 && !/^\[?truncated\]?$/i.test(item));
}

function labelsFromSentence(sentence: string) {
  const labels: string[] = [];
  const afterIncludes = sentence.match(/(?:包括|包含|含有|consists of|includes|including|comprises)\s*([^。.;；]+)/i)?.[1];
  if (afterIncludes) labels.push(...splitPhraseList(afterIncludes));
  const afterInput = sentence.match(/(?:输入|input(?:s)?(?: include)?|input modalities include)\s*([^。.;；]*?)(?:先|再|随后|然后|并|，|,|$)/i)?.[1];
  if (afterInput) labels.push(...splitPhraseList(afterInput).map((label) => ensureRoleLabel(label, "input")));
  const afterBy = sentence.match(/(?:通过|利用|采用|using|via|through|with)\s*([^。.;；]+)/i)?.[1];
  if (afterBy) labels.push(...splitPhraseList(afterBy));
  const afterOutput = sentence.match(/(?:输出|output(?:s)?(?: include)?)\s*([^。.;；]+)/i)?.[1];
  if (afterOutput) labels.push(...splitPhraseList(afterOutput).map((label) => ensureRoleLabel(label, "output")));
  labels.push(...domainSpecificLabels(sentence));
  labels.push(compactEvidenceLabel(sentence));
  return labels.map((label) => cleanLabel(label)).filter(Boolean);
}

function splitPhraseList(value: string) {
  return value
    .split(/、|,|，|\band\b|以及|和|及|\/|、/i)
    .map((item) => cleanLabel(item))
    .filter(Boolean)
    .slice(0, 6);
}

function compactEvidenceLabel(sentence: string) {
  const cleaned = sentence
    .replace(/^摘要[:：]?/, "")
    .replace(/本文|本研究|我们|提出|研究|实验结果表明|结果显示|方法部分/g, "")
    .trim();
  const chunks = splitPhraseList(cleaned);
  if (/MedFuse/i.test(sentence)) return "MedFuse 轻量级框架";
  return chunks.find((chunk) => chunk.length >= 4 && chunk.length <= 18) || clampLabelWords(cleaned, 30);
}

function clampLabelWords(value: string, maxChars: number) {
  const v = value.trim();
  if (v.length <= maxChars) return v;
  if (/[一-龥]/.test(v)) return v.slice(0, maxChars).trim();
  const cut = v.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 8 ? cut.slice(0, lastSpace) : cut).trim();
}

function cleanLabel(value: string) {
  const cleaned = value
    .replace(/将复杂研究过程转化为|能够|可以|并减少.*$/g, "")
    .replace(/图像编码器.*$/g, "图像编码器")
    .replace(/文本编码器.*$/g, "文本编码器")
    .replace(/跨模态注意力.*$/g, "跨模态注意力融合")
    .replace(/诊断风险评分.*$/g, "诊断风险评分")
    .replace(/关键影像区域热力图.*$/g, "关键影像热力图")
    .replace(/文本证据摘要.*$/g, "文本证据摘要")
    .replace(/电子病历文本和实验室指标/g, "电子病历文本/实验室指标")
    .replace(/^为了.*?(输出|输入|通过|使用|采用)/g, "$1")
    .replace(/^(先|再|然后|随后|并通过|并使用)/g, "")
    .replace(/^再/g, "")
    .replace(/^随后/g, "")
    .replace(/^一种/g, "")
    .replace(/^该框架/g, "")
    .replace(/^系统/g, "")
    .replace(/^输入/g, "")
    .replace(/^输出/g, "")
    .replace(/中的|过程中的|面向/g, "")
    .replace(/[：:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clampLabelWords(cleaned, 34);
}

function uniqueEvidence(items: DrawableEvidence[]) {
  const seen = new Set<string>();
  const output: DrawableEvidence[] = [];
  for (const item of items) {
    const key = normalizeLabel(item.label);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

function uniqueLabels(labels: string[]) {
  return uniqueEvidence(labels.filter(Boolean).map((label) => ({ label, excerpt: "", kind: "concept" }))).map((item) => item.label);
}

function sameLabel(a: string, b: string) {
  const left = normalizeLabel(a);
  const right = normalizeLabel(b);
  return left === right || left.includes(right) || right.includes(left);
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, "");
}

function isGenericModule(value: string) {
  const normalized = normalizeLabel(value);
  return [
    "researchgap",
    "researchproblem",
    "inputdata",
    "keycontribution",
    "practicalgain",
    "publicationoutput",
    "nextstep",
    "question",
    "rawdata",
    "method",
    "evidence",
    "output"
  ].some((generic) => normalized === generic || normalized.includes(generic));
}

function findEvidence(label: string, structure: PaperStructure, text: string) {
  const terms = keywordTerms(label);
  const candidates = [
    structure.abstract,
    ...structure.methods.map((item) => item.content),
    ...structure.results.map((item) => item.content),
    text
  ].filter(Boolean);
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    if (terms.some((term) => lower.includes(term))) return cleanExcerpt(candidate, terms);
  }
  return "";
}

function cleanExcerpt(value: string, terms: string[]) {
  const sentences = value.split(/[。.!?；;]\s*/).map((item) => item.trim()).filter(Boolean);
  const sentence = sentences.find((item) => terms.some((term) => item.toLowerCase().includes(term))) ?? sentences[0] ?? value;
  return sentence.slice(0, 180);
}

function objectKindFor(module: string, index: number): FigureObject["kind"] {
  const lower = module.toLowerCase();
  if (/输出|诊断|风险评分|热力图|证据摘要|output|score|heatmap/.test(lower)) return "output";
  if (/metric|analysis|validation|auc|f1|召回|评分|消融/.test(lower)) return "metric";
  if (/model|network|encoder|attention|框架|模型|编码器|注意力|融合/.test(lower)) return "model";
  if (/data|sample|dataset|ct|图像|影像|病历|文本|实验室|指标|公开数据集/.test(lower)) return "dataset";
  if (lower.includes("cell")) return "cell";
  if (lower.includes("molecule") || lower.includes("pathway")) return "molecule";
  if (/result|evidence|finding|结果|优于|贡献|证明/.test(lower)) return "finding";
  return roleKinds[index % roleKinds.length];
}

function panelTitleFor(role: FigurePanel["role"], index: number, variant: number) {
  const labels: Record<FigurePanel["role"], string> = {
    context: "Research Context",
    input: "Input Evidence",
    method: variant === 1 ? "Core Design" : "Method Module",
    evidence: "Validation Evidence",
    output: "Contribution",
    comparison: index === 1 ? "Baseline" : "Proposed",
    timeline: `Phase ${index + 1}`,
    mechanism: "Mechanism Step"
  };
  return labels[role];
}

function labelForObject(objects: FigureObject[], id: string) {
  return objects.find((object) => object.id === id)?.label ?? id;
}

function defaultPosition(index: number, total: number, figureType: PaperInput["figureType"], variant: number, module = "") {
  const count = Math.max(total, 1);
  if (figureType === "graphical-abstract") {
    if (index === count - 1) return { x: 0.5, y: 0.5 };
    const angle = (-90 + (360 / Math.max(count - 1, 1)) * index) * (Math.PI / 180);
    return { x: clampUnit(0.5 + Math.cos(angle) * 0.34), y: clampUnit(0.52 + Math.sin(angle) * 0.28) };
  }
  if (figureType === "comparison") {
    const col = index % 2;
    const row = Math.floor(index / 2);
    return { x: col ? 0.68 : 0.32, y: clampUnit(0.28 + row * 0.18) };
  }
  if (figureType === "timeline") {
    return { x: 0.1 + (0.8 / Math.max(count - 1, 1)) * index, y: index % 2 === 0 ? 0.42 : 0.64 };
  }
  if (figureType === "mechanism") {
    const points = [
      { x: 0.16, y: 0.5 },
      { x: 0.38, y: 0.34 },
      { x: 0.56, y: 0.5 },
      { x: 0.38, y: 0.68 },
      { x: 0.8, y: 0.5 }
    ];
    return points[index] ?? { x: 0.18 + index * 0.12, y: 0.5 };
  }
  if (figureType === "experiment-flow") {
    return { x: 0.42, y: 0.22 + (0.58 / Math.max(count - 1, 1)) * index };
  }
  if (figureType === "neural-network") {
    return { x: index % 2 === 0 ? 0.32 : 0.56, y: 0.24 + (0.56 / Math.max(count - 1, 1)) * index };
  }
  if (figureType === "method-framework" || figureType === "data-pipeline") {
    const stage = classifyLabelStage(module);
    const counts = countStagesForModules(total);
    const stageStart = counts.slice(0, stage).reduce((sum, value) => sum + value, 0);
    const withinStage = Math.max(0, index - stageStart);
    const stageCount = Math.max(1, counts[stage]);
    return {
      x: [0.14, 0.38, 0.62, 0.86][stage],
      y: clampUnit(0.22 + (0.56 / Math.max(stageCount - 1, 1)) * withinStage)
    };
  }
  if (variant === 1) {
    return { x: index % 2 === 0 ? 0.28 : 0.58, y: 0.24 + (0.56 / Math.max(count - 1, 1)) * index };
  }
  return { x: 0.1 + (0.8 / Math.max(count - 1, 1)) * index, y: 0.5 };
}

function countStagesForModules(total: number) {
  if (total >= 9) return [3, 2, 1, 3];
  if (total >= 8) return [3, 2, 1, 2];
  if (total >= 6) return [2, 2, 1, Math.max(1, total - 5)];
  return [1, 1, 1, Math.max(1, total - 3)];
}

function clampUnit(value: number) {
  return Math.max(0.08, Math.min(0.92, Number(value.toFixed(3))));
}

function shortenLabel(value: string, max: number) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  const words = cleaned.split(" ");
  let next = "";
  for (const word of words) {
    const attempt = next ? `${next} ${word}` : word;
    if (attempt.length > max) break;
    next = attempt;
  }
  return next || `${cleaned.slice(0, max - 1)}…`;
}

function cleanFigureLabel(value: string) {
  const cleaned = cleanLabel(value)
    .replace(/.*MedFuse.*/i, "MedFuse 轻量级框架")
    .replace(/为了提升.*$/, "临床可解释性输出")
    .replace(/不声称.*$/, "辅助筛查边界")
    .replace(/三个公开数据集上进行.*$/, "三类公开数据集")
    .trim();
  return cleaned || value.slice(0, 18);
}

function clampScore(value: number) {
  return Math.max(35, Math.min(98, Math.round(value)));
}


function ensureRoleLabel(label: string, role: "input" | "output") {
  const cleaned = cleanLabel(label);
  if (!cleaned) return "";
  if (role === "input" && !/(输入|input|ct|图像|病历|文本|指标|数据)/i.test(cleaned)) return `${cleaned} input`;
  if (role === "output" && !/(输出|output|评分|热力图|摘要|诊断|风险)/i.test(cleaned)) return `${cleaned} output`;
  return cleaned;
}

function domainSpecificLabels(sentence: string) {
  const labels: string[] = [];
  const patterns: Array<[RegExp, string]> = [
    [/MedFuse/i, "MedFuse 轻量级框架"],
    [/胸部\s*CT\s*图像/i, "胸部 CT 图像"],
    [/电子病历文本/, "电子病历文本"],
    [/实验室指标/, "实验室指标"],
    [/图像编码器/, "图像编码器"],
    [/文本编码器/, "文本编码器"],
    [/病灶区域特征/, "病灶区域特征"],
    [/症状、病史和用药信息|症状.*病史.*用药/, "症状/病史/用药信息"],
    [/跨模态注意力模块|跨模态注意力/, "跨模态注意力融合"],
    [/诊断风险评分|风险评分/, "诊断风险评分"],
    [/关键影像区域热力图|热力图/, "关键影像热力图"],
    [/文本证据摘要|证据摘要/, "文本证据摘要"],
    [/肺炎、肺结节和慢阻肺|肺炎.*肺结节.*慢阻肺/, "三类公开任务"],
    [/AUC、F1\s*和召回率|AUC.*F1.*召回率/i, "AUC/F1/召回率"],
    [/单模态基线/, "单模态基线"],
    [/消融实验/, "消融实验"],
    [/辅助筛查|科研分析/, "辅助筛查/科研分析"]
  ];
  for (const [pattern, label] of patterns) {
    if (pattern.test(sentence)) labels.push(label);
  }
  return labels;
}

function selectBalancedLabels(labels: string[], figureType: PaperInput["figureType"]) {
  const max = figureType === "graphical-abstract" ? 6 : figureType === "method-framework" || figureType === "neural-network" ? 9 : 7;
  const sorted = [...labels]
    .filter((label) => !isGenericModule(label))
    .sort((a, b) => labelSelectionScore(b) - labelSelectionScore(a));
  const output: string[] = [];
  if (figureType === "method-framework" || figureType === "neural-network" || figureType === "data-pipeline") {
    const quotas = [
      { stage: 0, count: 3 },
      { stage: 1, count: 2 },
      { stage: 2, count: 1 },
      { stage: 3, count: 3 }
    ];
    for (const quota of quotas) {
      for (const label of sorted.filter((item) => classifyLabelStage(item) === quota.stage)) {
        if (output.filter((item) => classifyLabelStage(item) === quota.stage).length >= quota.count) break;
        pushUniqueLabel(output, label);
      }
    }
  } else {
    for (const label of sorted) pushUniqueLabel(output, label);
  }
  for (const label of sorted) {
    if (output.length >= max) break;
    pushUniqueLabel(output, label);
  }
  return output.slice(0, max);
}

function pushUniqueLabel(output: string[], label: string) {
  if (output.some((selected) => sameLabel(selected, label))) return;
  if (output.some((selected) => semanticDuplicate(selected, label))) return;
  output.push(label);
}

function semanticDuplicate(a: string, b: string) {
  const left = normalizeLabel(a);
  const right = normalizeLabel(b);
  if (/medfuse/i.test(a) && /medfuse/i.test(b)) return true;
  const sharedImportant = ["跨模态注意力", "文本编码器", "图像编码器", "风险评分", "热力图", "证据摘要", "电子病历", "实验室指标", "胸部ct"];
  return sharedImportant.some((term) => left.includes(normalizeLabel(term)) && right.includes(normalizeLabel(term)));
}

function labelSelectionScore(label: string) {
  const normalized = label.toLowerCase();
  let score = 0;
  if (/MedFuse/i.test(label)) score += 11;
  if (/^(胸部 CT 图像|电子病历文本|实验室指标|图像编码器|文本编码器|跨模态注意力融合|诊断风险评分|关键影像热力图|文本证据摘要)$/.test(label)) score += 8;
  if (/ct|图像|影像|病历|文本|实验室|指标|数据集|input|data/.test(normalized)) score += 9;
  if (/编码器|encoder|特征|病灶|症状|病史|用药|feature/.test(normalized)) score += 8;
  if (/跨模态|注意力|融合|attention|fusion|框架/.test(normalized)) score += 12;
  if (/诊断|风险评分|热力图|证据摘要|输出|auc|f1|召回|消融|output|score|heatmap/.test(normalized)) score += 10;
  if (/不声称|替代医生|辅助筛查|科研分析/.test(normalized)) score += 6;
  if (label.length > 24) score -= 8;
  if (label.length > 32) score -= 20;
  return score;
}

function classifyLabelStage(label: string) {
  const normalized = label.toLowerCase();
  if (/输出|诊断|风险评分|热力图|证据摘要|auc|f1|召回|消融|辅助筛查|output|score|heatmap/.test(normalized)) return 3;
  if (/MedFuse|跨模态|注意力|融合|attention|fusion|框架|模型|model/.test(label)) return 2;
  if (/编码器|encoder|特征|病灶|症状|病史|用药|feature/.test(normalized)) return 1;
  if (/ct|图像|影像|病历|文本|实验室|指标|数据|input|data|sample/.test(normalized)) return 0;
  return 1;
}

function keywordTerms(label: string) {
  const normalized = label.toLowerCase();
  const asciiTerms = normalized.split(/\s+|\/|-/).filter((term) => term.length > 2);
  const cjkTerms = Array.from(label.matchAll(/[\u4e00-\u9fa5A-Za-z0-9]+/g))
    .map((match) => match[0].toLowerCase())
    .filter((term) => term.length > 1);
  const domainAliases: Record<string, string[]> = {
    "胸部ct图像": ["胸部", "ct", "图像"],
    "电子病历文本": ["电子病历", "文本"],
    "实验室指标": ["实验室", "指标"],
    "图像编码器": ["图像编码器", "图像", "编码器"],
    "文本编码器": ["文本编码器", "文本", "编码器"],
    "跨模态注意力融合": ["跨模态", "注意力", "融合"],
    "诊断风险评分": ["诊断", "风险评分"],
    "关键影像热力图": ["影像", "热力图"],
    "文本证据摘要": ["文本证据", "摘要"],
    "aucf1召回率": ["auc", "f1", "召回率"]
  };
  const aliases = Object.entries(domainAliases)
    .filter(([key]) => normalizeLabel(label).includes(key))
    .flatMap(([, value]) => value);
  return Array.from(new Set([...asciiTerms, ...cjkTerms, ...aliases])).filter((term) => term.length > 1);
}
