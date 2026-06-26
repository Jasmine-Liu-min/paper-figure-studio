"use client";

import { useEffect, useMemo, useState } from "react";
import { CHART_CATEGORIES, CHART_TYPE_META, CHART_TYPES, type ChartCategory } from "@/lib/chart/chartTypes";
import { PALETTES } from "@/lib/palettes";
import { cx } from "@/lib/utils";
import { ChartCodeCriticPanel, type ChartCriticReviewClient } from "./ChartCodeCriticPanel";
import { ChartSvgPreview, parseChartData } from "./ChartSvgPreview";
import { EmptyState, Field, Notice, Panel, Select } from "../ui";

type ChartPreset = {
  id: string;
  title: string;
  description: string;
  chartType: string;
  library: "seaborn" | "ggplot2";
  titleValue: string;
  xLabel: string;
  yLabel: string;
  notes: string;
  data: string;
};

type ChartResultState = {
  ok: boolean;
  provider?: string;
  language: string;
  library: string;
  code: string;
  message: string;
  critic?: ChartCriticReviewClient;
  projectId?: string;
  savedAt?: string;
};

type StoredChartProjectClient = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  input: {
    data: string;
    chartType: string;
    library: "seaborn" | "ggplot2";
    title: string;
    xLabel: string;
    yLabel: string;
    palette: string;
    notes: string;
  };
  result: {
    ok: boolean;
    provider: string;
    language: "python" | "r";
    library: "seaborn" | "ggplot2";
    code: string;
    message: string;
  };
  critic?: ChartCriticReviewClient;
};

