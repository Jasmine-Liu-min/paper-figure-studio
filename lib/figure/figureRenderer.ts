import { FigureSpec, FigureType } from "../types";
import { escapeHtml } from "../utils";
import { paletteFills } from "../palettes";
import {
  isDomainTemplateDiagram as isDomainTemplateArchitecture,
  renderArchitectureDiagram as renderArchitectureSvg
} from "./renderers/architectureRenderer";

export function buildMermaid(modules: string[], variant: number, figureType?: FigureType) {
  const safeModules = modules.length ? modules : ["Research Problem", "Method", "Evidence", "Output"];
  if (figureType === "comparison") {
    return `flowchart LR\n  A[Baseline] --> C[Evaluation]\n  B[Proposed Method] --> C\n  C --> D[Evidence]\n  D --> E[Conclusion]`;
  }
  if (figureType === "timeline") {
    return `timeline\n  title Research Timeline\n${safeModules.map((module, index) => `  Phase ${index + 1} : ${module}`).join("\n")}`;
  }
  if (figureType === "mechanism") {
    return `flowchart TD\n  A[Trigger] --> B[Mechanism]\n  B --> C[Intermediate State]\n  C --> D[Observed Outcome]\n  D -. feedback .-> B`;
  }
  if (variant === 1) {
    const center = safeModules[2] ?? "Method";
    return `flowchart TD\n  A[${safeModules[0]}] --> C[${center}]\n  B[${safeModules[1] ?? "Data"}] --> C\n  C --> D[${safeModules[3] ?? "Evidence"}]\n  C --> E[${safeModules[4] ?? "Impact"}]\n  D --> F[${safeModules[5] ?? "Output"}]`;
  }
  const direction = variant === 2 ? "TB" : "LR";
  return `flowchart ${direction}\n${safeModules
    .map((module, index) => `  N${index + 1}[${module}]${index < safeModules.length - 1 ? ` --> N${index + 2}` : ""}`)
    .join("\n")}`;
}

