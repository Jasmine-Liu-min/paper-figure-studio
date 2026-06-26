import { chartTypeMeta } from "./chartTypes";

export type ChartCriticIssue = {
  label: string;
  ok: boolean;
  detail: string;
};

export type ChartCriticReview = {
  total: number;
  verdict: string;
  issues: ChartCriticIssue[];
  suggestions: string[];
};

export function reviewChartCode(input: { chartType: string; library: string; code: string; data: string }): ChartCriticReview {
  const code = input.code;
  const lower = code.toLowerCase();
  const meta = chartTypeMeta(input.chartType);
  const checks: ChartCriticIssue[] = [
    {
      label: "导出格式",
      ok: /savefig|ggsave/.test(lower) && /\.png/.test(lower) && /\.pdf/.test(lower),
      detail: /savefig|ggsave/.test(lower) && /\.png/.test(lower) && /\.pdf/.test(lower) ? "同时导出 PNG 和 PDF。" : "建议同时保存 300dpi PNG 和矢量 PDF。"
    },
    {
      label: "分辨率",
      ok: /dpi\s*=\s*300|dpi\s*=\s*[3-9]\d{2}/i.test(code),
      detail: /dpi\s*=\s*300|dpi\s*=\s*[3-9]\d{2}/i.test(code) ? "PNG 分辨率满足论文/汇报要求。" : "PNG 导出建议设置 dpi=300。"
    },
    {
      label: "图例位置",
      ok: !/(hue|color\s*=|fill\s*=|legend)/i.test(code) || /bbox_to_anchor|legend\.position\s*=\s*"right"|legend\.position\s*=\s*'right'|frameon\s*=\s*false/i.test(code),
      detail: "有分组时图例应外置或靠右，避免遮挡数据。"
    },
    {
      label: "字段映射",
      ok: !/replace with your real data|TODO/i.test(code) || input.data.split(/\n/).filter(Boolean).length < 2,
      detail: /TODO/i.test(code) ? "代码里还有 TODO，占位模板需要替换成真实字段。" : "代码看起来已使用输入数据字段。"
    },
    {
      label: "科研图类型",
      ok: !["pie", "donut", "radar"].includes(input.chartType),
      detail: ["pie", "donut", "radar"].includes(input.chartType) ? "这类图只适合少量类别概览，论文中要谨慎使用。" : `${meta?.label ?? input.chartType} 适合当前科研图表类别。`
    },
    {
      label: "诚实统计表达",
      ok: !["forest", "errorbar", "ribbon", "calibration", "roc", "pr-curve", "volcano"].includes(input.chartType) || /axvline|axhline|geom_vline|geom_hline|abline|confidence|ci|threshold|baseline|no skill|reference/i.test(code),
      detail: "评估/推断图应标明参考线、阈值、基线或置信区间。"
    }
  ];
  const passed = checks.filter((check) => check.ok).length;
  const total = Math.round((passed / checks.length) * 100);
  const suggestions = checks.filter((check) => !check.ok).map((check) => check.detail);
  return {
    total,
    verdict: total >= 84 ? "适合导出后本地运行" : total >= 67 ? "可运行，但建议先修正代码质量项" : "建议先调整图表类型或代码模板",
    issues: checks,
    suggestions: suggestions.length ? suggestions : ["运行前核对字段名和单位，确认图注不夸大统计结论。"]
  };
}