const CHART_PRESETS: ChartPreset[] = [
  {
    id: "method-compare",
    title: "对比实验",
    description: "不同方法在不同数据集上的指标对比，最常见的论文结果图。",
    chartType: "grouped-bar",
    library: "seaborn",
    titleValue: "Model performance comparison",
    xLabel: "Dataset",
    yLabel: "Accuracy",
    notes: "Use grouped bars by Method. Put the legend outside. Annotate values only if they do not crowd the plot.",
    data: "Method,Dataset,Accuracy\nOurs,ETH,0.92\nOurs,UCY,0.89\nBaseline,ETH,0.81\nBaseline,UCY,0.78\nAblation,ETH,0.86\nAblation,UCY,0.83"
  },
  {
    id: "ablation",
    title: "消融实验",
    description: "展示去掉某个模块后性能下降，用来证明组件有贡献。",
    chartType: "bar",
    library: "seaborn",
    titleValue: "Ablation study",
    xLabel: "Model variant",
    yLabel: "AUC",
    notes: "Sort variants from baseline to full model. Highlight the full model without exaggerating the gain.",
    data: "Variant,AUC\nBaseline,0.812\n+ Feature crossing,0.836\n+ Regularization,0.851\n+ Calibration,0.864\nFull model,0.879"
  },
  {
    id: "training-curve",
    title: "训练曲线",
    description: "看模型是否收敛、是否过拟合，适合深度学习和搜索推荐模型。",
    chartType: "line",
    library: "seaborn",
    titleValue: "Training and validation curves",
    xLabel: "Epoch",
    yLabel: "Loss",
    notes: "Draw train and validation as two lines. Keep y-axis honest and avoid smoothing that hides instability.",
    data: "Epoch,Split,Loss\n1,Train,0.92\n1,Validation,0.98\n2,Train,0.71\n2,Validation,0.79\n3,Train,0.58\n3,Validation,0.66\n4,Train,0.49\n4,Validation,0.62\n5,Train,0.43\n5,Validation,0.61"
  },
  {
    id: "confusion",
    title: "分类混淆矩阵",
    description: "适合分类、检测、分割后的类别错误分析。",
    chartType: "heatmap",
    library: "seaborn",
    titleValue: "Confusion matrix",
    xLabel: "Predicted label",
    yLabel: "True label",
    notes: "Use a square heatmap with annotations. Do not use a decorative palette that hides small errors.",
    data: "True,Predicted,Count\nClass A,Class A,86\nClass A,Class B,9\nClass A,Class C,5\nClass B,Class A,7\nClass B,Class B,78\nClass B,Class C,15\nClass C,Class A,4\nClass C,Class B,12\nClass C,Class C,84"
  },
  {
    id: "metric-tradeoff",
    title: "搜索推荐权衡",
    description: "展示 CTR、覆盖率、多样性等指标之间的取舍。",
    chartType: "scatter",
    library: "seaborn",
    titleValue: "Recommendation quality trade-off",
    xLabel: "Coverage",
    yLabel: "CTR",
    notes: "Use point size or color for diversity if available. Label only key systems to avoid clutter.",
    data: "System,Coverage,CTR,Diversity\nBaseline,0.42,0.061,0.31\nTwo-tower retrieval,0.58,0.068,0.38\nRanker,0.51,0.075,0.34\nRerank + diversity,0.64,0.073,0.49\nFull system,0.67,0.079,0.52"
  },
  {
    id: "roc-pr",
    title: "模型评估曲线",
    description: "分类模型常用 ROC / PR / 校准曲线，适合机器学习论文。",
    chartType: "roc",
    library: "seaborn",
    titleValue: "ROC curve",
    xLabel: "False positive rate",
    yLabel: "True positive rate",
    notes: "Draw one curve per model. Add a diagonal no-skill baseline and report AUC in the legend if available.",
    data: "Model,FPR,TPR\nBaseline,0.00,0.00\nBaseline,0.10,0.42\nBaseline,0.30,0.68\nBaseline,0.60,0.86\nBaseline,1.00,1.00\nOurs,0.00,0.00\nOurs,0.08,0.58\nOurs,0.25,0.82\nOurs,0.55,0.93\nOurs,1.00,1.00"
  },
  {
    id: "forest",
    title: "效应量 / 置信区间",
    description: "统计推断、医学统计、Meta 分析常用，强调估计值和不确定性。",
    chartType: "forest",
    library: "ggplot2",
    titleValue: "Effect estimates with 95% CI",
    xLabel: "Effect size",
    yLabel: "Study / subgroup",
    notes: "Draw a vertical reference line at 0 or 1 depending on the effect scale. Use horizontal confidence intervals.",
    data: "Study,Effect,Lower,Upper\nGroup A,0.22,0.08,0.36\nGroup B,0.15,-0.02,0.31\nGroup C,0.31,0.18,0.44\nOverall,0.24,0.14,0.34"
  },
  {
    id: "feature-explain",
    title: "模型解释",
    description: "展示特征重要性、SHAP、部分依赖，适合统计建模和推荐排序。",
    chartType: "feature-importance",
    library: "seaborn",
    titleValue: "Feature importance",
    xLabel: "Importance",
    yLabel: "Feature",
    notes: "Sort features by importance. Do not imply causality; describe this as predictive contribution.",
    data: "Feature,Importance\nUser activity,0.28\nQuery intent,0.22\nItem popularity,0.18\nPrice feature,0.13\nFreshness,0.10\nText embedding,0.09"
  },
  {
    id: "bio-volcano",
    title: "组学火山图",
    description: "差异表达、显著性筛选、组学论文常见结果图。",
    chartType: "volcano",
    library: "ggplot2",
    titleValue: "Volcano plot",
    xLabel: "log2 fold change",
    yLabel: "-log10(p-value)",
    notes: "Highlight significant up/down features using thresholds. Label only top hits to avoid clutter.",
    data: "Gene,log2FC,pValue\nGeneA,1.8,0.0004\nGeneB,-1.4,0.002\nGeneC,0.4,0.18\nGeneD,2.2,0.00008\nGeneE,-0.9,0.04\nGeneF,0.2,0.63"
  }
];

