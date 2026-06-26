"use client";

import { PALETTES } from "@/lib/palettes";
import { CHART_TYPE_META } from "@/lib/chart/chartTypes";

export type ParsedChartData = {
  headers: string[];
  rows: Record<string, string>[];
  numericHeaders: string[];
};

export function parseChartData(data: string): ParsedChartData {
  const lines = data
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [], numericHeaders: [] };
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((item) => item.trim()).filter(Boolean);
  const rows = lines.slice(1, 80).map((line) => {
    const values = line.split(delimiter).map((item) => item.trim());
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  const numericHeaders = headers.filter((header) => rows.some((row) => Number.isFinite(Number(row[header])) && row[header] !== ""));
  return { headers, rows, numericHeaders };
}

export function ChartSvgPreview({
  parsed,
  chartType,
  title,
  xLabel,
  yLabel,
  paletteId
}: {
  parsed: ParsedChartData;
  chartType: string;
  title: string;
  xLabel: string;
  yLabel: string;
  paletteId: string;
}) {
  if (!parsed.rows.length || !parsed.numericHeaders.length) {
    return <EmptyState text="粘贴 CSV/表格数据后，这里会先给出轻量预览。自然语言描述需要先生成代码后再本地运行。" />;
  }
  const svg = buildChartPreviewSvg(parsed, chartType, title, xLabel, yLabel, paletteId);
  return (
    <div className="space-y-3">
      <div className="svg-preview overflow-auto rounded-md border border-black/10 bg-white" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-xs leading-5 text-slate-500">这是浏览器里的结构预览，用来快速判断图表类型是否合适；最终出版图以生成的 seaborn / ggplot2 代码为准。</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-black/15 bg-paper px-4 py-8 text-center text-sm text-slate-500">{text}</div>;
}

function buildChartPreviewSvg(parsed: ParsedChartData, chartType: string, title: string, xLabel: string, yLabel: string, paletteId: string) {
  const previewType = previewShapeForChart(chartType);
  const width = 760;
  const height = 420;
  const margin = { left: 72, right: 28, top: 66, bottom: 72 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const colors = paletteColorsForPreview(paletteId);
  const categoryHeader = parsed.headers.find((header) => !parsed.numericHeaders.includes(header)) ?? parsed.headers[0];
  const numericHeader = parsed.numericHeaders[parsed.numericHeaders.length - 1];
  const rows = parsed.rows
    .map((row) => ({ label: row[categoryHeader] || "Item", value: Number(row[numericHeader]) }))
    .filter((row) => Number.isFinite(row.value))
    .slice(0, chartType === "heatmap" ? 36 : 12);
  const max = Math.max(...rows.map((row) => row.value), 1);
  const min = Math.min(...rows.map((row) => row.value), 0);
  const range = Math.max(max - min, 1e-6);
  const titleText = escapeText(title || `${chartTypeLabel(chartType)} preview`);
  const yText = escapeText(yLabel || numericHeader || "Value");
  const xText = escapeText(xLabel || categoryHeader || "Category");
  const frame = `
    <rect width="${width}" height="${height}" fill="#fffdf8"/>
    <text x="${margin.left}" y="34" font-family="Inter, Arial" font-size="18" font-weight="800" fill="#17202a">${titleText}</text>
    <line x1="${margin.left}" y1="${margin.top + plotH}" x2="${margin.left + plotW}" y2="${margin.top + plotH}" stroke="#b7bdc5"/>
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotH}" stroke="#b7bdc5"/>
    <text x="${margin.left + plotW / 2}" y="${height - 22}" text-anchor="middle" font-family="Inter, Arial" font-size="12" font-weight="700" fill="#586474">${xText}</text>
    <text transform="translate(22 ${margin.top + plotH / 2}) rotate(-90)" text-anchor="middle" font-family="Inter, Arial" font-size="12" font-weight="700" fill="#586474">${yText}</text>
    ${[0, 0.25, 0.5, 0.75, 1]
      .map((tick) => {
        const y = margin.top + plotH - tick * plotH;
        const value = min + tick * range;
        return `<line x1="${margin.left}" y1="${y}" x2="${margin.left + plotW}" y2="${y}" stroke="#eef0f3"/><text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-family="Inter, Arial" font-size="10" fill="#7b8794">${formatTick(value)}</text>`;
      })
      .join("")}`;

  if (chartType === "grouped-bar") {
    const groupHeader = parsed.headers.find((header) => !parsed.numericHeaders.includes(header)) ?? parsed.headers[0];
    const subgroupHeader = parsed.headers.find((header) => header !== groupHeader && !parsed.numericHeaders.includes(header));
    const valueHeader = numericHeader;
    if (subgroupHeader) {
      const groups = Array.from(new Set(parsed.rows.map((row) => row[groupHeader] || "Group"))).slice(0, 8);
      const subgroups = Array.from(new Set(parsed.rows.map((row) => row[subgroupHeader] || "Series"))).slice(0, 4);
      const groupW = plotW / Math.max(groups.length, 1);
      const innerGap = 4;
      const barW = Math.max(8, (groupW - 18 - innerGap * (subgroups.length - 1)) / Math.max(subgroups.length, 1));
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        ${frame}
        ${groups
          .map((group, groupIndex) =>
            subgroups
              .map((subgroup, subgroupIndex) => {
                const row = parsed.rows.find((item) => (item[groupHeader] || "Group") === group && (item[subgroupHeader] || "Series") === subgroup);
                const value = Number(row?.[valueHeader] ?? 0);
                const barH = ((value - Math.min(min, 0)) / Math.max(max - Math.min(min, 0), 1e-6)) * plotH;
                const x = margin.left + groupIndex * groupW + 9 + subgroupIndex * (barW + innerGap);
                const y = margin.top + plotH - barH;
                return `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${colors[subgroupIndex % colors.length]}" opacity="0.9"><title>${escapeText(group)} / ${escapeText(subgroup)}: ${value}</title></rect>`;
              })
              .join("") +
            `<text x="${margin.left + groupIndex * groupW + groupW / 2}" y="${margin.top + plotH + 16}" text-anchor="middle" font-family="Inter, Arial" font-size="9" fill="#586474">${escapeText(trimUi(group, 10))}</text>`
          )
          .join("")}
        ${subgroups
          .map((subgroup, index) => `<rect x="${margin.left + plotW - 120}" y="${margin.top + index * 18}" width="10" height="10" rx="2" fill="${colors[index % colors.length]}"/><text x="${margin.left + plotW - 104}" y="${margin.top + 9 + index * 18}" font-family="Inter, Arial" font-size="10" fill="#586474">${escapeText(trimUi(subgroup, 16))}</text>`)
          .join("")}
      </svg>`;
    }
  }

  if (chartType === "forest" || chartType === "errorbar") {
    const labelHeader = parsed.headers.find((header) => !parsed.numericHeaders.includes(header)) ?? categoryHeader;
    const effectHeader = parsed.numericHeaders.find((header) => /effect|mean|estimate|or|hr/i.test(header)) ?? parsed.numericHeaders[0];
    const lowerHeader = parsed.numericHeaders.find((header) => /lower|low|lcl|ci_l/i.test(header)) ?? parsed.numericHeaders[1];
    const upperHeader = parsed.numericHeaders.find((header) => /upper|high|ucl|ci_u/i.test(header)) ?? parsed.numericHeaders[2];
    const forestRows = parsed.rows
      .map((row) => ({ label: row[labelHeader] || "Item", effect: Number(row[effectHeader]), lower: Number(row[lowerHeader]), upper: Number(row[upperHeader]) }))
      .filter((row) => Number.isFinite(row.effect) && Number.isFinite(row.lower) && Number.isFinite(row.upper))
      .slice(0, 10);
    const allValues = forestRows.flatMap((row) => [row.lower, row.upper, row.effect]);
    const fMin = Math.min(...allValues, 0);
    const fMax = Math.max(...allValues, 1);
    const fRange = Math.max(fMax - fMin, 1e-6);
    const yStep = plotH / Math.max(forestRows.length, 1);
    const xFor = (value: number) => margin.left + ((value - fMin) / fRange) * plotW;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${frame}
      <line x1="${xFor(0)}" y1="${margin.top}" x2="${xFor(0)}" y2="${margin.top + plotH}" stroke="#9aa3ad" stroke-dasharray="4 4"/>
      ${forestRows
        .map((row, index) => {
          const y = margin.top + yStep * index + yStep / 2;
          return `<line x1="${xFor(row.lower)}" y1="${y}" x2="${xFor(row.upper)}" y2="${y}" stroke="#6b7280" stroke-width="2"/>
            <circle cx="${xFor(row.effect)}" cy="${y}" r="5" fill="${colors[index % colors.length]}"><title>${escapeText(row.label)}: ${row.effect}</title></circle>
            <text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" font-family="Inter, Arial" font-size="10" fill="#586474">${escapeText(trimUi(row.label, 14))}</text>`;
        })
        .join("")}
    </svg>`;
  }

  if (chartType === "volcano") return renderVolcanoPreview(parsed, frame, margin, plotW, plotH, width, height, colors, categoryHeader, numericHeader);
  if (previewType === "line") return renderLinePreview(parsed, frame, margin, plotW, plotH, width, height, colors, categoryHeader, numericHeader, min, max, rows);
  if (previewType === "scatter" || previewType === "bubble") return renderScatterPreview(parsed, frame, margin, plotW, plotH, width, height, colors, categoryHeader, numericHeader, previewType);
  if (previewType === "heatmap") return renderHeatmapPreview(rows, frame, margin, plotW, width, height, colors, min, range);
  return renderBarPreview(rows, frame, margin, plotW, plotH, width, height, colors, min, max);
}

function renderVolcanoPreview(parsed: ParsedChartData, frame: string, margin: { left: number; top: number }, plotW: number, plotH: number, width: number, height: number, colors: string[], categoryHeader: string, numericHeader: string) {
  const labelHeader = parsed.headers.find((header) => !parsed.numericHeaders.includes(header)) ?? categoryHeader;
  const fcHeader = parsed.numericHeaders.find((header) => /log2|fc|fold/i.test(header)) ?? parsed.numericHeaders[0];
  const pHeader = parsed.numericHeaders.find((header) => /pvalue|p_value|p-value|p$/i.test(header)) ?? parsed.numericHeaders[1] ?? numericHeader;
  const points = parsed.rows
    .map((row) => ({ label: row[labelHeader] || "Gene", xValue: Number(row[fcHeader]), pValue: Number(row[pHeader]) }))
    .filter((row) => Number.isFinite(row.xValue) && Number.isFinite(row.pValue) && row.pValue > 0)
    .slice(0, 80)
    .map((row) => ({ ...row, yValue: -Math.log10(row.pValue) }));
  const xMin = Math.min(...points.map((row) => row.xValue), -2);
  const xMax = Math.max(...points.map((row) => row.xValue), 2);
  const yMax = Math.max(...points.map((row) => row.yValue), 2);
  const xFor = (value: number) => margin.left + ((value - xMin) / Math.max(xMax - xMin, 1e-6)) * plotW;
  const yFor = (value: number) => margin.top + plotH - (value / Math.max(yMax, 1e-6)) * plotH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${frame}
    <line x1="${xFor(-1)}" y1="${margin.top}" x2="${xFor(-1)}" y2="${margin.top + plotH}" stroke="#9aa3ad" stroke-dasharray="4 4"/>
    <line x1="${xFor(1)}" y1="${margin.top}" x2="${xFor(1)}" y2="${margin.top + plotH}" stroke="#9aa3ad" stroke-dasharray="4 4"/>
    <line x1="${margin.left}" y1="${yFor(-Math.log10(0.05))}" x2="${margin.left + plotW}" y2="${yFor(-Math.log10(0.05))}" stroke="#9aa3ad" stroke-dasharray="4 4"/>
    ${points.map((row) => `<circle cx="${xFor(row.xValue)}" cy="${yFor(row.yValue)}" r="5" fill="${Math.abs(row.xValue) >= 1 && row.pValue < 0.05 ? (row.xValue > 0 ? colors[0] : colors[1]) : "#b8c0c8"}" opacity="0.85"><title>${escapeText(row.label)}: ${row.xValue}, ${row.pValue}</title></circle>`).join("")}
  </svg>`;
}

function renderLinePreview(parsed: ParsedChartData, frame: string, margin: { left: number; top: number }, plotW: number, plotH: number, width: number, height: number, colors: string[], categoryHeader: string, numericHeader: string, min: number, max: number, rows: Array<{ label: string; value: number }>) {
  const seriesHeader = parsed.headers.find((header) => header !== categoryHeader && !parsed.numericHeaders.includes(header));
  const xHeader = parsed.numericHeaders.length > 1 ? parsed.numericHeaders[0] : undefined;
  const lineSeries = seriesHeader ? Array.from(new Set(parsed.rows.map((row) => row[seriesHeader] || "Series"))).slice(0, 4) : ["Series"];
  const seriesRows = lineSeries.map((series) =>
    parsed.rows
      .filter((row) => (seriesHeader ? row[seriesHeader] || "Series" : "Series") === series)
      .map((row, index) => ({ label: row[categoryHeader] || String(index + 1), xValue: xHeader ? Number(row[xHeader]) : index, value: Number(row[numericHeader]) }))
      .filter((row) => Number.isFinite(row.value) && Number.isFinite(row.xValue))
      .slice(0, 24)
  );
  const xValues = seriesRows.flat().map((row) => row.xValue);
  const xMin = Math.min(...xValues, 0);
  const xMax = Math.max(...xValues, Math.max(rows.length - 1, 1));
  const yValues = seriesRows.flat().map((row) => row.value);
  const yMin = Math.min(...yValues, min);
  const yMax = Math.max(...yValues, max);
  const xFor = (value: number) => margin.left + ((value - xMin) / Math.max(xMax - xMin, 1e-6)) * plotW;
  const yFor = (value: number) => margin.top + plotH - ((value - yMin) / Math.max(yMax - yMin, 1e-6)) * plotH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${frame}
    ${seriesRows.map((points, seriesIndex) => `<path d="${points.map((point, index) => `${index ? "L" : "M"} ${xFor(point.xValue)} ${yFor(point.value)}`).join(" ")}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="3"/>${points.map((point) => `<circle cx="${xFor(point.xValue)}" cy="${yFor(point.value)}" r="4" fill="${colors[seriesIndex % colors.length]}"><title>${escapeText(point.label)}: ${point.value}</title></circle>`).join("")}`).join("")}
    ${lineSeries.map((series, index) => `<rect x="${margin.left + plotW - 118}" y="${margin.top + index * 18}" width="10" height="10" rx="2" fill="${colors[index % colors.length]}"/><text x="${margin.left + plotW - 102}" y="${margin.top + 9 + index * 18}" font-family="Inter, Arial" font-size="10" fill="#586474">${escapeText(trimUi(series, 16))}</text>`).join("")}
  </svg>`;
}

function renderScatterPreview(parsed: ParsedChartData, frame: string, margin: { left: number; top: number }, plotW: number, plotH: number, width: number, height: number, colors: string[], categoryHeader: string, numericHeader: string, previewType: string) {
  const xHeader = parsed.numericHeaders[0];
  const yHeader = parsed.numericHeaders[1] ?? numericHeader;
  const scatterRows = parsed.rows
    .map((row) => ({ label: row[categoryHeader] || "Item", xValue: Number(row[xHeader]), yValue: Number(row[yHeader]) }))
    .filter((row) => Number.isFinite(row.xValue) && Number.isFinite(row.yValue))
    .slice(0, 40);
  const xMin = Math.min(...scatterRows.map((row) => row.xValue), 0);
  const xMax = Math.max(...scatterRows.map((row) => row.xValue), 1);
  const yMin = Math.min(...scatterRows.map((row) => row.yValue), 0);
  const yMax = Math.max(...scatterRows.map((row) => row.yValue), 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${frame}
    ${scatterRows.map((row, index) => `<circle cx="${margin.left + ((row.xValue - xMin) / Math.max(xMax - xMin, 1e-6)) * plotW}" cy="${margin.top + plotH - ((row.yValue - yMin) / Math.max(yMax - yMin, 1e-6)) * plotH}" r="${previewType === "bubble" ? 7 : 5}" fill="${colors[index % colors.length]}" opacity="0.86"><title>${escapeText(row.label)}: ${row.xValue}, ${row.yValue}</title></circle>`).join("")}
  </svg>`;
}

function renderHeatmapPreview(rows: Array<{ label: string; value: number }>, frame: string, margin: { left: number; top: number }, plotW: number, width: number, height: number, colors: string[], min: number, range: number) {
  const cols = Math.ceil(Math.sqrt(rows.length));
  const cell = Math.min(46, plotW / cols);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${frame}
    ${rows.map((row, index) => `<rect x="${margin.left + (index % cols) * cell}" y="${margin.top + Math.floor(index / cols) * cell}" width="${cell - 3}" height="${cell - 3}" rx="5" fill="${colors[0]}" opacity="${0.18 + ((row.value - min) / range) * 0.72}"><title>${escapeText(row.label)}: ${row.value}</title></rect>`).join("")}
  </svg>`;
}

function renderBarPreview(rows: Array<{ label: string; value: number }>, frame: string, margin: { left: number; top: number }, plotW: number, plotH: number, width: number, height: number, colors: string[], min: number, max: number) {
  const barGap = 10;
  const barW = Math.max(12, (plotW - barGap * Math.max(rows.length - 1, 0)) / Math.max(rows.length, 1));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    ${frame}
    ${rows.map((row, index) => {
      const x = margin.left + index * (barW + barGap);
      const barH = ((row.value - Math.min(min, 0)) / Math.max(max - Math.min(min, 0), 1e-6)) * plotH;
      return `<rect x="${x}" y="${margin.top + plotH - barH}" width="${barW}" height="${barH}" rx="5" fill="${colors[index % colors.length]}" opacity="0.9"><title>${escapeText(row.label)}: ${row.value}</title></rect><text x="${x + barW / 2}" y="${margin.top + plotH + 16}" text-anchor="middle" font-family="Inter, Arial" font-size="9" fill="#586474">${escapeText(trimUi(row.label, 10))}</text>`;
    }).join("")}
  </svg>`;
}

function previewShapeForChart(chartType: string) {
  if (["line", "area", "ribbon", "control-chart", "roc", "pr-curve", "calibration", "lift-gain", "learning-curve", "kaplan-meier", "ecdf"].includes(chartType)) return "line";
  if (["scatter", "bubble", "regression", "hexbin", "jointplot", "pca", "umap", "spatial-scatter", "contour", "volcano", "manhattan", "shap-summary", "partial-dependence", "bland-altman"].includes(chartType)) return chartType === "bubble" || chartType === "enrichment-dotplot" ? "bubble" : "scatter";
  if (["heatmap", "clustermap", "correlation", "confusion-matrix", "calendar-heatmap"].includes(chartType)) return "heatmap";
  return "bar";
}

function paletteColorsForPreview(paletteId: string) {
  return PALETTES.find((palette) => palette.id === paletteId)?.fills ?? ["#315c9f", "#c96850", "#4b6f53", "#8d6e63"];
}

function formatTick(value: number) {
  if (Math.abs(value) >= 10) return String(Math.round(value));
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function chartTypeLabel(value: string) {
  return CHART_TYPE_META.find((item) => item.id === value)?.label ?? value;
}

function trimUi(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function escapeText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
