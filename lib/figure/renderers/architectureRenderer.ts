import dagre from "@dagrejs/dagre";
import { ArchitectureDiagram } from "../../types";
import { escapeHtml } from "../../utils";

export function renderArchitectureDiagram(diagram: ArchitectureDiagram, colors: string[], width: number, height: number) {
  const blocks = diagram.blocks.slice(0, 8);
  const connections = diagram.connections ?? [];
  const titleToIndex = new Map(blocks.map((block, index) => [block.title, index]));
  if (isMedicalMultimodalDiagram(blocks)) return renderMedicalMultimodalDiagram(diagram, colors, width, height);
  if (isRecommenderSearchDiagram(blocks)) return renderRecommenderSearchDiagram(diagram, colors, width, height);
  if (isImageProcessingDiagram(blocks)) return renderVisionProcessingDiagram(diagram, colors, width, height);
  if (isStatMlDiagram(blocks)) return renderStatMlDiagram(diagram, colors, width, height);

  const categoryColor = new Map<string, string>();
  const categoryStroke = new Map<string, string>();
  const orderedCategories = [...(diagram.legend ?? []).map((item) => item.category), ...blocks.map((block) => block.category ?? "default")];
  let colorCursor = 0;
  for (const category of orderedCategories) {
    if (categoryColor.has(category)) continue;
    const fill = colors[colorCursor % colors.length];
    categoryColor.set(category, fill);
    categoryStroke.set(category, darken(fill, 0.5));
    colorCursor += 1;
  }
  const fillFor = (block: ArchitectureDiagram["blocks"][number]) => categoryColor.get(block.category ?? "default") ?? colors[0];
  const strokeFor = (block: ArchitectureDiagram["blocks"][number]) => categoryStroke.get(block.category ?? "default") ?? "#52616f";

  const NODE_W = 200;
  const chipHeight = 22;
  const chipGap = 6;
  const headerCharBudget = Math.max(6, Math.floor((NODE_W - 56) / 7.4));
  const headerLineCount = Math.min(2, Math.max(1, ...blocks.map((block) => wrapLabel(block.title, headerCharBudget, 2).length)));
  const headerHeight = 26 + (headerLineCount - 1) * 16;
  const nodeHeight = (block: ArchitectureDiagram["blocks"][number]) => {
    const steps = block.substeps?.length ?? 0;
    return steps ? headerHeight + 12 + steps * (chipHeight + chipGap) - chipGap + 12 : 64;
  };

  const graph = new dagre.graphlib.Graph();
  graph.setGraph({ rankdir: "LR", ranksep: 66, nodesep: 26, marginx: 10, marginy: 10 });
  graph.setDefaultEdgeLabel(() => ({}));
  blocks.forEach((block, index) => graph.setNode(`n${index}`, { width: NODE_W, height: nodeHeight(block) }));
  const edgeList: Array<{ from: number; to: number; label?: string }> = [];
  const seenEdge = new Set<string>();
  for (const connection of connections) {
    const from = titleToIndex.get(connection.from);
    const to = titleToIndex.get(connection.to);
    if (from === undefined || to === undefined || from === to) continue;
    const key = `${from}->${to}`;
    if (seenEdge.has(key)) continue;
    seenEdge.add(key);
    graph.setEdge(`n${from}`, `n${to}`);
    edgeList.push({ from, to, label: connection.label });
  }
  if (!edgeList.length) {
    for (let i = 0; i < blocks.length - 1; i += 1) {
      graph.setEdge(`n${i}`, `n${i + 1}`);
      edgeList.push({ from: i, to: i + 1 });
    }
  }
  dagre.layout(graph);

  const graphWidth = graph.graph().width ?? NODE_W;
  const graphHeight = graph.graph().height ?? 100;
  const availLeft = 44;
  const availTop = 108;
  const availWidth = width - availLeft * 2;
  const availHeight = height - availTop - 50;
  const scale = Math.min(1.45, availWidth / graphWidth, availHeight / graphHeight);
  const offsetX = availLeft + (availWidth - graphWidth * scale) / 2;
  const offsetY = availTop + (availHeight - graphHeight * scale) / 2;

  const drawnBlocks = blocks.map((block, index) => {
    const node = graph.node(`n${index}`);
    const h = nodeHeight(block);
    const box = { x: node.x - NODE_W / 2, y: node.y - h / 2, w: NODE_W, h };
    return architectureBlock(box, block, fillFor(block), strokeFor(block), headerHeight, chipHeight, chipGap);
  });

  const connectorPaths: string[] = [];
  const connectorLabels: string[] = [];
  for (const edge of edgeList) {
    const routed = graph.edge(`n${edge.from}`, `n${edge.to}`);
    const points = routed?.points;
    if (!points || points.length < 2) continue;
    connectorPaths.push(`<path d="${smoothPath(points)}" fill="none" stroke="#5a6776" stroke-width="1.9" marker-end="url(#arrow)"/>`);
    if (edge.label) {
      const mid = points[Math.floor(points.length / 2)];
      const labelText = trim(edge.label, 18);
      const pillWidth = labelText.length * 6.1 + 14;
      connectorLabels.push(`<rect x="${mid.x - pillWidth / 2}" y="${mid.y - 9}" width="${pillWidth}" height="16" rx="8" fill="#fffdf8" stroke="#d8d2c6"/>
        <text x="${mid.x}" y="${mid.y + 3}" text-anchor="middle" font-family="Inter, Arial" font-size="9.5" font-weight="700" fill="#3a4654">${escapeHtml(labelText)}</text>`);
    }
  }

  const legend = renderArchitectureLegend(diagram.legend ?? [], categoryColor, categoryStroke, availLeft, height - 40, width - availLeft * 2);
  return `<g transform="translate(${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) scale(${scale.toFixed(3)})">
    ${connectorPaths.join("\n")}
    ${drawnBlocks.join("\n")}
    ${connectorLabels.join("\n")}
  </g>
  ${legend}`;
}

