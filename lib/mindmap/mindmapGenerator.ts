import { MindmapNode, MindmapResult, PaperStructure } from "../types";
import { hashId, escapeHtml } from "../utils";
import { planMindmapWithLlm } from "../providers/llmProviders";
import { paletteFills } from "../palettes";

export async function generateMindmap(
  text: string,
  sourceName: string | undefined,
  parser: MindmapResult["parser"]
): Promise<MindmapResult> {
  const fallback = buildFallbackMindmap(text, sourceName);
  const llm = await planMindmapWithLlm(text, fallback.structure);
  const outline = llm.ok ? llm.outline : fallback.outline;
  const title = outline.title || fallback.outline.title;

  return {
    id: hashId("mindmap"),
    createdAt: new Date().toISOString(),
    sourceName,
    parser,
    planner: {
      status: llm.ok ? "llm" : "fallback",
      provider: llm.provider,
      message: llm.message
    },
    title,
    outline,
    markdown: toMarkdown(outline),
    mermaid: toMermaid(outline),
    svg: renderMindmapSvg(outline)
  };
}

function buildFallbackMindmap(text: string, sourceName?: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => line.length > 8 && line.length < 120) || sourceName || "论文导图";
  const structure: PaperStructure = {
    title,
    abstract: pick(text, ["abstract", "摘要"], 700) || lines.slice(0, 4).join(" "),
    methods: splitSections(pick(text, ["method", "methods", "方法"], 900) || text.slice(0, 900), "方法"),
    results: splitSections(pick(text, ["result", "results", "结果", "experiment"], 900) || text.slice(-900), "结果"),
    keywords: extractKeywords(text),
    limitations: splitSections(pick(text, ["limitation", "discussion", "局限", "讨论"], 500) || "", "讨论").map((item) => item.content)
  };
  const outline: MindmapNode = {
    id: "root",
    title,
    summary: structure.abstract.slice(0, 180),
    children: [
      node("research-question", "研究问题", structure.abstract),
      node("method", "方法路线", structure.methods.map((item) => item.content).join("；")),
      node("experiment", "实验与证据", structure.results.map((item) => item.content).join("；")),
      node("keywords", "关键词", structure.keywords.join("、")),
      node("limitations", "讨论与局限", structure.limitations.join("；") || "需要人工复核论文细节")
    ]
  };
  return { structure, outline };
}