export function renderFigureSvg(title: string, modules: string[], palette: string, aspectRatio: string, variant: number, figureType?: FigureType, spec?: FigureSpec) {
  const canvas = usesArchitecture(spec)
    ? isDomainTemplateArchitecture(spec!.architecture!.blocks)
      ? architectureCanvasSize(aspectRatio)
      : dagreCanvasSize(aspectRatio)
    : canvasSize(aspectRatio);
  const safeModules = modules.filter(Boolean).slice(0, 8);
  const colors = paletteColors(palette);
  const template = figureType ?? inferFigureType(title, variant);

  const body = spec
    ? renderSpecFigure(spec, colors, canvas.width, canvas.height, variant)
    : template === "experiment-flow"
      ? renderExperimentFlow(safeModules, colors, canvas.width, canvas.height)
      : template === "graphical-abstract"
        ? renderGraphicalAbstract(safeModules, colors, canvas.width, canvas.height)
        : template === "mechanism"
          ? renderMechanism(safeModules, colors, canvas.width, canvas.height)
          : template === "comparison"
            ? renderComparison(safeModules, colors, canvas.width, canvas.height)
            : template === "timeline"
              ? renderTimeline(safeModules, colors, canvas.width, canvas.height)
              : renderMethodFramework(safeModules, colors, canvas.width, canvas.height);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
    ${defs()}
    <rect width="${canvas.width}" height="${canvas.height}" fill="#f7f5ef"/>
    <rect x="28" y="24" width="${canvas.width - 56}" height="${canvas.height - 48}" rx="14" fill="#fffdf8" stroke="#ded8ca"/>
    <text x="48" y="62" font-family="Inter, Arial" font-size="${usesArchitecture(spec) ? 23 : 27}" font-weight="800" fill="#17202a">${escapeHtml(trim(title, usesArchitecture(spec) ? 48 : 54))}</text>
    <text x="48" y="91" font-family="Inter, Arial" font-size="12" fill="#586474">${escapeHtml(spec?.layoutIntent.slice(0, usesArchitecture(spec) ? 92 : 110) ?? labelForTemplate(template))}</text>
    ${body}
  </svg>`;
}

function usesArchitecture(spec?: FigureSpec) {
  return (
    !!spec?.architecture &&
    spec.architecture.blocks.length >= 2 &&
    (spec.figureType === "method-framework" || spec.figureType === "neural-network" || spec.figureType === "data-pipeline")
  );
}

function renderSpecFigure(spec: FigureSpec, colors: string[], width: number, height: number, variant: number) {
  if (usesArchitecture(spec)) {
    return renderArchitectureSvg(spec.architecture!, colors, width, height);
  }
  if (spec.figureType === "graphical-abstract") return renderSpecRadial(spec, colors, width, height);
  if (spec.figureType === "comparison") return renderSpecComparison(spec, colors, width, height);
  if (spec.figureType === "timeline") return renderSpecTimeline(spec, colors, width, height);
  if (spec.figureType === "mechanism") return renderSpecMechanism(spec, colors, width, height);
  if (spec.figureType === "experiment-flow") return renderSpecProtocol(spec, colors, width, height);
  if (spec.figureType === "neural-network") return renderSpecArchitecture(spec, colors, width, height);
  if (spec.figureType === "data-pipeline") return renderSpecPipeline(spec, colors, width, height);
  return renderSpecMethodFramework(spec, colors, width, height);
}

function renderSpecPipeline(spec: FigureSpec, colors: string[], width: number, height: number) {
  return renderSpecMethodFramework(spec, colors, width, height, "Data / Pipeline");
}

function renderSpecMethodFramework(spec: FigureSpec, colors: string[], width: number, height: number, heading = "Method framework") {
  const objects = selectReadableObjects(spec.objects, 9);
  const groups = groupObjectsForFramework(objects);
  const left = 58;
  const top = 132;
  const stageGap = 18;
  const stageCount = groups.length;
  const stageWidth = (width - left * 2 - stageGap * (stageCount - 1)) / stageCount;
  const stageHeight = height - 258;
  const stageLabels = ["Inputs", "Feature extraction", "Fusion / reasoning", "Outputs"];
  const stageSubtitles = ["modalities / evidence", "encoders / features", "fusion core", "clinical outputs"];
  const stageFills = ["#eef6fb", "#f8efe7", "#eef7ef", "#f7f0fb"];
  const cardLayouts: Array<{ object: FigureSpec["objects"][number]; stageIndex: number; x: number; y: number; w: number; h: number }> = [];
  const stagePanels = groups
    .map((group, stageIndex) => {
      const x = left + stageIndex * (stageWidth + stageGap);
      const cardHeight = group.length >= 3 ? 64 : group.length > 1 ? 74 : 90;
      const cardGap = group.length >= 3 ? 9 : 12;
      const startY = top + 62 + Math.max(0, (stageHeight - 82 - group.length * cardHeight - (group.length - 1) * cardGap) / 2);
      group.forEach((object, itemIndex) => {
        cardLayouts.push({
          object,
          stageIndex,
          x: x + 14,
          y: startY + itemIndex * (cardHeight + cardGap),
          w: stageWidth - 28,
          h: cardHeight
        });
      });
      return `<rect x="${x}" y="${top}" width="${stageWidth}" height="${stageHeight}" rx="12" fill="${stageFills[stageIndex]}" stroke="#d7d2c8"/>
        <text x="${x + 16}" y="${top + 26}" font-family="Inter, Arial" font-size="13" font-weight="900" fill="#17202a">${stageIndex + 1}. ${stageLabels[stageIndex]}</text>
        <text x="${x + 16}" y="${top + 45}" font-family="Inter, Arial" font-size="10.5" font-weight="700" fill="#64748b">${stageSubtitles[stageIndex]}</text>`;
    })
    .join("\n");
  // Draw one clean forward connector between adjacent non-empty stage columns
  // instead of the LLM's per-object arrows (which crisscrossed as dashed lines).
  const midY = top + stageHeight / 2;
  const objectArrows = groups
    .map((group, stageIndex) => {
      if (stageIndex >= groups.length - 1 || !group.length || !groups[stageIndex + 1].length) return "";
      const xEnd = left + stageIndex * (stageWidth + stageGap) + stageWidth;
      const xNext = left + (stageIndex + 1) * (stageWidth + stageGap);
      return arrow(xEnd + 3, midY, xNext - 3, midY);
    })
    .join("\n");
  const cards = cardLayouts
    .map((layout, index) => {
      const risk = spec.evidenceMapping.find((mapping) => mapping.targetId === layout.object.id)?.risk ?? "high";
      return `${moduleCard(layout.x, layout.y, layout.w, layout.h, layout.object.label, semanticIconForObject(layout.object), colors[(layout.stageIndex + index) % colors.length], semanticSubtitleForObject(layout.object))}
        ${evidenceBadge(layout.x + layout.w - 14, layout.y + 16, risk)}`;
    })
    .join("\n");
  return `
    ${panelBand(48, 112, width - 96, heading, "#e9f1f7", "#315c9f")}
    ${stagePanels}
    ${objectArrows}
    ${cards}
    ${evidenceStrip(spec, width, height)}`;
}

function renderSpecArchitecture(spec: FigureSpec, colors: string[], width: number, height: number) {
  const objects = spec.objects.slice(0, 6);
  const cardH = 72;
  const blocks = objects
    .map((object, index) => {
      const point = objectPoint(object, width, height, index, objects.length);
      const x = point.x - 89;
      const y = point.y - cardH / 2;
      const prev = index > 0 ? objectPoint(objects[index - 1], width, height, index - 1, objects.length) : null;
      return `${prev ? arrow(prev.x + 92, prev.y, x - 8, point.y) : ""}
      ${moduleCard(x, y, 178, cardH, object.label, object.kind, colors[index % colors.length])}`;
    })
    .join("\n");
  const panelText = spec.panels.slice(0, 4).map((panel, index) => `<text x="${width - 286}" y="${170 + index * 42}" font-family="Inter, Arial" font-size="12" font-weight="700" fill="#586474">${escapeHtml(trim(panel.title, 28))}</text>`).join("\n");
  return `${blocks}
    <rect x="${width - 310}" y="136" width="250" height="${height - 246}" rx="12" fill="#f7f9fb" stroke="#d0d5dd"/>
    <text x="${width - 286}" y="156" font-family="Inter, Arial" font-size="13" font-weight="800" fill="#17202a">Spec panels</text>
    ${panelText}
    ${evidenceStrip(spec, width, height)}`;
}

function renderSpecProtocol(spec: FigureSpec, colors: string[], width: number, height: number) {
  const objects = spec.objects.slice(0, 6);
  const steps = objects
    .map((object, index) => {
      const point = objectPoint(object, width, height, index, objects.length);
      const badgeX = Math.max(76, point.x - 205);
      const y = point.y;
      const prev = index > 0 ? objectPoint(objects[index - 1], width, height, index - 1, objects.length) : null;
      return `${prev ? `<path d="M${badgeX} ${prev.y + 28} L${badgeX} ${y - 28}" stroke="#17202a" stroke-width="2" marker-end="url(#arrow)"/>` : ""}
      <circle cx="${badgeX}" cy="${y}" r="24" fill="${colors[index % colors.length]}" stroke="#17202a"/>
      <text x="${badgeX}" y="${y + 5}" text-anchor="middle" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#17202a">${index + 1}</text>
      ${moduleCard(badgeX + 48, y - 35, width - 245, 70, object.label, object.kind, "#ffffff")}`;
    })
    .join("\n");
  return `${steps}
    <rect x="${width - 142}" y="140" width="86" height="${height - 238}" rx="10" fill="#fff2bf" stroke="#e2c85d"/>
    <text x="${width - 99}" y="174" text-anchor="middle" font-family="Inter, Arial" font-size="12" font-weight="800" fill="#17202a">controls</text>
    <text x="${width - 99}" y="${height - 122}" text-anchor="middle" font-family="Inter, Arial" font-size="12" font-weight="800" fill="#17202a">readout</text>`;
}

function renderSpecRadial(spec: FigureSpec, colors: string[], width: number, height: number) {
  const objects = spec.objects.slice(0, 6);
  const centerX = width / 2;
  const centerY = height / 2 + 18;
  const orbit = objects
    .map((object, index) => {
      const point = objectPoint(object, width, height, index, objects.length);
      const x = point.x - 82;
      const y = point.y - 44;
      return `${arrow(x + 82, y + 44, centerX, centerY, "soft")}
      ${moduleCard(x, y, 164, 88, object.label, object.kind, colors[index % colors.length])}`;
    })
    .join("\n");
  return `${orbit}
    <ellipse cx="${centerX}" cy="${centerY}" rx="118" ry="76" fill="#ffffff" stroke="#17202a" stroke-width="2"/>
    <text x="${centerX}" y="${centerY - 12}" text-anchor="middle" font-family="Inter, Arial" font-size="17" font-weight="800" fill="#17202a">Supported</text>
    <text x="${centerX}" y="${centerY + 14}" text-anchor="middle" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#4b6f53">Contribution</text>`;
}