export function isDomainTemplateDiagram(blocks: ArchitectureDiagram["blocks"]) {
  return isMedicalMultimodalDiagram(blocks) || isRecommenderSearchDiagram(blocks) || isImageProcessingDiagram(blocks) || isStatMlDiagram(blocks);
}

function isMedicalMultimodalDiagram(blocks: ArchitectureDiagram["blocks"]) {
  const titles = blocks.map((block) => block.title).join(" ");
  return /Input modalities/i.test(titles) && /Clinical outputs/i.test(titles) && /encoder|编码器/i.test(titles) && /fusion|融合|attention|注意力/i.test(titles);
}

function isStatMlDiagram(blocks: ArchitectureDiagram["blocks"]) {
  const titles = blocks.map((block) => block.title).join(" ");
  return signalHits(titles, [/Statistical question/i, /Evaluation and uncertainty|uncertainty quantification/i, /Decision output/i, /Hypothesis (test|testing)/i, /Estimator|Posterior|Confidence interval/i]) >= 2;
}

function signalHits(titles: string, patterns: RegExp[]) {
  return patterns.filter((pattern) => pattern.test(titles)).length;
}

function isRecommenderSearchDiagram(blocks: ArchitectureDiagram["blocks"]) {
  const titles = blocks.map((block) => block.title).join(" ");
  return signalHits(titles, [/Candidate retrieval/i, /Ranking model/i, /Re-?ranking/i, /Served results/i, /Online feedback/i, /User (and|&) item signals/i]) >= 2;
}

function isImageProcessingDiagram(blocks: ArchitectureDiagram["blocks"]) {
  const titles = blocks.map((block) => block.title).join(" ");
  return signalHits(titles, [/Image \/ video input|image input|video input/i, /Vision Transformer|ViT/i, /CNN backbone|convolutional backbone/i, /U-?Net/i, /Visual evidence/i, /Segmentation head/i, /Detection head/i, /Restoration head/i]) >= 2;
}