function node(id: string, title: string, summary: string): MindmapNode {
  const parts = summary
    .split(/[。.!?；;]\s*/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  return {
    id,
    title,
    summary: summary.slice(0, 180),
    children: parts.map((part, index) => ({
      id: `${id}-${index + 1}`,
      title: part.slice(0, 28),
      summary: part,
      children: []
    }))
  };
}

function pick(text: string, markers: string[], max: number) {
  const lower = text.toLowerCase();
  const index = markers.map((marker) => lower.indexOf(marker.toLowerCase())).find((pos) => pos >= 0);
  if (index === undefined) return "";
  return text.slice(index, index + max).replace(/\s+/g, " ").trim();
}

function splitSections(value: string, prefix: string) {
  return value
    .split(/[。.!?；;]\s*/)
    .map((content) => content.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((content, index) => ({ title: `${prefix} ${index + 1}`, content }));
}

function extractKeywords(text: string) {
  const tokens = text
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length > 2);
  const ranked = new Map<string, number>();
  for (const token of tokens) ranked.set(token, (ranked.get(token) || 0) + 1);
  return [...ranked.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([token]) => token);
}

// Render the outline as a balanced XMind-style mind map: a dark root node in the
// center with colored top-level branches fanning out to BOTH sides (assigned to
// whichever side is currently shorter, so the two halves stay even), each with
// light leaf pills further out, joined by curved connectors.
// Render the outline as a ChatPaper2Xmind-style right-expanding logic tree
// (root on the left -> section nodes stacked vertically -> detail leaves with
// wrapped text), joined by clean orthogonal "bracket" connectors. Matches the
// paper-to-mindmap reference layout.
export function renderMindmapSvg(root: MindmapNode, palette = "journal-balanced") {
  const colors = paletteFills(palette);
  const ROOT_X = 40;
  const ROOT_W = 212;
  const SEC_X = 300;
  const SEC_W = 198;
  const LEAF_X = 540;
  const LEAF_W = 452;
  const padTop = 46;
  const padBottom = 40;
  const leafGap = 12;
  const sectionGap = 16;

  type LeafLayout = { title: string; summaryLines: string[]; top: number; h: number; cy: number };
  type SectionLayout = { title: string; accent: string; stroke: string; cy: number; top: number; h: number; leaves: LeafLayout[] };

  const leafTitleMax = 30;
  const leafBodyMaxCjk = 30;
  const leafBodyMaxLatin = 66;
  const bodyMax = (text: string) => (/[一-龥]/.test(text) ? leafBodyMaxCjk : leafBodyMaxLatin);
  const leafHeight = (summaryLines: number) => 16 + 18 + summaryLines * 15 + 10;

  let cursorY = padTop;
  const sections: SectionLayout[] = root.children.slice(0, 9).map((section, index) => {
    const accent = colors[index % colors.length];
    const stroke = mixToInk(accent);
    const rawLeaves = section.children.slice(0, 6);
    const leaves: LeafLayout[] = rawLeaves.map((leaf) => {
      const summaryLines = leaf.summary ? wrapLines(leaf.summary, bodyMax(leaf.summary), 2) : [];
      const h = leafHeight(summaryLines.length);
      const top = cursorY;
      cursorY += h + leafGap;
      return { title: truncateMindmap(leaf.title, leafTitleMax), summaryLines, top, h, cy: top + h / 2 };
    });
    if (!leaves.length) {
      // Section with no children still occupies a row.
      const h = leafHeight(0);
      const top = cursorY;
      cursorY += h + leafGap;
      const cy = top + h / 2;
      return { title: section.title, accent, stroke, cy, top, h, leaves: [] };
    }
    const cy = (leaves[0].cy + leaves[leaves.length - 1].cy) / 2;
    cursorY += sectionGap;
    return { title: section.title, accent, stroke, cy, top: leaves[0].top, h: leaves[leaves.length - 1].top + leaves[leaves.length - 1].h - leaves[0].top, leaves };
  });

  const contentBottom = cursorY;
  const height = Math.max(300, contentBottom + padBottom);
  const width = LEAF_X + LEAF_W + 40;
  const rootCenterY = sections.length ? (sections[0].cy + sections[sections.length - 1].cy) / 2 : height / 2;

  const connectors: string[] = [];
  const body: string[] = [];
  const rootEdgeX = ROOT_X + ROOT_W;
  const rootBusX = (rootEdgeX + SEC_X) / 2;
  const secEdgeX = SEC_X + SEC_W;
  const secBusX = (secEdgeX + LEAF_X) / 2;

  for (const section of sections) {
    // root -> section bracket connector
    connectors.push(elbow(rootEdgeX, rootCenterY, rootBusX, section.cy, SEC_X, section.stroke, 2));
    // section pill
    const secH = 38;
    body.push(`<g filter="url(#mmshadow)">
      <rect x="${SEC_X}" y="${(section.cy - secH / 2).toFixed(1)}" width="${SEC_W}" height="${secH}" rx="10" fill="${section.accent}" stroke="${section.stroke}"/>
      <rect x="${SEC_X}" y="${(section.cy - secH / 2).toFixed(1)}" width="5" height="${secH}" rx="2.5" fill="${section.stroke}"/>
      <text x="${SEC_X + 16}" y="${(section.cy + 4.5).toFixed(1)}" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#1f2933">${escapeHtml(truncateMindmap(section.title, 16))}</text>
    </g>`);

    for (const leaf of section.leaves) {
      connectors.push(elbow(secEdgeX, section.cy, secBusX, leaf.cy, LEAF_X, section.stroke, 1.4));
      const summary = leaf.summaryLines
        .map((line, index) => `<text x="${LEAF_X + 16}" y="${(leaf.top + 36 + index * 15).toFixed(1)}" font-family="Inter, Arial" font-size="11.5" fill="#586474">${escapeHtml(line)}</text>`)
        .join("\n");
      body.push(`<g filter="url(#mmshadow)">
        <rect x="${LEAF_X}" y="${leaf.top.toFixed(1)}" width="${LEAF_W}" height="${leaf.h.toFixed(1)}" rx="9" fill="#ffffff" stroke="#e4ddcd"/>
        <rect x="${LEAF_X}" y="${leaf.top.toFixed(1)}" width="4" height="${leaf.h.toFixed(1)}" rx="2" fill="${section.accent}"/>
        <text x="${LEAF_X + 16}" y="${(leaf.top + 19).toFixed(1)}" font-family="Inter, Arial" font-size="13" font-weight="800" fill="#1f2933">${escapeHtml(leaf.title)}</text>
        ${summary}
      </g>`);
    }
  }

  const rootH = 78;
  const rootCard = `<g filter="url(#mmshadow)">
    <rect x="${ROOT_X}" y="${(rootCenterY - rootH / 2).toFixed(1)}" width="${ROOT_W}" height="${rootH}" rx="14" fill="#1f2933"/>
    ${wrapSvgText(root.title, ROOT_X + ROOT_W / 2, rootCenterY, 16, "#ffffff", 14, 4, "middle")}
  </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <filter id="mmshadow" x="-10%" y="-12%" width="120%" height="130%">
        <feDropShadow dx="0" dy="1.5" stdDeviation="2" flood-color="#1f2933" flood-opacity="0.12"/>
      </filter>
    </defs>
    <rect width="${width}" height="${height}" fill="#f7f5ef"/>
    <rect x="16" y="16" width="${width - 32}" height="${height - 32}" rx="16" fill="#fffdf8" stroke="#e4ddcd"/>
    ${connectors.join("\n")}
    ${body.join("\n")}
    ${rootCard}
  </svg>`;
}

// Orthogonal "bracket" connector: out from the parent edge, along a vertical
// bus, then into the child's left edge.
function elbow(x1: number, y1: number, busX: number, y2: number, x2: number, stroke: string, strokeWidth: number) {
  return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} H${busX.toFixed(1)} V${y2.toFixed(1)} H${x2.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="0.7"/>`;
}

function wrapLines(text: string, maxChars: number, maxLines: number) {
  const value = (text || "").replace(/\s+/g, " ").trim();
  if (!value) return [];
  const lines: string[] = [];
  if (/[一-龥]/.test(value)) {
    let rest = value;
    while (rest.length > maxChars && lines.length < maxLines - 1) {
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    lines.push(rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest);
  } else {
    const words = value.split(" ");
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
        if (lines.length >= maxLines) break;
      } else {
        current = next;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (lines.length === maxLines && current && lines[maxLines - 1] !== current) {
      lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, Math.max(1, maxChars - 1))}…`;
    }
  }
  return lines.slice(0, maxLines);
}