function renderSpecMechanism(spec: FigureSpec, colors: string[], width: number, height: number) {
  const objects = spec.objects.slice(0, 5);
  const nodes = objects
    .map((object, index) => {
      const point = objectPoint(object, width, height, index, objects.length);
      const cardW = index === objects.length - 1 ? 174 : 166;
      return moduleCard(point.x - cardW / 2, point.y - 42, cardW, 84, object.label, object.kind, colors[index % colors.length]);
    })
    .join("\n");
  const arrows = objects
    .slice(0, -1)
    .map((object, index) => {
      const from = objectPoint(object, width, height, index, objects.length);
      const to = objectPoint(objects[index + 1], width, height, index + 1, objects.length);
      return arrow(from.x + 74, from.y, to.x - 82, to.y);
    })
    .join("\n");
  return `${nodes}
    ${arrows}
    <text x="${width / 2}" y="${height - 60}" text-anchor="middle" font-family="Inter, Arial" font-size="13" font-weight="700" fill="#c96850">dashed or uncertain links require source verification</text>`;
}

function renderSpecComparison(spec: FigureSpec, colors: string[], width: number, height: number) {
  const objects = spec.objects.slice(0, 6);
  const colW = (width - 150) / 2;
  const cards = objects
    .map((object, index) => {
      const point = objectPoint(object, width, height, index, objects.length);
      const inLeft = point.x < width / 2;
      const x = inLeft ? Math.max(78, point.x - (colW - 40) / 2) : Math.max(width / 2 + 38, point.x - (colW - 40) / 2);
      return moduleCard(x, point.y - 39, colW - 40, 78, object.label, object.kind, inLeft ? "#ffffff" : colors[(index + 2) % colors.length]);
    })
    .join("\n");
  return `
    <text x="70" y="145" font-family="Inter, Arial" font-size="16" font-weight="800" fill="#586474">Baseline / Context</text>
    <text x="${width / 2 + 30}" y="145" font-family="Inter, Arial" font-size="16" font-weight="800" fill="#4b6f53">Proposed / Evidence</text>
    <rect x="58" y="164" width="${colW}" height="${height - 270}" rx="12" fill="#f1f3f5" stroke="#d0d5dd"/>
    <rect x="${width / 2 + 18}" y="164" width="${colW}" height="${height - 270}" rx="12" fill="#eef5ec" stroke="#c7dbc9"/>
    ${cards}
    ${evidenceStrip(spec, width, height)}`;
}