export function ChartWorkspace() {
  const [presetId, setPresetId] = useState("method-compare");
  const [data, setData] = useState(
    "Method,Dataset,Accuracy\nOurs,ETH,0.92\nOurs,UCY,0.89\nBaseline,ETH,0.81\nBaseline,UCY,0.78"
  );
  const [chartType, setChartType] = useState("grouped-bar");
  const [chartCategory, setChartCategory] = useState<ChartCategory | "all">("comparison");
  const [library, setLibrary] = useState<"seaborn" | "ggplot2">("seaborn");
  const [title, setTitle] = useState("");
  const [xLabel, setXLabel] = useState("");
  const [yLabel, setYLabel] = useState("");
  const [palette, setPalette] = useState("paper-pro");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<ChartResultState | null>(null);
  const [chartProjects, setChartProjects] = useState<StoredChartProjectClient[]>([]);
  const chartAdvice = useMemo(() => recommendChartChoice(data, notes), [data, notes]);
  const previewData = useMemo(() => parseChartData(data), [data]);
  const visibleChartTypes = useMemo(
    () => (chartCategory === "all" ? CHART_TYPES : CHART_TYPE_META.filter((item) => item.category === chartCategory).map((item) => [item.id, item.label] as [string, string])),
    [chartCategory]
  );

  useEffect(() => {
    void loadChartProjects();
  }, []);

  async function loadChartProjects() {
    try {
      const response = await fetch("/api/chart-projects");
      if (!response.ok) return;
      const payload = (await response.json()) as { projects?: StoredChartProjectClient[] };
      setChartProjects(payload.projects ?? []);
    } catch {
      // History is non-critical; ignore load failures.
    }
  }

  function applyChartPreset(preset: ChartPreset) {
    setPresetId(preset.id);
    setData(preset.data);
    setChartType(preset.chartType);
    setChartCategory(chartCategoryForType(preset.chartType));
    setLibrary(preset.library);
    setTitle(preset.titleValue);
    setXLabel(preset.xLabel);
    setYLabel(preset.yLabel);
    setNotes(preset.notes);
    setResult(null);
    setError("");
  }

  async function generate() {
    if (!data.trim()) {
      setError("请先粘贴数据或描述要画的图表。");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, chartType, library, title, xLabel, yLabel, palette, notes })
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? "生成失败");
      } else {
        setResult(payload);
        await loadChartProjects();
      }
    } catch {
      setError("请求失败，请重试。");
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("复制失败，请手动选择代码复制。");
    }
  }

  function downloadCode() {
    if (!result) return;
    const extension = result.language === "r" ? "R" : "py";
    const blob = new Blob([result.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `figure.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openChartProject(project: StoredChartProjectClient) {
    setPresetId("");
    setData(project.input.data);
    setChartType(project.input.chartType);
    setChartCategory(chartCategoryForType(project.input.chartType));
    setLibrary(project.input.library);
    setTitle(project.input.title);
    setXLabel(project.input.xLabel);
    setYLabel(project.input.yLabel);
    setPalette(project.input.palette);
    setNotes(project.input.notes);
    setResult({ ...project.result, critic: project.critic, projectId: project.id, savedAt: project.updatedAt });
    setError("");
  }

  async function deleteChartHistory(id: string) {
    try {
      await fetch("/api/chart-projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (result?.projectId === id) setResult(null);
      await loadChartProjects();
    } catch {
      setError("删除失败，请重试。");
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="space-y-4">
        <Panel title="先选你要画哪类结果" eyebrow="Guide">
          <p className="mb-3 text-sm leading-6 text-slate-600">不懂图表类型也没关系。先选论文里最常见的结果场景，系统会填好示例数据、图表类型和绘图要求。</p>
          <div className="grid gap-2">
            {CHART_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyChartPreset(preset)}
                className={cx(
                  "rounded-md border p-3 text-left transition",
                  presetId === preset.id ? "border-cobalt bg-cobalt/5" : "border-black/10 bg-white hover:border-cobalt/50"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-ink">{preset.title}</span>
                  <span className="rounded bg-paper px-2 py-1 text-[11px] font-bold text-slate-600">{chartTypeLabel(preset.chartType)}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="1. 粘贴数据 / 描述图表" eyebrow="Data">
          <p className="mb-2 text-sm leading-6 text-slate-600">支持 CSV、表格或自然语言。只描述也行，系统会先生成占位数据并标注 # TODO，你替换即可。</p>
          <textarea
            value={data}
            onChange={(event) => setData(event.target.value)}
            className="min-h-44 w-full rounded-md border border-black/10 bg-white px-3 py-3 font-mono text-xs leading-5 outline-none focus:border-cobalt"
            placeholder={"例如：\nMethod,Dataset,Accuracy\nOurs,ETH,0.92\nBaseline,ETH,0.81"}
          />
        </Panel>
        <Panel title="2. 图表设置" eyebrow="Options">
          <ChartChoiceAdvisor
            advice={chartAdvice}
            current={chartType}
            onSelect={(value) => {
              setChartType(value);
              setChartCategory(chartCategoryForType(value));
            }}
          />
          <Select
            label="图表类别"
            value={chartCategory}
            onChange={(value) => setChartCategory(value as ChartCategory | "all")}
            options={[["all", "全部科研图表"], ...Object.entries(CHART_CATEGORIES)]}
          />
          <Select label="图表类型" value={chartType} onChange={setChartType} options={visibleChartTypes} />
          <ChartTypeHelp chartType={chartType} />
          <Select
            label="绘图语言 / 库"
            value={library}
            onChange={(value) => setLibrary(value === "ggplot2" ? "ggplot2" : "seaborn")}
            options={[
              ["seaborn", "Python · seaborn"],
              ["ggplot2", "R · tidyverse/ggplot2"]
            ]}
          />
          <Select label="配色" value={palette} onChange={setPalette} options={PALETTES.map((item) => [item.id, item.label])} />
          <Field label="标题" value={title} onChange={setTitle} />
          <Field label="X 轴标签" value={xLabel} onChange={setXLabel} />
          <Field label="Y 轴标签" value={yLabel} onChange={setYLabel} />
          <Field label="额外要求(可选)" value={notes} onChange={setNotes} />
          <button
            onClick={() => void generate()}
            disabled={loading}
            className="mt-1 w-full rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
          >
            {loading ? "正在生成绘图代码..." : "生成绘图代码"}
          </button>
        </Panel>
      </section>

      <section className="space-y-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Panel title="网页预览" eyebrow="Preview">
          <ChartSvgPreview parsed={previewData} chartType={chartType} title={title} xLabel={xLabel} yLabel={yLabel} paletteId={palette} />
        </Panel>
        <Panel title="出版级绘图代码" eyebrow={result?.language === "r" ? "R / ggplot2" : "Python / seaborn"}>
          {result ? (
            <div className="space-y-3">
              <div className="rounded-md bg-paper px-3 py-2 text-xs text-slate-600">{result.message}</div>
              {result.projectId ? (
                <div className="rounded-md bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                  已保存到图表历史{result.savedAt ? ` · ${new Date(result.savedAt).toLocaleString()}` : ""}
                </div>
              ) : null}
              <ChartRunGuide library={result.library} />
              {result.critic ? <ChartCodeCriticPanel critic={result.critic} /> : null}
              <div className="flex flex-wrap gap-2">
                <button onClick={copyCode} className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black">
                  {copied ? "已复制 ✓" : "复制代码"}
                </button>
                <button onClick={downloadCode} className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt">
                  下载 .{result.language === "r" ? "R" : "py"}
                </button>
              </div>
              <pre className="max-h-[60vh] overflow-auto rounded-md border border-black/10 bg-[#1f2933] p-4 text-xs leading-5 text-[#e7edf3]">
                <code>{result.code}</code>
              </pre>
              <p className="text-xs leading-5 text-slate-500">
                在本地运行即可出图(会同时导出 300dpi PNG 和矢量 PDF)。Python:
                <code className="mx-1 rounded bg-paper px-1">pip install seaborn matplotlib pandas</code>; R:
                <code className="mx-1 rounded bg-paper px-1">{'install.packages("tidyverse")'}</code>。
              </p>
            </div>
          ) : (
            <EmptyState text="填好数据和设置后，这里会给出可直接运行的出版级绘图代码(seaborn 或 ggplot2),配色与论文统一。" />
          )}
        </Panel>
        <Panel title="图表历史" eyebrow="History">
          {chartProjects.length ? (
            <div className="space-y-2">
              {chartProjects.slice(0, 10).map((project) => (
                <div key={project.id} className="rounded-md border border-black/10 bg-white p-3">
                  <button onClick={() => openChartProject(project)} className="block w-full text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-ink">{project.name || chartTypeLabel(project.input.chartType)}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {chartTypeLabel(project.input.chartType)} · {project.input.library === "ggplot2" ? "R" : "Python"} · {new Date(project.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <span className="rounded bg-paper px-2 py-1 text-[11px] font-bold text-slate-600">继续编辑</span>
                    </div>
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs text-slate-500">{project.result.message}</span>
                    <button onClick={() => void deleteChartHistory(project.id)} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700 hover:border-red-400">
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState text="生成过的图表代码会保存在这里，方便回看数据、参数和代码。" />
          )}
        </Panel>
      </section>
    </div>
  );
}

function recommendChartChoice(data: string, notes: string) {
  const value = `${data} ${notes}`.toLowerCase();
  const columnCount = data.split(/\n/)[0]?.split(/,|\t/).filter(Boolean).length ?? 0;
  const rowCount = data.split(/\n/).filter((line) => line.trim()).length;
  if (/roc|auc|false positive|true positive|fpr|tpr/.test(value)) {
    return {
      chartType: "roc",
      confidence: "高",
      reason: "你在做分类模型阈值评估，ROC 曲线能展示 TPR/FPR 权衡。",
      caution: "类别极不平衡时不要只看 ROC，建议同时画 PR 曲线。"
    };
  }
  if (/precision|recall|pr curve|召回率|精确率/.test(value)) {
    return {
      chartType: "pr-curve",
      confidence: "高",
      reason: "数据包含 precision/recall，PR 曲线更适合类别不平衡任务。",
      caution: "不要把 PR-AUC 和 ROC-AUC 混用，图注要写清楚。"
    };
  }
  if (/calibration|校准|observed|predicted probability|概率可信/.test(value)) {
    return {
      chartType: "calibration",
      confidence: "高",
      reason: "你在检查预测概率是否可信，校准曲线比普通折线图更合适。",
      caution: "需要包含预测概率分箱和实际发生率，不能凭空生成校准结果。"
    };
  }
  if (/forest|effect|confidence interval|ci|置信区间|效应量|odds ratio|hazard ratio/.test(value)) {
    return {
      chartType: "forest",
      confidence: "高",
      reason: "数据包含效应量和置信区间，森林图能同时展示估计值与不确定性。",
      caution: "必须标明参考线是 0 还是 1，取决于效应量尺度。"
    };
  }
  if (/survival|kaplan|meier|hazard|生存|留存/.test(value)) {
    return {
      chartType: "kaplan-meier",
      confidence: "中",
      reason: "这是时间到事件/留存问题，Kaplan-Meier 曲线比普通折线更规范。",
      caution: "严格生存分析需要 censor 信息；没有删失信息时只能做示意。"
    };
  }
  if (/shap/.test(value)) {
    return {
      chartType: "shap-summary",
      confidence: "高",
      reason: "你在做模型解释，SHAP 总结图能展示贡献方向和分布。",
      caution: "SHAP 值必须来自真实模型解释结果，不能让模型编造。"
    };
  }
  if (/feature importance|特征重要|importance|变量贡献/.test(value)) {
    return {
      chartType: "feature-importance",
      confidence: "高",
      reason: "这是模型解释/变量贡献，特征重要性条形图最直观。",
      caution: "特征重要性表示预测贡献，不等于因果影响。"
    };
  }
  if (/volcano|log2fc|fold change|pvalue|p-value|差异表达|火山图/.test(value)) {
    return {
      chartType: "volcano",
      confidence: "高",
      reason: "数据像差异表达结果，火山图适合同时展示效应大小和显著性。",
      caution: "阈值要写清楚，只标注少数 top hits，避免标签拥挤。"
    };
  }
  if (/pca|umap|tsne|t-sne|降维|embedding|cluster|聚类/.test(value)) {
    return {
      chartType: /pca/.test(value) ? "pca" : "umap",
      confidence: "高",
      reason: "这是高维数据降维展示，PCA/UMAP 散点图更适合看分群结构。",
      caution: "降维图只能说明可视化空间里的聚集，不能过度解释真实距离。"
    };
  }
  if (/confusion|混淆|matrix|矩阵|heatmap|相关|correlation/.test(value)) {
    return {
      chartType: /confusion|混淆/.test(value) ? "confusion-matrix" : /correlation|相关/.test(value) ? "correlation" : "heatmap",
      confidence: "高",
      reason: "这类数据需要看二维关系或错误分布，热力图最直观。",
      caution: "注意使用真实计数或比例，不要让颜色夸大很小的差异。"
    };
  }
  if (/epoch|loss|训练|收敛|time|时间|step|iteration|curve/.test(value)) {
    return {
      chartType: "line",
      confidence: "高",
      reason: "横轴是时间、epoch 或训练步数时，折线图最适合展示趋势。",
      caution: "不要过度平滑曲线，过拟合或波动本身也是重要证据。"
    };
  }
  if (/auc|accuracy|f1|rmse|消融|ablation|baseline|ours|method|dataset/.test(value) && columnCount >= 3) {
    return {
      chartType: "grouped-bar",
      confidence: "高",
      reason: "数据像“方法 x 数据集 x 指标”，分组柱状图能清楚比较不同方法。",
      caution: "如果方法很多，优先减少分组或改用点线图，避免柱子太挤。"
    };
  }
  if (/trade|权衡|coverage|ctr|diversity|scatter|相关|relationship/.test(value) || (columnCount >= 3 && rowCount >= 5)) {
    return {
      chartType: "scatter",
      confidence: "中",
      reason: "多指标之间的关系或权衡，用散点图比柱状图更诚实。",
      caution: "不要用散点图暗示因果，只能说相关或权衡。"
    };
  }
  if (columnCount <= 2) {
    return {
      chartType: "bar",
      confidence: "中",
      reason: "当前数据像“类别 + 数值”，普通柱状图最稳。",
      caution: "柱状图适合展示数量或指标，不适合展示连续趋势。"
    };
  }
  return {
    chartType: "grouped-bar",
    confidence: "低",
    reason: "系统暂时只能粗略判断，先用分组柱状图作为可读性最高的默认方案。",
    caution: "如果这是趋势数据，请改折线图；如果是二维矩阵，请改热力图。"
  };
}

function ChartTypeHelp({ chartType }: { chartType: string }) {
  const meta = CHART_TYPE_META.find((item) => item.id === chartType);
  if (!meta) return null;
  return (
    <div className="mb-3 rounded-md border border-black/10 bg-paper p-3 text-xs leading-5 text-slate-600">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-black text-ink">{meta.label}</span>
        <span className="rounded bg-white px-2 py-1 font-bold text-slate-600">{CHART_CATEGORIES[meta.category]}</span>
      </div>
      <p className="mt-1">{meta.useCase}</p>
      <p className="mt-1 text-slate-500">推荐数据格式：{meta.dataHint}</p>
    </div>
  );
}

function ChartChoiceAdvisor({
  advice,
  current,
  onSelect
}: {
  advice: ReturnType<typeof recommendChartChoice>;
  current: string;
  onSelect: (value: string) => void;
}) {
  const active = current === advice.chartType;
  return (
    <div className="mb-3 rounded-md border border-moss/20 bg-moss/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase text-moss">图表建议</div>
          <div className="mt-1 text-sm font-black text-ink">
            推荐：{chartTypeLabel(advice.chartType)} <span className="text-xs text-slate-500">置信度 {advice.confidence}</span>
          </div>
        </div>
        {!active ? (
          <button onClick={() => onSelect(advice.chartType)} className="rounded-md bg-moss px-3 py-2 text-xs font-bold text-white hover:bg-[#3d5d45]">
            采用推荐
          </button>
        ) : (
          <span className="rounded-md bg-white px-3 py-2 text-xs font-bold text-moss">已采用</span>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-700">{advice.reason}</p>
      <p className="mt-1 text-xs leading-5 text-amber-700">{advice.caution}</p>
    </div>
  );
}

function ChartRunGuide({ library }: { library: string }) {
  const isR = library === "ggplot2";
  return (
    <div className="rounded-md border border-black/10 bg-white p-3 text-xs leading-5 text-slate-600">
      <div className="font-black text-ink">下一步怎么出图</div>
      <p className="mt-1">
        {isR
          ? "下载 .R 后在 RStudio 或终端运行，会导出 figure.png 和 figure.pdf。"
          : "下载 .py 后在本地终端运行，会导出 figure.png 和 figure.pdf。"}
      </p>
      <p className="mt-1">论文里优先用 PDF/SVG 这类矢量图；汇报或网页展示再用 300dpi PNG。</p>
    </div>
  );
}

function chartTypeLabel(value: string) {
  return CHART_TYPE_META.find((item) => item.id === value)?.label ?? value;
}

function chartCategoryForType(value: string): ChartCategory | "all" {
  return CHART_TYPE_META.find((item) => item.id === value)?.category ?? "all";
}