function renderMedicalMultimodalDiagram(diagram: ArchitectureDiagram, colors: string[], width: number, height: number) {
  const blocks = diagram.blocks;
  const byTitle = (pattern: RegExp) => blocks.find((block) => pattern.test(block.title));
  const input = byTitle(/Input modalities/i) ?? blocks[0];
  const image = byTitle(/图像|image/i) ?? blocks[1];
  const text = byTitle(/文本|text/i) ?? blocks[2];
  const fusion = byTitle(/fusion|attention|融合|注意力|medfuse/i) ?? blocks[3];
  const output = byTitle(/Clinical outputs|output/i) ?? blocks[4];
  const validation = byTitle(/Validation|caution|Evidence/i) ?? blocks[5];
  const { categoryColor, categoryStroke, fillFor, strokeFor } = architectureColorMaps(diagram, colors);
  const bodyTop = 122;
  const inputBox = { x: 58, y: bodyTop + 104, w: 205, h: 128 };
  const imageBox = { x: 314, y: bodyTop + 22, w: 226, h: 118 };
  const textBox = { x: 314, y: bodyTop + 198, w: 226, h: 132 };
  const fusionBox = { x: 620, y: bodyTop + 118, w: 242, h: 150 };
  const outputBox = { x: 928, y: bodyTop + 72, w: 224, h: 144 };
  const validationBox = { x: 928, y: bodyTop + 258, w: 224, h: 118 };
  const paths = [
    connector(inputBox.x + inputBox.w, inputBox.y + 40, imageBox.x, imageBox.y + 58, "CT / image", -16),
    connector(inputBox.x + inputBox.w, inputBox.y + 88, textBox.x, textBox.y + 62, "clinical text", 18),
    connector(inputBox.x + inputBox.w, inputBox.y + 64, fusionBox.x, fusionBox.y + 78, "structured indicators", 10, true),
    connector(imageBox.x + imageBox.w, imageBox.y + 58, fusionBox.x, fusionBox.y + 46, "lesion features", -14),
    connector(textBox.x + textBox.w, textBox.y + 58, fusionBox.x, fusionBox.y + 106, "clinical evidence", 16),
    connector(fusionBox.x + fusionBox.w, fusionBox.y + 68, outputBox.x, outputBox.y + 72, "interpretable prediction", -16),
    connector(outputBox.x + outputBox.w / 2, outputBox.y + outputBox.h, validationBox.x + validationBox.w / 2, validationBox.y, "supported claims", 12, false, "vertical")
  ].join("\n");
  const blocksSvg = [
    architectureBlock(inputBox, input, fillFor(input), strokeFor(input), 28, 24, 7),
    architectureBlock(imageBox, image, fillFor(image), strokeFor(image), 28, 24, 7),
    architectureBlock(textBox, text, fillFor(text), strokeFor(text), 28, 24, 7),
    architectureBlock(fusionBox, fusion, fillFor(fusion), strokeFor(fusion), 30, 24, 8),
    architectureBlock(outputBox, output, fillFor(output), strokeFor(output), 28, 24, 7),
    architectureBlock(validationBox, validation, fillFor(validation), strokeFor(validation), 28, 23, 6)
  ].join("\n");
  const lane = `<rect x="48" y="${bodyTop - 12}" width="${width - 96}" height="${height - bodyTop - 62}" rx="14" fill="#fbfaf6" stroke="#e3dccf"/>
    <text x="64" y="${bodyTop + 18}" font-family="Inter, Arial" font-size="12" font-weight="900" fill="#586474">Multimodal clinical AI architecture: modality inputs -> encoders -> fusion -> interpretable outputs -> review checks</text>`;
  const legend = renderArchitectureLegend(diagram.legend ?? [], categoryColor, categoryStroke, 60, height - 48, width - 120);
  return `${lane}${paths}${blocksSvg}${legend}`;
}