function renderSpecTimeline(spec: FigureSpec, colors: string[], width: number, height: number) {
  const objects = spec.objects.slice(0, 6);
  const y = height / 2 + 10;
  const xs = objects.map((object, index) => objectPoint(object, width, height, index, objects.length).x);
  const start = Math.min(...xs, 78);
  const end = Math.max(...xs, width - 82);
  const nodes = objects
    .map((object, index) => {
      const point = objectPoint(object, width, height, index, objects.length);
      const x = point.x;
      const cardY = index % 2 === 0 ? y - 134 : y + 38;
      return `<circle cx="${x}" cy="${y}" r="16" fill="${colors[index % colors.length]}" stroke="#17202a" stroke-width="2"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Inter, Arial" font-size="12" font-weight="800" fill="#17202a">${index + 1}</text>
      ${moduleCard(x - 70, cardY, 140, 82, object.label, object.kind, "#ffffff")}`;
    })
    .join("\n");
  return `<path d="M${start} ${y} L${end} ${y}" stroke="#17202a" stroke-width="3" marker-end="url(#arrow)"/>
    ${nodes}`;
}

function renderMethodFramework(modules: string[], colors: string[], width: number, height: number) {
  const safe = fillModules(modules, ["Problem", "Data", "Preprocess", "Model", "Evidence", "Output"]);
  const y = height / 2 - 42;
  const cardWidth = Math.min(132, Math.floor((width - 150) / safe.length));
  const gap = Math.floor((width - 96 - cardWidth * safe.length) / Math.max(safe.length - 1, 1));
  const cards = safe
    .map((module, index) => {
      const x = 48 + index * (cardWidth + gap);
      return `${index > 0 ? arrow(x - gap + 18, y + 48, x - 10, y + 48) : ""}
      ${moduleCard(x, y, cardWidth, 116, module, scientificIcon(index), colors[index % colors.length])}`;
    })
    .join("\n");
  return `
    <rect x="48" y="120" width="${width - 96}" height="54" rx="8" fill="#e9f1f7"/>
    <text x="66" y="153" font-family="Inter, Arial" font-size="15" font-weight="700" fill="#315c9f">Research question and input evidence</text>
    ${cards}
    <rect x="48" y="${height - 112}" width="${width - 96}" height="44" rx="8" fill="#eef5ec"/>
    <text x="66" y="${height - 84}" font-family="Inter, Arial" font-size="14" font-weight="700" fill="#4b6f53">Publication-ready figure narrative: problem -> method -> evidence -> contribution</text>`;
}

function renderExperimentFlow(modules: string[], colors: string[], width: number, height: number) {
  const safe = fillModules(modules, ["Sample", "Protocol", "Intervention", "Measurement", "Analysis", "Validation"]);
  const left = 92;
  const top = 136;
  const stepGap = Math.floor((height - 230) / Math.max(safe.length - 1, 1));
  const steps = safe
    .map((module, index) => {
      const y = top + index * stepGap;
      return `
      ${index > 0 ? `<path d="M${left} ${y - stepGap + 58} L${left} ${y - 18}" stroke="#17202a" stroke-width="2" marker-end="url(#arrow)"/>` : ""}
      <circle cx="${left}" cy="${y}" r="24" fill="${colors[index % colors.length]}" stroke="#17202a"/>
      <text x="${left}" y="${y + 5}" text-anchor="middle" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#17202a">${index + 1}</text>
      ${moduleCard(left + 46, y - 35, width - 210, 70, module, scientificIcon(index), "#ffffff")}`;
    })
    .join("\n");
  return `${steps}
    <rect x="${width - 136}" y="140" width="86" height="${height - 240}" rx="10" fill="#f8e7a2" opacity="0.65"/>
    <text x="${width - 93}" y="176" text-anchor="middle" font-family="Inter, Arial" font-size="13" font-weight="800" fill="#17202a">Controls</text>
    <text x="${width - 93}" y="${height - 122}" text-anchor="middle" font-family="Inter, Arial" font-size="13" font-weight="800" fill="#17202a">Readout</text>`;
}

function renderGraphicalAbstract(modules: string[], colors: string[], width: number, height: number) {
  const safe = fillModules(modules, ["Problem", "Data", "Method", "Evidence", "Impact"]);
  const centerX = width / 2;
  const centerY = height / 2 + 12;
  const radiusX = Math.min(300, width * 0.34);
  const radiusY = Math.min(170, height * 0.25);
  const orbit = safe
    .map((module, index) => {
      const angle = (-90 + (360 / safe.length) * index) * (Math.PI / 180);
      const x = centerX + Math.cos(angle) * radiusX - 78;
      const y = centerY + Math.sin(angle) * radiusY - 44;
      return `${arrow(x + 78, y + 44, centerX + Math.cos(angle) * 70, centerY + Math.sin(angle) * 44, "soft")}
      ${moduleCard(x, y, 156, 88, module, scientificIcon(index), colors[index % colors.length])}`;
    })
    .join("\n");
  return `${orbit}
    <ellipse cx="${centerX}" cy="${centerY}" rx="112" ry="72" fill="#ffffff" stroke="#17202a" stroke-width="2"/>
    <text x="${centerX}" y="${centerY - 12}" text-anchor="middle" font-family="Inter, Arial" font-size="18" font-weight="800" fill="#17202a">Core</text>
    <text x="${centerX}" y="${centerY + 14}" text-anchor="middle" font-family="Inter, Arial" font-size="15" font-weight="700" fill="#4b6f53">Contribution</text>`;
}

