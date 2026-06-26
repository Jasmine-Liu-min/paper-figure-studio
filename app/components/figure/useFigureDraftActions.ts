"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnalysisResult, FigurePlan, FigureSpec } from "@/lib/types";
import { downloadSvgAsPdf, downloadSvgAsPng, downloadTextFile } from "@/lib/infra/exportUtils";
import { slugify } from "@/lib/utils";

export function cloneFigurePlan(plan: FigurePlan) {
  return { ...plan, modules: [...plan.modules], relationships: [...plan.relationships] };
}

export function useFigureDraftActions({
  draftPlan,
  result,
  setDraftPlan,
  setResult,
  setSelectedPlanId,
  setStatus,
  setError
}: {
  draftPlan: FigurePlan | null;
  result: AnalysisResult | null;
  setDraftPlan: Dispatch<SetStateAction<FigurePlan | null>>;
  setResult: Dispatch<SetStateAction<AnalysisResult | null>>;
  setSelectedPlanId: (id: string) => void;
  setStatus: (status: string) => void;
  setError: (error: string) => void;
}) {
  function downloadSvg(plan: FigurePlan) {
    downloadTextFile(plan.svg, `${slugify(plan.name) || "figure-draft"}.svg`, "image/svg+xml;charset=utf-8");
  }

  async function downloadPng(plan: FigurePlan) {
    try {
      await downloadSvgAsPng(plan.svg, `${slugify(plan.name) || "figure-draft"}@2x.png`);
    } catch {
      setError("PNG 导出失败，请重试。");
    }
  }

  async function downloadPdf(plan: FigurePlan) {
    try {
      await downloadSvgAsPdf(plan.svg, `${slugify(plan.name) || "figure-draft"}.pdf`);
    } catch {
      setError("PDF 导出失败，请重试。");
    }
  }

  async function rerenderDraft() {
    if (!draftPlan || !result) return;
    setStatus("正在重绘 SVG 草图...");
    setError("");
    try {
      const response = await fetch("/api/render-svg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftPlan.name,
          modules: draftPlan.modules,
          palette: result.input.palette,
          aspectRatio: result.input.aspectRatio,
          figureType: result.input.figureType,
          spec: draftPlan.spec,
          variant: result.plans.findIndex((plan) => plan.id === draftPlan.id)
        })
      });
      const data = (await response.json().catch(() => ({}))) as { svg?: string; mermaid?: string; error?: string };
      if (!response.ok || !data.svg || !data.mermaid) {
        setError(data.error ?? "重绘失败");
      } else {
        setDraftPlan({ ...draftPlan, svg: data.svg, mermaid: data.mermaid });
      }
    } catch {
      setError("重绘请求失败，请重试。");
    } finally {
      setStatus("");
    }
  }

  async function optimizeDraft() {
    if (!draftPlan || !result) return;
    setStatus("正在按审稿评审优化方案...");
    setError("");
    try {
      const response = await fetch("/api/optimize-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: draftPlan,
          input: result.input,
          structure: result.structure,
          editedModules: draftPlan.modules,
          palette: result.input.palette,
          aspectRatio: result.input.aspectRatio
        })
      });
      const data = (await response.json().catch(() => ({}))) as { plan?: FigurePlan; error?: string };
      if (!response.ok || !data.plan) {
        setError(data.error ?? "优化失败");
      } else {
        const optimized = data.plan;
        setDraftPlan(optimized);
        setResult({
          ...result,
          plans: result.plans.map((plan) => (plan.id === draftPlan.id ? optimized : plan)),
          selectedPlanId: optimized.id
        });
        setSelectedPlanId(optimized.id);
      }
    } catch {
      setError("优化请求失败，请重试。");
    } finally {
      setStatus("");
    }
  }

  function updateModule(index: number, value: string) {
    if (!draftPlan) return;
    const modules = [...draftPlan.modules];
    modules[index] = value;
    const spec = draftPlan.spec
      ? {
          ...draftPlan.spec,
          objects: draftPlan.spec.objects.map((object, objectIndex) => (objectIndex === index ? { ...object, label: value } : object)),
          evidenceMapping: draftPlan.spec.evidenceMapping.map((mapping, mappingIndex) => (mappingIndex === index ? { ...mapping, claim: value } : mapping))
        }
      : draftPlan.spec;
    setDraftPlan({ ...draftPlan, modules, spec });
  }

  function updateDraftSpec(spec: FigureSpec) {
    if (!draftPlan) return;
    setDraftPlan({
      ...draftPlan,
      spec,
      modules: spec.objects.map((object) => object.label)
    });
  }

  function updateDraftText(field: "caption" | "prompt" | "negativePrompt", value: string) {
    if (!draftPlan) return;
    setDraftPlan({ ...draftPlan, [field]: value });
  }

  return {
    downloadSvg,
    downloadPng,
    downloadPdf,
    rerenderDraft,
    optimizeDraft,
    updateModule,
    updateDraftSpec,
    updateDraftText
  };
}