function renderStatMlDiagram(diagram: ArchitectureDiagram, colors: string[], width: number, height: number) {
  const blocks = diagram.blocks;
  const byTitle = (pattern: RegExp) => blocks.find((block) => pattern.test(block.title));
  const question = byTitle(/Statistical question/i) ?? blocks[0];
  const data = byTitle(/Data and sampling/i) ?? blocks[1];
  const features = byTitle(/Feature design/i) ?? blocks[2];
  const model = blocks.find((block) => /model|learning|regression|forest|boost|深度|神经/i.test(block.title)) ?? blocks[3];
  const evalBlock = byTitle(/Evaluation/i) ?? blocks[4];
  const output = byTitle(/Decision output/i) ?? blocks[5];
  const { categoryColor, categoryStroke, fillFor, strokeFor } = architectureColorMaps(diagram, colors);
  const bodyTop = 122;
  const y = bodyTop + 182;
  const boxes = [
    { block: question, box: { x: 58, y: y - 82, w: 178, h: 126 } },
    { block: data, box: { x: 270, y: y - 118, w: 190, h: 144 } },
    { block: features, box: { x: 498, y: y - 70, w: 190, h: 144 } },
    { block: model, box: { x: 728, y: y - 118, w: 202, h: 154 } },
    { block: evalBlock, box: { x: 970, y: y - 70, w: 218, h: 144 } }
  ];
  const outputBox = { x: 970, y: bodyTop + 330, w: 218, h: 118 };
  const lane = `<rect x="48" y="${bodyTop - 12}" width="${width - 96}" height="${height - bodyTop - 62}" rx="14" fill="#fbfaf6" stroke="#e3dccf"/>
    <text x="64" y="${bodyTop + 18}" font-family="Inter, Arial" font-size="12" font-weight="900" fill="#586474">Statistics-first ML workflow: define target -> sampling assumptions -> features -> model -> uncertainty-aware evaluation</text>`;
  const arrows = [
    connector(236, y - 18, 270, y - 46, "defines target", -12),
    connector(460, y - 46, 498, y + 2, "clean samples", 14),
    connector(688, y + 2, 728, y - 44, "features", -14),
    connector(930, y - 44, 970, y + 2, "validated estimates", 14),
    connector(1080, y + 74, outputBox.x + outputBox.w / 2, outputBox.y, "supported use", 8, false, "vertical")
  ].join("\n");
  const blocksSvg = [...boxes.map(({ block, box }) => architectureBlock(box, block, fillFor(block), strokeFor(block), 28, 23, 6)), architectureBlock(outputBox, output, fillFor(output), strokeFor(output), 28, 23, 6)].join("\n");
  const assumption = `<rect x="58" y="${bodyTop + 348}" width="760" height="86" rx="12" fill="#ffffff" stroke="#d8d2c6"/>
    <text x="76" y="${bodyTop + 374}" font-family="Inter, Arial" font-size="13" font-weight="900" fill="#17202a">Statistical guardrails</text>
    <text x="76" y="${bodyTop + 398}" font-family="Inter, Arial" font-size="11" font-weight="700" fill="#586474">No invented sample size, metric value, causal claim, or confidence interval. Mark assumptions and uncertainty explicitly.</text>`;
  const legend = renderArchitectureLegend(diagram.legend ?? [], categoryColor, categoryStroke, 60, height - 48, width - 120);
  return `${lane}${arrows}${blocksSvg}${assumption}${legend}`;
}