function renderMechanism(modules: string[], colors: string[], width: number, height: number) {
  const safe = fillModules(modules, ["Stimulus", "Pathway", "Mediator", "State change", "Outcome"]);
  const x0 = 78;
  const y0 = height / 2 - 30;
  const x1 = width - 220;
  const y1 = y0;
  const midX = width / 2 - 70;
  const nodes = [
    moduleCard(x0, y0, 150, 88, safe[0], "trigger", colors[0]),
    moduleCard(midX - 100, y0 - 92, 170, 88, safe[1], "pathway", colors[1]),
    moduleCard(midX + 112, y0 - 8, 170, 88, safe[2], "molecule", colors[2]),
    moduleCard(midX - 100, y0 + 82, 170, 88, safe[3], "cell", colors[3]),
    moduleCard(x1, y1, 170, 88, safe[4], "result", colors[4])
  ].join("\n");
  return `${nodes}
    ${arrow(x0 + 150, y0 + 44, midX - 100, y0 - 48)}
    ${arrow(midX + 70, y0 - 48, midX + 112, y0 + 36)}
    ${arrow(midX + 112, y0 + 36, midX + 70, y0 + 126)}
    ${arrow(midX + 70, y0 + 126, x1, y1 + 44)}
    <path d="M${x1 + 88} ${y1 + 88} C${width - 80} ${height - 50}, ${x0 + 20} ${height - 46}, ${x0 + 45} ${y0 + 88}" fill="none" stroke="#c96850" stroke-width="2" stroke-dasharray="6 6" marker-end="url(#arrow-coral)"/>
    <text x="${width / 2}" y="${height - 58}" text-anchor="middle" font-family="Inter, Arial" font-size="13" font-weight="700" fill="#c96850">feedback / regulation</text>`;
}

function renderComparison(modules: string[], colors: string[], width: number, height: number) {
  const safe = fillModules(modules, ["Problem", "Baseline", "Proposed method", "Evidence", "Conclusion"]);
  const colW = (width - 150) / 2;
  return `
    <text x="70" y="145" font-family="Inter, Arial" font-size="16" font-weight="800" fill="#586474">Baseline</text>
    <text x="${width / 2 + 30}" y="145" font-family="Inter, Arial" font-size="16" font-weight="800" fill="#4b6f53">Proposed</text>
    <rect x="58" y="164" width="${colW}" height="${height - 270}" rx="12" fill="#f1f3f5" stroke="#d0d5dd"/>
    <rect x="${width / 2 + 18}" y="164" width="${colW}" height="${height - 270}" rx="12" fill="#eef5ec" stroke="#c7dbc9"/>
    ${moduleCard(78, 196, colW - 40, 92, safe[1], "baseline", "#ffffff")}
    ${moduleCard(78, 318, colW - 40, 92, safe[0], "problem", "#ffffff")}
    ${moduleCard(width / 2 + 38, 196, colW - 40, 92, safe[2], "model", colors[2])}
    ${moduleCard(width / 2 + 38, 318, colW - 40, 92, safe[3], "chart", colors[3])}
    <rect x="76" y="${height - 92}" width="${width - 152}" height="40" rx="8" fill="#d8e9f7"/>
    <text x="${width / 2}" y="${height - 67}" text-anchor="middle" font-family="Inter, Arial" font-size="14" font-weight="800" fill="#17202a">${escapeHtml(trim(safe[4], 72))}</text>`;
}

function renderTimeline(modules: string[], colors: string[], width: number, height: number) {
  const safe = fillModules(modules, ["Question", "Data", "Method", "Experiment", "Result", "Publication"]);
  const y = height / 2 + 10;
  const start = 78;
  const end = width - 82;
  const step = (end - start) / Math.max(safe.length - 1, 1);
  const nodes = safe
    .map((module, index) => {
      const x = start + index * step;
      const cardY = index % 2 === 0 ? y - 134 : y + 38;
      return `
      <circle cx="${x}" cy="${y}" r="16" fill="${colors[index % colors.length]}" stroke="#17202a" stroke-width="2"/>
      <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="Inter, Arial" font-size="12" font-weight="800" fill="#17202a">${index + 1}</text>
      ${moduleCard(x - 70, cardY, 140, 82, module, scientificIcon(index), "#ffffff")}`;
    })
    .join("\n");
  return `<path d="M${start} ${y} L${end} ${y}" stroke="#17202a" stroke-width="3" marker-end="url(#arrow)"/>
    ${nodes}`;
}

function moduleCard(x: number, y: number, width: number, height: number, title: string, icon: string, fill: string, subtitle = "research component") {
  const maxChars = Math.max(8, Math.floor((width - 56) / 7.2));
  const lines = wrapLabel(title, maxChars, 2);
  const showSub = height >= 70 && Boolean(subtitle);
  const blockHeight = lines.length * 16 + (showSub ? 13 : 0);
  const firstLineY = y + (height - blockHeight) / 2 + 12;
  const iconY = y + height / 2;
  return `<g filter="url(#cardshadow)">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${fill}" stroke="#cfcabd"/>
    ${iconGlyph(x + 24, iconY, icon)}
    ${lines
      .map(
        (line, index) =>
          `<text x="${x + 50}" y="${firstLineY + index * 16}" font-family="Inter, Arial" font-size="13" font-weight="800" fill="#1f2933">${escapeHtml(line)}</text>`
      )
      .join("\n")}
    ${showSub ? `<text x="${x + 50}" y="${firstLineY + lines.length * 16 + 9}" font-family="Inter, Arial" font-size="10" font-weight="700" fill="#6b7785">${escapeHtml(subtitle)}</text>` : ""}
  </g>`;
}

