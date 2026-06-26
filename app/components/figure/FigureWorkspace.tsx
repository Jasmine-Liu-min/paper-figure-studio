"use client";

import { useEffect, useMemo, useState } from "react";
import { AnalysisResult, ConfigStatus, FigurePlan, ImageGenerationResult } from "@/lib/types";
import { PALETTES } from "@/lib/palettes";
import { sanitizeSvgMarkup } from "@/lib/infra/sanitizeSvg";
import { cx } from "@/lib/utils";
import { ExportReviewPanel } from "./ExportReviewPanel";
import {
  BeginnerEmptyState,
  EditableTextBlock,
  FigureChoiceAdvisor,
  FigurePlanBrief,
  FigureSpecInspector,
  InputCoach
} from "./FigurePanels";
import { SpecDragEditor } from "./SpecDragEditor";
import { PRESETS, figureTypeLabel, recommendFigureChoice, rendererLabel, sampleText, scoreExplain, type ResearchPreset } from "./figureHelpers";
import { EmptyState, Field, Notice, Panel, ProviderRow, Select, TextBlock } from "../ui";
import { cloneFigurePlan, useFigureDraftActions } from "./useFigureDraftActions";

type StoredProject = AnalysisResult & { images: ImageGenerationResult[] };
export function FigureWorkspace({ config }: { config: ConfigStatus | null }) {
  const [text, setText] = useState(sampleText);
  const [presetId, setPresetId] = useState("paper-general");
  const [field, setField] = useState("AI for Science");
  const [figureType, setFigureType] = useState("method-framework");
  const [purpose, setPurpose] = useState("论文投稿 / 组会汇报");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [palette, setPalette] = useState("paper-pro");
  const [style, setStyle] = useState("clean vector academic style, readable labels");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [draftPlan, setDraftPlan] = useState<FigurePlan | null>(null);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [advancedEditOpen, setAdvancedEditOpen] = useState(false);

  const selectedPlan = useMemo(
    () => result?.plans.find((plan) => plan.id === selectedPlanId) ?? result?.plans[0],
    [result, selectedPlanId]
  );
  const selectedPreset = useMemo(() => PRESETS.find((preset) => preset.id === presetId) ?? PRESETS[0], [presetId]);
  const figureAdvice = useMemo(() => recommendFigureChoice(text, field, selectedPreset.id), [text, field, selectedPreset.id]);
  const draftActions = useFigureDraftActions({
    draftPlan,
    result,
    setDraftPlan,
    setResult,
    setSelectedPlanId,
    setStatus,
    setError
  });

  useEffect(() => {
    // Reset the editable draft only when the selected plan id changes — not on
    // every unrelated `result` update, which would discard in-progress edits.
    setDraftPlan(selectedPlan ? cloneFigurePlan(selectedPlan) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlanId]);

  useEffect(() => {
    void loadProjects();
  }, []);

  function applyPreset(preset: ResearchPreset) {
    setPresetId(preset.id);
    setField(preset.field);
    setFigureType(preset.figureType);
    setPurpose(preset.purpose);
    setPalette(preset.palette);
    setStyle(preset.style);
    setText(preset.sample);
    setFile(null);
  }

  async function loadProjects() {
    try {
      const response = await fetch("/api/projects");
      if (!response.ok) return;
      const data = (await response.json()) as { projects?: StoredProject[] };
      setProjects(data.projects ?? []);
    } catch {
      // History is non-critical; ignore load failures.
    }
  }

  async function analyze() {
    if (loading) return;
    setLoading(true);
    setStatus("正在解析论文并生成候选图方案...");
    setError("");
    try {
      const formData = new FormData();
      formData.set("text", text);
      formData.set("field", field);
      formData.set("figureType", figureType);
      formData.set("purpose", purpose);
      formData.set("aspectRatio", aspectRatio);
      formData.set("palette", palette);
      formData.set("style", style);
      if (file) formData.set("file", file);

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "分析失败");
        return;
      }
      const analysis = data as AnalysisResult;
      setResult(analysis);
      setSelectedPlanId(analysis.selectedPlanId);
      setDraftPlan(analysis.plans[0] ? cloneFigurePlan(analysis.plans[0]) : null);
      await loadProjects();
    } catch {
      setError("请求失败，请检查网络或本地服务后重试。");
    } finally {
      setStatus("");
      setLoading(false);
    }
  }

  return (
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-4">
          <Panel title="先选你要画什么" eyebrow="Guide">
            <p className="mb-3 text-sm leading-6 text-slate-600">不懂图类型也没关系。先选一个最接近的场景，系统会自动填研究领域、推荐图类型和示例内容。</p>
            <div className="grid gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className={cx(
                    "rounded-md border p-3 text-left transition",
                    presetId === preset.id ? "border-cobalt bg-cobalt/5" : "border-black/10 bg-white hover:border-cobalt/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-ink">{preset.title}</span>
                    <span className="rounded bg-paper px-2 py-1 text-[11px] font-bold text-slate-600">{figureTypeLabel(preset.figureType)}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-700">{preset.plainTitle}</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{preset.description}</p>
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="1. 输入研究内容" eyebrow="Content">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold text-ink">把你的项目讲清楚，不用写得像论文</label>
              <div className="flex gap-2">
                <button onClick={() => setText(selectedPreset.sample)} className="rounded border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  填入示例
                </button>
                <button onClick={() => setText("")} className="rounded border border-black/10 bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  清空
                </button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="按这个顺序写最稳：研究问题是什么；用了什么数据；方法/模型怎么处理；输出什么结果；用什么指标验证；有什么限制不能夸大。"
              className="mt-2 min-h-72 w-full rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-cobalt"
            />
            <InputCoach text={text} preset={selectedPreset} />
            <label className="mt-4 flex cursor-pointer items-center justify-between rounded-md border border-dashed border-black/20 bg-white px-3 py-3 text-sm">
              <span className="inline-flex items-center gap-2 text-slate-700">
                <span>文件</span>
                {file ? file.name : "可选：上传 TXT / Markdown / PDF 作为内容来源"}
              </span>
              <input
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={analyze}
              disabled={loading}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white shadow-soft hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden /> : <span aria-hidden>✦</span>}
              {loading ? "正在生成方案..." : "生成 3 个科研图方案"}
            </button>
          </Panel>

          <Panel title="2. 图形约束" eyebrow="Settings">
            <div className="mb-3 rounded-md bg-paper p-3 text-xs leading-5 text-slate-600">
              已按“{selectedPreset.title}”帮你选好默认设置。小白可以直接点生成；懂的人再微调图类型、比例和风格。
            </div>
            <FigureChoiceAdvisor advice={figureAdvice} current={figureType} onSelect={setFigureType} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Field label="研究领域" value={field} onChange={setField} />
              <Select
                label="图类型"
                value={figureType}
                onChange={setFigureType}
                options={[
                  ["method-framework", "方法框架图"],
                  ["experiment-flow", "实验流程图"],
                  ["graphical-abstract", "Graphical Abstract"],
                  ["mechanism", "机制图"],
                  ["comparison", "对比图"],
                  ["timeline", "Timeline"],
                  ["neural-network", "神经网络架构"],
                  ["data-pipeline", "数据处理 Pipeline"]
                ]}
              />
              <Field label="用途" value={purpose} onChange={setPurpose} />
              <Select
                label="比例"
                value={aspectRatio}
                onChange={setAspectRatio}
                options={[
                  ["16:9", "16:9"],
                  ["4:3", "4:3"],
                  ["1:1", "1:1"],
                  ["3:2", "3:2"]
                ]}
              />
              <Select
                label="配色"
                value={palette}
                onChange={setPalette}
                options={PALETTES.map((p) => [p.id, p.colorblindSafe ? `${p.label} ·色盲友好` : p.label] as [string, string])}
              />
              <Field label="风格" value={style} onChange={setStyle} />
            </div>
          </Panel>
        </section>

        <section className="space-y-4">
          {error ? <Notice tone="error">{error}</Notice> : null}
          {status ? <Notice>{status}</Notice> : null}

          <Panel title="论文结构" eyebrow="Extracted">
            {result ? (
              <div className="space-y-3">
                <div className="rounded-md bg-paper px-3 py-3">
                  <div className="text-xs font-semibold uppercase text-slate-500">Pipeline</div>
                  <div className="mt-1 text-sm text-slate-700">{result.parser.message}</div>
                  <div className="mt-1 text-sm text-slate-700">{result.planner.message}</div>
                </div>
                {result.planner.status === "fallback" ? (
                  <Notice tone="warning">未调用 LLM（超时或未配置），当前候选方案来自本地模板，质量有限。配置文本模型后重试可得到更贴合论文的方案。</Notice>
                ) : null}
                <h2 className="text-lg font-black text-ink">{result.structure.title}</h2>
                <p className="text-sm leading-6 text-slate-700">{result.structure.abstract}</p>
                <div className="flex flex-wrap gap-2">
                  {result.structure.keywords.map((keyword) => (
                    <span key={keyword} className="rounded bg-moss/10 px-2 py-1 text-xs font-semibold text-moss">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState text="点击生成后，这里会展示标题、摘要、方法、结果和关键词。" />
            )}
          </Panel>

          <Panel title="候选图方案" eyebrow="Candidates">
            {result ? (
              <div className="space-y-3">
                <div className="rounded-md bg-paper p-3 text-sm leading-6 text-slate-700">
                  系统生成了 3 个方案。新手建议先选分数最高的；如果你要写论文，优先看“证据是否充分”；如果你要做 PPT，优先看“可读性”和“视觉结构”。
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                {result.plans.map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => {
                      setSelectedPlanId(plan.id);
                      setDraftPlan(cloneFigurePlan(plan));
                    }}
                    className={cx(
                      "rounded-md border p-3 text-left transition",
                      selectedPlan?.id === plan.id ? "border-cobalt bg-cobalt/5" : "border-black/10 bg-white hover:border-cobalt/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-ink">{plan.name}</span>
                      <span className="rounded bg-coral/10 px-2 py-1 text-xs font-bold text-coral">{plan.critic?.total ?? plan.score}</span>
                    </div>
                    <div className="mt-2 rounded bg-paper px-2 py-1 text-[11px] font-bold text-slate-600">
                      {rendererLabel(plan)}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{plan.rationale}</p>
                    <p className="mt-2 text-[11px] leading-4 text-slate-500">{scoreExplain(plan.critic?.total ?? plan.score)}</p>
                    {plan.references?.length ? (
                      <div className="mt-2 text-[11px] font-bold text-cobalt">{plan.references.slice(0, 2).map((reference) => reference.title).join(" / ")}</div>
                    ) : null}
                    {plan.critic?.issues?.[0] ? <div className="mt-2 rounded bg-amber-50 px-2 py-1 text-[11px] leading-4 text-amber-700">{plan.critic.issues[0]}</div> : null}
                  </button>
                ))}
                </div>
              </div>
            ) : (
              <BeginnerEmptyState />
            )}
          </Panel>

          {draftPlan ? (
            <Panel title="可编辑草图" eyebrow="Draft">
              <FigurePlanBrief plan={draftPlan} />
              <div
                className="svg-preview overflow-auto rounded-md border border-black/10 bg-white"
                role="img"
                aria-label={`架构图草图：${draftPlan.name}`}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(draftPlan.svg) }}
              />
              <ExportReviewPanel plan={draftPlan} />
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {draftPlan.modules.map((module, index) => (
                  <label key={`${draftPlan.id}-${index}`} className="block">
                    <span className="text-xs font-bold text-slate-500">模块 {index + 1}</span>
                    <input
                      value={module}
                      onChange={(event) => draftActions.updateModule(index, event.target.value)}
                      className="mt-1 w-full rounded-md border border-black/10 bg-white px-2 py-2 text-xs outline-none focus:border-cobalt"
                    />
                  </label>
                ))}
              </div>
              <div className="mt-3 rounded-md border border-black/10 bg-paper p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-black text-ink">编辑模式</div>
                    <p className="mt-1 text-xs leading-5 text-slate-600">默认只改文字和一键整理；需要拖拽、锁定、改箭头时再打开高级编辑。</p>
                  </div>
                  <button
                    onClick={() => setAdvancedEditOpen((value) => !value)}
                    className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-cobalt"
                  >
                    {advancedEditOpen ? "收起高级编辑" : "打开高级编辑"}
                  </button>
                </div>
                {advancedEditOpen && draftPlan.spec ? (
                  <div className="mt-3">
                    <SpecDragEditor spec={draftPlan.spec} onChange={draftActions.updateDraftSpec} />
                    <FigureSpecInspector plan={draftPlan} />
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={draftActions.rerenderDraft}
                  className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  <span>↻</span>
                  按当前内容重绘
                </button>
                <button
                  onClick={draftActions.optimizeDraft}
                  className="inline-flex items-center gap-2 rounded-md border border-cobalt/40 bg-cobalt/10 px-3 py-2 text-sm font-semibold text-cobalt hover:border-cobalt"
                >
                  <span>↟</span>
                  一键优化可读性
                </button>
                <button
                  onClick={() => draftActions.downloadSvg(draftPlan)}
                  className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  <span>↓</span>
                  导出可编辑 SVG
                </button>
                <button
                  onClick={() => void draftActions.downloadPng(draftPlan)}
                  className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  <span>↓</span>
                  导出图片 PNG
                </button>
                <button
                  onClick={() => void draftActions.downloadPdf(draftPlan)}
                  className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  <span>↓</span>
                  导出 PDF
                </button>
              </div>
            </Panel>
          ) : null}

          <Panel title="Prompt 与图注" eyebrow="Output">
            {draftPlan ? (
              <div className="space-y-5">
                <div className="space-y-3">
                  <EditableTextBlock title="Caption" value={draftPlan.caption} onChange={(value) => draftActions.updateDraftText("caption", value)} />
                  <EditableTextBlock title="Prompt" value={draftPlan.prompt} onChange={(value) => draftActions.updateDraftText("prompt", value)} />
                  <EditableTextBlock title="Negative" value={draftPlan.negativePrompt} onChange={(value) => draftActions.updateDraftText("negativePrompt", value)} />
                  <TextBlock title="Mermaid" value={draftPlan.mermaid} mono />
                </div>
              </div>
            ) : (
              <EmptyState text="选择候选方案后展示英文 prompt 和 Mermaid 草图。" />
            )}
          </Panel>
          <details className="rounded-lg border border-black/10 bg-white/80 p-4 shadow-soft">
            <summary className="cursor-pointer text-sm font-black text-ink">项目历史与 API 状态</summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                {projects.slice(0, 6).map((project) => (
                  <button
                    key={project.projectId}
                    onClick={() => {
                      setResult(project);
                      setSelectedPlanId(project.selectedPlanId);
                      const plan = project.plans.find((item) => item.id === project.selectedPlanId) ?? project.plans[0];
                      setDraftPlan(plan ? cloneFigurePlan(plan) : null);
                    }}
                    className="w-full rounded-md border border-black/10 bg-white px-3 py-2 text-left hover:border-cobalt"
                  >
                    <div className="line-clamp-1 text-sm font-bold text-ink">{project.structure.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{new Date(project.createdAt).toLocaleString()}</div>
                  </button>
                ))}
                {!projects.length ? <EmptyState text="生成后的项目会保存在本地历史中。" /> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {config ? (
                  <>
                    <ProviderRow title="LLM 规划" provider={config.llm.provider} model={config.llm.model} ready={config.llm.ready} />
                    <ProviderRow title="图片生成" provider={config.image.provider} model={config.image.model} ready={config.image.ready} />
                  </>
                ) : (
                  <EmptyState text="正在读取 API 配置状态。" />
                )}
              </div>
            </div>
          </details>
        </section>
      </div>
  );
}