function renderRecommenderSearchDiagram(diagram: ArchitectureDiagram, colors: string[], width: number, height: number) {
  const blocks = diagram.blocks;
  const byTitle = (pattern: RegExp) => blocks.find((block) => pattern.test(block.title));
  const signals = byTitle(/signals/i) ?? blocks[0];
  const retrieval = byTitle(/retrieval/i) ?? blocks[1];
  const ranking = byTitle(/Ranking/i) ?? blocks[2];
  const rerank = byTitle(/Re-ranking/i) ?? blocks[3];
  const served = byTitle(/Served/i) ?? blocks[4];
  const feedback = byTitle(/feedback/i) ?? blocks[5];
  const { categoryColor, categoryStroke, fillFor, strokeFor } = architectureColorMaps(diagram, colors);
  const bodyTop = 122;
  const signalBox = { x: 58, y: bodyTop + 112, w: 215, h: 142 };
  const retrievalBox = { x: 342, y: bodyTop + 52, w: 210, h: 142 };
  const rankingBox = { x: 620, y: bodyTop + 52, w: 210, h: 142 };
  const rerankBox = { x: 898, y: bodyTop + 52, w: 210, h: 142 };
  const servedBox = { x: 898, y: bodyTop + 268, w: 210, h: 126 };
  const feedbackBox = { x: 342, y: bodyTop + 300, w: 488, h: 106 };
  const lane = `<rect x="48" y="${bodyTop - 12}" width="${width - 96}" height="${height - bodyTop - 62}" rx="14" fill="#fbfaf6" stroke="#e3dccf"/>
    <text x="64" y="${bodyTop + 18}" font-family="Inter, Arial" font-size="12" font-weight="900" fill="#586474">Search / recommendation loop: signals -> retrieval -> ranking -> re-ranking -> served top-K -> online feedback</text>`;
  const arrows = [
    connector(signalBox.x + signalBox.w, signalBox.y + 50, retrievalBox.x, retrievalBox.y + 76, "intent + features", -12),
    connector(retrievalBox.x + retrievalBox.w, retrievalBox.y + 76, rankingBox.x, rankingBox.y + 76, "candidates", -14),
    connector(rankingBox.x + rankingBox.w, rankingBox.y + 76, rerankBox.x, rerankBox.y + 76, "scored list", -14),
    connector(rerankBox.x + rerankBox.w / 2, rerankBox.y + rerankBox.h, servedBox.x + servedBox.w / 2, servedBox.y, "top-K", 10, false, "vertical"),
    connector(servedBox.x, servedBox.y + 78, feedbackBox.x + feedbackBox.w, feedbackBox.y + 54, "behavior logs", 16),
    `<path d="M${feedbackBox.x} ${feedbackBox.y + 54} C210 ${feedbackBox.y + 54}, 170 ${signalBox.y + 150}, ${signalBox.x + 24} ${signalBox.y + 118}" fill="none" stroke="#4d5968" stroke-width="1.9" stroke-dasharray="6 6" marker-end="url(#arrow)"/>
     <rect x="172" y="${feedbackBox.y + 42}" width="112" height="17" rx="8.5" fill="#fffdf8" stroke="#d8d2c6"/>
     <text x="228" y="${feedbackBox.y + 54.5}" text-anchor="middle" font-family="Inter, Arial" font-size="9.2" font-weight="800" fill="#3a4654">training data</text>`
  ].join("\n");
  const blocksSvg = [
    architectureBlock(signalBox, signals, fillFor(signals), strokeFor(signals), 28, 23, 6),
    architectureBlock(retrievalBox, retrieval, fillFor(retrieval), strokeFor(retrieval), 28, 23, 6),
    architectureBlock(rankingBox, ranking, fillFor(ranking), strokeFor(ranking), 28, 23, 6),
    architectureBlock(rerankBox, rerank, fillFor(rerank), strokeFor(rerank), 28, 23, 6),
    architectureBlock(servedBox, served, fillFor(served), strokeFor(served), 28, 23, 6),
    architectureBlock(feedbackBox, feedback, fillFor(feedback), strokeFor(feedback), 28, 22, 6)
  ].join("\n");
  const legend = renderArchitectureLegend(diagram.legend ?? [], categoryColor, categoryStroke, 60, height - 48, width - 120);
  return `${lane}${arrows}${blocksSvg}${legend}`;
}