function panelBand(x: number, y: number, width: number, label: string, fill: string, stroke: string) {
  return `<rect x="${x}" y="${y}" width="${width}" height="54" rx="8" fill="${fill}" stroke="${stroke}" opacity="0.85"/>
    <text x="${x + 18}" y="${y + 33}" font-family="Inter, Arial" font-size="15" font-weight="800" fill="${stroke}">${escapeHtml(label)}</text>`;
}

function evidenceBadge(x: number, y: number, risk: string) {
  const fill = risk === "low" ? "#e4f4e6" : risk === "medium" ? "#fff2bf" : "#f9ded6";
  const text = risk === "low" ? "E" : risk === "medium" ? "?" : "!";
  return `<circle cx="${x}" cy="${y}" r="11" fill="${fill}" stroke="#17202a"/>
    <text x="${x}" y="${y + 4}" text-anchor="middle" font-family="Inter, Arial" font-size="10" font-weight="900" fill="#17202a">${text}</text>`;
}

function evidenceStrip(spec: FigureSpec, width: number, height: number) {
  const low = spec.evidenceMapping.filter((mapping) => mapping.risk === "low").length;
  const weak = spec.evidenceMapping.length - low;
  return `<rect x="48" y="${height - 112}" width="${width - 96}" height="44" rx="8" fill="#eef5ec"/>
    <text x="66" y="${height - 84}" font-family="Inter, Arial" font-size="13" font-weight="800" fill="#4b6f53">Evidence map: ${low} supported elements, ${weak} need verification before submission</text>`;
}

function relationArrow(
  from: { x: number; y: number; w: number; h: number; stageIndex: number },
  to: { x: number; y: number; w: number; h: number; stageIndex: number },
  label: string,
  index: number
) {
  const x1 = from.x + from.w;
  const y1 = from.y + from.h / 2;
  const x2 = to.x;
  const y2 = to.y + to.h / 2;
  const midX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2 - 7 - (index % 2) * 8;
  if (to.stageIndex <= from.stageIndex) {
    return `<path d="M${x1} ${y1} C${x1 + 26} ${y1 - 34}, ${x2 - 26} ${y2 - 34}, ${x2} ${y2}" fill="none" stroke="#52616f" stroke-width="1.7" stroke-dasharray="5 5" marker-end="url(#arrow)"/>
      <text x="${midX}" y="${labelY}" text-anchor="middle" font-family="Inter, Arial" font-size="9.5" font-weight="800" fill="#52616f">${escapeHtml(trim(label, 22))}</text>`;
  }
  // Forward hops between adjacent same-row cards have no horizontal room for a
  // label pill (it would cover card text), so only label arrows that change rows.
  const shortLabel = trim(label, 16);
  const pillWidth = shortLabel.length * 6 + 16;
  const showLabel = Math.abs(y2 - y1) >= 20 && shortLabel.length > 0;
  return `<path d="M${x1} ${y1} C${midX - 12} ${y1}, ${midX + 12} ${y2}, ${x2} ${y2}" fill="none" stroke="#17202a" stroke-width="1.8" marker-end="url(#arrow)"/>
    ${showLabel ? `<rect x="${midX - pillWidth / 2}" y="${labelY - 12}" width="${pillWidth}" height="16" rx="8" fill="#fffdf8" stroke="#d8d2c6"/>
    <text x="${midX}" y="${labelY}" text-anchor="middle" font-family="Inter, Arial" font-size="9.5" font-weight="800" fill="#17202a">${escapeHtml(shortLabel)}</text>` : ""}`;
}

function objectPoint(object: FigureSpec["objects"][number], width: number, height: number, index: number, total: number) {
  const fallbackX = total <= 1 ? 0.5 : 0.1 + (0.8 / Math.max(total - 1, 1)) * index;
  const xUnit = clampUnit(object.position?.x ?? fallbackX);
  const yUnit = clampUnit(object.position?.y ?? 0.5);
  return {
    x: 58 + xUnit * (width - 116),
    y: 136 + yUnit * (height - 270)
  };
}

function selectReadableObjects(objects: FigureSpec["objects"], max: number) {
  // Preserve the inputs -> outputs order so stage columns follow the pipeline;
  // do NOT re-sort by priority (that scrambled the flow across stages).
  return objects
    .map((object) => ({ ...object, label: cleanDisplayLabel(object.label) }))
    .filter((object) => object.label.length >= 2)
    .slice(0, max);
}

function objectPriority(object: FigureSpec["objects"][number]) {
  const label = object.label.toLowerCase();
  let score = object.confidence * 10;
  if (/ct|图像|病历|文本|指标|input|data|sample/i.test(label)) score += 3;
  if (/编码|encoder|特征|提取|feature/i.test(label)) score += 4;
  if (/融合|attention|注意力|推理|reason/i.test(label)) score += 5;
  if (/输出|评分|热力图|摘要|诊断|output|risk|heatmap/i.test(label)) score += 4;
  if (label.length > 24) score -= 2;
  return score;
}