function wrapSvgText(value: string, centerX: number, centerY: number, maxChars: number, fill: string, fontSize: number, maxLines: number, anchor: string) {
  const text = value.replace(/\s+/g, " ").trim();
  const lines: string[] = [];
  if (/[一-龥]/.test(text)) {
    let rest = text;
    while (rest.length > maxChars && lines.length < maxLines - 1) {
      const cut = safeCjkCut(rest, maxChars);
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    lines.push(rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest);
  } else {
    const words = text.split(" ");
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        lines.push(current);
        current = word;
        if (lines.length >= maxLines - 1) break;
      } else {
        current = next;
      }
    }
    lines.push(current || text.slice(0, maxChars));
  }
  const startY = centerY - ((lines.length - 1) * (fontSize + 2)) / 2 + fontSize / 2 - 1;
  return lines
    .slice(0, maxLines)
    .map((line, index) => `<text x="${centerX}" y="${startY + index * (fontSize + 2)}" text-anchor="${anchor}" font-family="Inter, Arial" font-size="${fontSize}" font-weight="800" fill="${fill}">${escapeHtml(line)}</text>`)
    .join("\n");
}

// Pick a wrap point at or before `max` that does not fall inside a Latin/number
// word, so "Transformer" never splits into "Transform" + "er".
function safeCjkCut(value: string, max: number) {
  if (/[A-Za-z0-9]/.test(value[max - 1] ?? "") && /[A-Za-z0-9]/.test(value[max] ?? "")) {
    let back = max;
    while (back > Math.ceil(max / 2) && /[A-Za-z0-9]/.test(value[back - 1] ?? "")) back -= 1;
    if (back > Math.ceil(max / 2)) return back;
  }
  return max;
}

function truncateMindmap(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Darken a light palette tint toward ink for legible strokes/connectors.
function mixToInk(hex: string) {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "#52616f";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const factor = 0.55;
  const mix = (channel: number) => Math.round(channel * factor + 31 * (1 - factor));
  return `#${[mix(r), mix(g), mix(b)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function toMarkdown(root: MindmapNode) {
  const lines: string[] = [];
  walkMarkdown(root, 0, lines);
  return lines.join("\n");
}

function walkMarkdown(node: MindmapNode, depth: number, lines: string[]) {
  lines.push(`${"  ".repeat(depth)}- ${node.title}${node.summary ? `：${node.summary}` : ""}`);
  for (const child of node.children) walkMarkdown(child, depth + 1, lines);
}

function toMermaid(root: MindmapNode) {
  const lines = ["mindmap", `  root((${escapeMindmap(root.title)}))`];
  walkMermaid(root.children, 2, lines);
  return lines.join("\n");
}

function walkMermaid(nodes: MindmapNode[], depth: number, lines: string[]) {
  for (const node of nodes) {
    lines.push(`${"  ".repeat(depth)}${escapeMindmap(node.title)}`);
    walkMermaid(node.children, depth + 1, lines);
  }
}

function escapeMindmap(value: string) {
  return value.replace(/[()]/g, "").slice(0, 42) || "节点";
}