function renderVisionProcessingDiagram(diagram: ArchitectureDiagram, colors: string[], width: number, height: number) {
  const blocks = diagram.blocks;
  const byTitle = (pattern: RegExp) => blocks.find((block) => pattern.test(block.title));
  const input = byTitle(/input/i) ?? blocks[0];
  const preprocess = byTitle(/Preprocessing/i) ?? blocks[1];
  const backbone = blocks.find((block) => /backbone|U-Net|Visual encoder|Vision Transformer|CNN/i.test(block.title)) ?? blocks[2];
  const head = blocks.find((block) => /head|Prediction|Segmentation|Detection|Restoration/i.test(block.title)) ?? blocks[3];
  const evidence = byTitle(/Visual evidence/i) ?? blocks[4];
  const { categoryColor, categoryStroke, fillFor, strokeFor } = architectureColorMaps(diagram, colors);
  const bodyTop = 122;
  const inputBox = { x: 58, y: bodyTop + 176, w: 205, h: 132 };
  const prepBox = { x: 322, y: bodyTop + 176, w: 190, h: 132 };
  const backboneBox = { x: 580, y: bodyTop + 82, w: 244, h: 184 };
  const headBox = { x: 892, y: bodyTop + 142, w: 220, h: 142 };
  const evidenceBox = { x: 892, y: bodyTop + 330, w: 220, h: 114 };
  const lane = `<rect x="48" y="${bodyTop - 12}" width="${width - 96}" height="${height - bodyTop - 62}" rx="14" fill="#fbfaf6" stroke="#e3dccf"/>
    <text x="64" y="${bodyTop + 18}" font-family="Inter, Arial" font-size="12" font-weight="900" fill="#586474">Image processing / deep vision workflow: raw frames -> tensor preprocessing -> visual backbone -> task head -> visual evidence</text>`;
  const tensorStack = `<g opacity="0.92">
    <rect x="600" y="${bodyTop + 314}" width="72" height="42" rx="7" fill="#ffffff" stroke="#aab5c0"/>
    <rect x="628" y="${bodyTop + 332}" width="72" height="42" rx="7" fill="#ffffff" stroke="#aab5c0"/>
    <rect x="656" y="${bodyTop + 350}" width="72" height="42" rx="7" fill="#ffffff" stroke="#aab5c0"/>
    <text x="692" y="${bodyTop + 376}" text-anchor="middle" font-family="Inter, Arial" font-size="11" font-weight="900" fill="#586474">feature maps</text>
  </g>`;
  const arrows = [
    connector(inputBox.x + inputBox.w, inputBox.y + 66, prepBox.x, prepBox.y + 66, "frames", -14),
    connector(prepBox.x + prepBox.w, prepBox.y + 66, backboneBox.x, backboneBox.y + 92, "tensors", -14),
    connector(backboneBox.x + backboneBox.w, backboneBox.y + 92, headBox.x, headBox.y + 70, "visual features", -14),
    connector(headBox.x + headBox.w / 2, headBox.y + headBox.h, evidenceBox.x + evidenceBox.w / 2, evidenceBox.y, "metrics + examples", 10, false, "vertical")
  ].join("\n");
  const blocksSvg = [
    architectureBlock(inputBox, input, fillFor(input), strokeFor(input), 28, 23, 6),
    architectureBlock(prepBox, preprocess, fillFor(preprocess), strokeFor(preprocess), 28, 23, 6),
    architectureBlock(backboneBox, backbone, fillFor(backbone), strokeFor(backbone), 30, 25, 8),
    architectureBlock(headBox, head, fillFor(head), strokeFor(head), 28, 23, 6),
    architectureBlock(evidenceBox, evidence, fillFor(evidence), strokeFor(evidence), 28, 22, 6)
  ].join("\n");
  const legend = renderArchitectureLegend(diagram.legend ?? [], categoryColor, categoryStroke, 60, height - 48, width - 120);
  return `${lane}${arrows}${tensorStack}${blocksSvg}${legend}`;
}