function semanticIconForObject(object: FigureSpec["objects"][number]) {
  const label = object.label.toLowerCase();
  if (/ct|图像|影像|heatmap|热力图/.test(label)) return "image";
  if (/病历|文本|摘要|证据/.test(label)) return "document";
  if (/实验室|指标|auc|f1|召回|评分|metric/.test(label)) return "chart";
  if (/编码器|encoder|模型|框架|medfuse|融合|attention|注意力/.test(label)) return "model";
  if (object.kind === "output") return "result";
  if (object.kind === "dataset") return "data";
  return object.kind;
}

function semanticSubtitleForObject(object: FigureSpec["objects"][number]) {
  const label = object.label.toLowerCase();
  if (/ct|图像|影像/.test(label)) return "imaging modality";
  if (/病历|文本/.test(label)) return "clinical text";
  if (/实验室|指标/.test(label)) return "structured signal";
  if (/图像编码器/.test(label)) return "lesion features";
  if (/文本编码器/.test(label)) return "clinical evidence";
  if (/medfuse|融合|attention|注意力/.test(label)) return "fusion core";
  if (/风险评分|诊断/.test(label)) return "risk output";
  if (/热力图/.test(label)) return "explainability map";
  if (/证据摘要/.test(label)) return "evidence summary";
  if (object.kind === "output") return "output";
  if (object.kind === "model") return "model component";
  if (object.kind === "dataset") return "input evidence";
  return object.kind;
}

function groupObjectsForFramework(objects: FigureSpec["objects"]) {
  // Objects arrive in the LLM's inputs -> outputs order, so split them into 4
  // contiguous stage columns by position. This is far more reliable than
  // keyword-guessing each label's stage (which mislabeled outputs as inputs).
  const items = objects.slice(0, 8);
  const stages = 4;
  const groups: FigureSpec["objects"][] = Array.from({ length: stages }, () => []);
  if (items.length <= stages) {
    items.forEach((object, index) => groups[index].push(object));
    return groups;
  }
  const base = Math.floor(items.length / stages);
  const extra = items.length % stages;
  let cursor = 0;
  for (let stage = 0; stage < stages; stage += 1) {
    const size = base + (stage < extra ? 1 : 0);
    groups[stage] = items.slice(cursor, cursor + size);
    cursor += size;
  }
  return groups;
}

function classifyStage(object: FigureSpec["objects"][number]) {
  const label = object.label.toLowerCase();
  if (/输出|评分|热力图|摘要|诊断|风险|auc|f1|召回|output|risk|heatmap|finding|metric/.test(label) || object.kind === "metric" || object.kind === "finding" || object.kind === "output") return 3;
  if (/编码|encoder|特征|提取|病灶|症状|病史|用药|feature/.test(label) || object.kind === "process") return 1;
  if (/融合|attention|注意力|推理|框架|framework|model|reason|medfuse/.test(label) || object.kind === "model") return 2;
  if (/ct|图像|影像|病历|文本|实验室|指标|数据|input|data|sample|record/.test(label) || object.kind === "dataset") return 0;
  return 1;
}

function cleanDisplayLabel(value: string) {
  return value
    .replace(/^一种/, "")
    .replace(/^为了/, "")
    .replace(/^再/, "")
    .replace(/^随后/, "")
    .replace(/该框架/g, "")
    .replace(/本文提出/g, "")
    .replace(/面向/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function clampUnit(value: number) {
  return Math.max(0.06, Math.min(0.94, value));
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
  if (value.length <= max) return `${value}\u2026`;
  return `${value.slice(0, Math.max(1, max - 1)).trimEnd()}\u2026`;
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

function iconGlyph(x: number, y: number, icon: string) {
  if (icon === "image") return `<rect x="${x - 13}" y="${y - 10}" width="26" height="20" rx="3" fill="#e9f4fb" stroke="#315c9f"/><path d="M${x - 10} ${y + 7} L${x - 3} ${y} L${x + 2} ${y + 5} L${x + 8} ${y - 3} L${x + 12} ${y + 7}" fill="none" stroke="#315c9f" stroke-width="1.6"/><circle cx="${x + 6}" cy="${y - 5}" r="2.5" fill="#c96850"/>`;
  if (icon === "document") return `<path d="M${x - 10} ${y - 13} H${x + 7} L${x + 12} ${y - 8} V${y + 13} H${x - 10} Z" fill="#ffffff" stroke="#52616f" stroke-width="1.5"/><path d="M${x + 7} ${y - 13} V${y - 8} H${x + 12} M${x - 6} ${y - 2} H${x + 7} M${x - 6} ${y + 4} H${x + 7} M${x - 6} ${y + 10} H${x + 3}" stroke="#52616f" stroke-width="1.5"/>`;
  if (icon === "data") return `<ellipse cx="${x}" cy="${y - 9}" rx="13" ry="5" fill="#eef6fb" stroke="#315c9f"/><path d="M${x - 13} ${y - 9} V${y + 9} C${x - 13} ${y + 16}, ${x + 13} ${y + 16}, ${x + 13} ${y + 9} V${y - 9}" fill="#eef6fb" stroke="#315c9f"/><path d="M${x - 13} ${y} C${x - 13} ${y + 7}, ${x + 13} ${y + 7}, ${x + 13} ${y}" fill="none" stroke="#315c9f"/>`;
  if (icon === "result") return `<rect x="${x - 13}" y="${y - 12}" width="26" height="24" rx="5" fill="#eef7ef" stroke="#4b6f53"/><path d="M${x - 6} ${y + 2} L${x - 1} ${y + 7} L${x + 8} ${y - 6}" fill="none" stroke="#4b6f53" stroke-width="2.5"/>`;
  if (icon === "chart") return `<path d="M${x - 10} ${y + 12} L${x - 10} ${y - 8} M${x - 10} ${y + 12} L${x + 12} ${y + 12} M${x - 5} ${y + 7} L${x + 1} ${y + 1} L${x + 7} ${y + 4} L${x + 13} ${y - 7}" stroke="#315c9f" stroke-width="2" fill="none"/>`;
  if (icon === "cell") return `<circle cx="${x}" cy="${y}" r="14" fill="#d7ecd9" stroke="#4b6f53"/><circle cx="${x + 2}" cy="${y}" r="5" fill="#4b6f53"/>`;
  if (icon === "molecule") return `<circle cx="${x - 8}" cy="${y}" r="5" fill="#315c9f"/><circle cx="${x + 9}" cy="${y - 8}" r="5" fill="#c96850"/><circle cx="${x + 9}" cy="${y + 8}" r="5" fill="#4b6f53"/><path d="M${x - 3} ${y - 2} L${x + 5} ${y - 6} M${x - 3} ${y + 2} L${x + 5} ${y + 6}" stroke="#17202a"/>`;
  if (icon === "model") return `<rect x="${x - 13}" y="${y - 11}" width="26" height="22" rx="4" fill="#d8e9f7" stroke="#315c9f"/><path d="M${x - 7} ${y - 2} H${x + 7} M${x - 7} ${y + 5} H${x + 7}" stroke="#315c9f" stroke-width="2"/>`;
  return `<circle cx="${x}" cy="${y}" r="13" fill="#fff" stroke="#17202a"/><path d="M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6}" stroke="#17202a" stroke-width="2"/>`;
}

function arrow(x1: number, y1: number, x2: number, y2: number, tone: "dark" | "soft" = "dark") {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="${tone === "soft" ? "#9aa8b5" : "#17202a"}" stroke-width="2" marker-end="url(#arrow)"/>`;
}

function defs() {
  return `<defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#17202a"/>
    </marker>
    <marker id="arrow-coral" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#c96850"/>
    </marker>
    <filter id="cardshadow" x="-8%" y="-10%" width="116%" height="128%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="2.2" flood-color="#1f2933" flood-opacity="0.12"/>
    </filter>
  </defs>`;
}

function fillModules(modules: string[], fallback: string[]) {
  return [...modules, ...fallback].filter(Boolean).slice(0, Math.max(fallback.length, Math.min(modules.length, 8)));
}

function scientificIcon(index: number) {
  return ["problem", "chart", "model", "molecule", "cell", "result", "pathway", "trigger"][index % 8];
}

function inferFigureType(title: string, variant: number): FigureType {
  const lower = title.toLowerCase();
  if (lower.includes("abstract")) return "graphical-abstract";
  if (lower.includes("evaluation") || lower.includes("comparison")) return "comparison";
  if (variant === 1) return "graphical-abstract";
  if (variant === 2) return "comparison";
  return "method-framework";
}

function labelForTemplate(template: FigureType) {
  const labels: Record<FigureType, string> = {
    "method-framework": "Method framework template: pipeline, evidence lane, contribution lane",
    "experiment-flow": "Experiment flow template: protocol steps, controls, readout",
    "graphical-abstract": "Graphical abstract template: central contribution with surrounding evidence",
    mechanism: "Mechanism template: trigger, pathway, mediator, outcome, feedback",
    comparison: "Comparison template: baseline vs proposed method with evidence",
    timeline: "Timeline template: milestone sequence across research phases",
    "neural-network": "Neural architecture template: inputs, encoders, heads, losses, evaluation",
    "data-pipeline": "Data pipeline template: sources, processing, quality control, analysis, output"
  };
  return labels[template];
}

function canvasSize(aspectRatio: string) {
  if (aspectRatio === "1:1") return { width: 760, height: 760 };
  if (aspectRatio === "4:3") return { width: 880, height: 660 };
  if (aspectRatio === "3:2") return { width: 900, height: 600 };
  return { width: 960, height: 540 };
}

function architectureCanvasSize(aspectRatio: string) {
  if (aspectRatio === "1:1") return { width: 980, height: 980 };
  if (aspectRatio === "4:3") return { width: 1120, height: 840 };
  if (aspectRatio === "3:2") return { width: 1200, height: 800 };
  return { width: 1280, height: 720 };
}

// Flatter canvas for the general (Dagre) architecture path: left-to-right block
// diagrams are wide and short, so a shorter canvas avoids large empty bands.
function dagreCanvasSize(aspectRatio: string) {
  if (aspectRatio === "1:1") return { width: 980, height: 760 };
  if (aspectRatio === "4:3") return { width: 1180, height: 660 };
  if (aspectRatio === "3:2") return { width: 1240, height: 620 };
  return { width: 1320, height: 560 };
}

function trim(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}...` : value;
}

function paletteColors(palette: string) {
  return paletteFills(palette);
}