function connector(x1: number, y1: number, x2: number, y2: number, label: string, labelOffsetY = 0, dashed = false, direction: "horizontal" | "vertical" = "horizontal") {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 + labelOffsetY;
  const path = direction === "vertical" ? `M${x1} ${y1} C${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}` : `M${x1} ${y1} C${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
  const short = trim(label, 24);
  const pillWidth = Math.min(150, short.length * 6 + 16);
  const labelX = direction === "vertical" ? x1 + 68 : midX;
  return `<path d="${path}" fill="none" stroke="#4d5968" stroke-width="1.9" ${dashed ? 'stroke-dasharray="5 5"' : ""} marker-end="url(#arrow)"/>
    <rect x="${labelX - pillWidth / 2}" y="${midY - 10}" width="${pillWidth}" height="17" rx="8.5" fill="#fffdf8" stroke="#d8d2c6"/>
    <text x="${labelX}" y="${midY + 2.5}" text-anchor="middle" font-family="Inter, Arial" font-size="9.2" font-weight="800" fill="#3a4654">${escapeHtml(short)}</text>`;
}

function architectureColorMaps(diagram: ArchitectureDiagram, colors: string[]) {
  const categoryColor = new Map<string, string>();
  const categoryStroke = new Map<string, string>();
  const orderedCategories = [...(diagram.legend ?? []).map((item) => item.category), ...diagram.blocks.map((block) => block.category ?? "default")];
  let cursor = 0;
  for (const category of orderedCategories) {
    if (categoryColor.has(category)) continue;
    const fill = colors[cursor % colors.length];
    categoryColor.set(category, fill);
    categoryStroke.set(category, darken(fill, 0.5));
    cursor += 1;
  }
  const fillFor = (block?: ArchitectureDiagram["blocks"][number]) => categoryColor.get(block?.category ?? "default") ?? colors[0];
  const strokeFor = (block?: ArchitectureDiagram["blocks"][number]) => categoryStroke.get(block?.category ?? "default") ?? "#52616f";
  return { categoryColor, categoryStroke, fillFor, strokeFor };
}

function architectureBlock(box: { x: number; y: number; w: number; h: number }, block: ArchitectureDiagram["blocks"][number], fill: string, stroke: string, headerHeight: number, chipHeight: number, chipGap: number) {
  const steps = block.substeps ?? [];
  const titleMax = Math.max(6, Math.floor((box.w - (block.abbrev ? 56 : 24)) / 7.4));
  const titleLines = wrapLabel(block.title, titleMax, 2);
  const titleStartY = box.y + headerHeight / 2 - ((titleLines.length - 1) * 15) / 2 + 4;
  const compact = box.w < 155;
  const titleText = titleLines.map((line, index) => `<text x="${box.x + 10}" y="${titleStartY + index * 15}" font-family="Inter, Arial" font-size="${compact ? 11.2 : 13}" font-weight="800" fill="#ffffff">${escapeHtml(line)}</text>`).join("\n");
  const abbrev = block.abbrev
    ? `<rect x="${box.x + box.w - 40}" y="${box.y + 7}" width="32" height="15" rx="7.5" fill="#ffffff" stroke="${stroke}"/>
       <text x="${box.x + box.w - 24}" y="${box.y + 18.5}" text-anchor="middle" font-family="Inter, Arial" font-size="8.5" font-weight="800" fill="${stroke}">${escapeHtml(trim(block.abbrev, 5))}</text>`
    : "";
  const chips = steps
    .map((step, index) => {
      const chipY = box.y + headerHeight + 12 + index * (chipHeight + chipGap);
      const chipMax = Math.max(6, Math.floor((box.w - 28) / 6.2));
      return `<rect x="${box.x + 12}" y="${chipY}" width="${box.w - 24}" height="${chipHeight}" rx="6" fill="#ffffff" stroke="#d8d2c6"/>
        <text x="${box.x + 20}" y="${chipY + chipHeight / 2 + 4}" font-family="Inter, Arial" font-size="${compact ? 9.4 : 11}" font-weight="600" fill="#2b3440">${escapeHtml(trim(step, chipMax))}</text>`;
    })
    .join("\n");
  return `<g filter="url(#cardshadow)">
    <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="13" fill="${fill}" stroke="${stroke}"/>
    <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${headerHeight}" rx="13" fill="${stroke}"/>
    <rect x="${box.x}" y="${box.y + headerHeight - 13}" width="${box.w}" height="13" fill="${fill}"/>
    ${titleText}
    ${abbrev}
    ${chips}
  </g>`;
}

function renderArchitectureLegend(legend: ArchitectureDiagram["legend"], categoryColor: Map<string, string>, categoryStroke: Map<string, string>, x: number, y: number, maxWidth: number) {
  const items = (legend ?? []).filter((item) => categoryColor.has(item.category)).slice(0, 6);
  if (!items.length) return "";
  let cursorX = x;
  const entries = items
    .map((item) => {
      const label = trim(item.label, 22);
      const swatch = `<rect x="${cursorX}" y="${y - 9}" width="13" height="13" rx="3" fill="${categoryColor.get(item.category)}" stroke="${categoryStroke.get(item.category)}"/>
        <text x="${cursorX + 19}" y="${y + 2}" font-family="Inter, Arial" font-size="11" font-weight="600" fill="#3a4654">${escapeHtml(label)}</text>`;
      cursorX += 19 + label.length * 7 + 22;
      return swatch;
    })
    .join("\n");
  void maxWidth;
  return entries;
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 3) {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  }
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function darken(hex: string, factor: number) {
  let clean = hex.replace("#", "").trim().toLowerCase();
  // Expand 3-digit shorthand (#abc → #aabbcc).
  if (/^[0-9a-f]{3}$/.test(clean)) clean = clean.replace(/(.)/g, "$1$1");
  // Anything that isn't a valid 6-digit hex → safe slate fallback (avoids #NaNNaNNaN).
  if (!/^[0-9a-f]{6}$/.test(clean)) return "#52616f";
  const channel = (start: number) => {
    const value = parseInt(clean.slice(start, start + 2), 16);
    return Math.round(value * factor + 31 * (1 - factor));
  };
  return `#${[channel(0), channel(2), channel(4)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function wrapLabel(value: string, max: number, maxLines = 3) {
  const normalized = value.replace(/\s+/g, " ").trim();
  let lines: string[];
  if (/[\u4e00-\u9fa5]/.test(normalized)) {
    const chunks = splitCjkLabel(normalized, max);
    lines = chunks.length ? chunks : [normalized];
  } else {
    const words = normalized.split(/\s+/);
    lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > max && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
    if (!lines.length) lines = [normalized];
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(kept[maxLines - 1], max);
    return kept;
  }
  return lines.map((line) => (line.length > max ? ellipsize(line, max) : line));
}

function ellipsize(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 1)).trimEnd()}...`;
}

function splitCjkLabel(value: string, max: number) {
  const parts = value
    .split(/(、|，|,|\/|和|及|以及|与|通过|随后|输出|输入|用于)/)
    .reduce<string[]>((acc, part) => {
      if (!part) return acc;
      if (["、", "，", ",", "/", "和", "及", "以及", "与"].includes(part)) return acc;
      const previous = acc[acc.length - 1] ?? "";
      if (previous && previous.length + part.length <= max) {
        acc[acc.length - 1] = previous + part;
      } else {
        acc.push(part);
      }
      return acc;
    }, []);
  const lines: string[] = [];
  for (const part of parts.length ? parts : [value]) {
    let rest = part;
    while (rest.length > max) {
      lines.push(rest.slice(0, max));
      rest = rest.slice(max);
    }
    if (rest) lines.push(rest);
  }
  return lines;
}

function trim(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}
