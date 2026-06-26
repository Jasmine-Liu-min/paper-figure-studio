"use client";

import { FigureObject, FigurePlan } from "@/lib/types";
import { cx } from "@/lib/utils";

type ExportCheck = {
  label: string;
  ok: boolean;
  detail: string;
};

export function ExportReviewPanel({ plan }: { plan: FigurePlan }) {
  const checks = exportChecks(plan);
  const passed = checks.filter((check) => check.ok).length;
  const ready = passed >= checks.length - 1;
  return (
    <div className={cx("mt-3 rounded-md border p-3", ready ? "border-green-200 bg-green-50/60" : "border-amber-200 bg-amber-50/60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase text-slate-500">导出前审稿检查</div>
          <div className={cx("mt-1 text-sm font-black", ready ? "text-green-800" : "text-amber-800")}>
            {passed}/{checks.length} 通过 · {ready ? "可以导出后人工精修" : "建议先修掉高风险项"}
          </div>
        </div>
        <span className={cx("rounded px-2 py-1 text-xs font-black", ready ? "bg-white text-green-700" : "bg-white text-amber-700")}>
          {plan.critic?.total ?? plan.score} 分
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {checks.map((check) => (
          <div key={check.label} className="rounded bg-white px-3 py-2 text-xs leading-5">
            <div className="flex items-center gap-2 font-black text-ink">
              <span className={cx("inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]", check.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                {check.ok ? "✓" : "!"}
              </span>
              {check.label}
            </div>
            <p className="mt-1 text-slate-600">{check.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportChecks(plan: FigurePlan): ExportCheck[] {
  const spec = plan.spec;
  const objects = spec?.objects ?? [];
  const mappings = spec?.evidenceMapping ?? [];
  const weakEvidence = mappings.filter((mapping) => mapping.risk !== "low").length;
  const longLabels = objects.filter((object) => object.label.length > 30).length || plan.modules.filter((module) => module.length > 30).length;
  const causalRisk = (spec?.arrows ?? []).filter((arrow) => arrow.relation === "causal").some((arrow) => {
    const label = `${labelForCheck(objects, arrow.from)} ${labelForCheck(objects, arrow.to)} ${arrow.label}`.toLowerCase();
    return !/因果|causal|random|实验|trial|intervention|mechanism/.test(label);
  });
  const undefinedAbbrev = plan.modules.filter((module) => /\b[A-Z]{2,}\b/.test(module) && !/[()（）]/.test(module)).slice(0, 3);
  const score = plan.critic?.total ?? plan.score;
  return [
    {
      label: "证据映射",
      ok: weakEvidence === 0 && mappings.length > 0,
      detail: weakEvidence === 0 && mappings.length > 0 ? "图中元素都有较明确的文本依据。" : `${weakEvidence || "部分"} 个元素证据不足，建议补文本或改保守标签。`
    },
    {
      label: "标签长度",
      ok: longLabels === 0,
      detail: longLabels ? `${longLabels} 个标签偏长，建议压缩成 3-6 个词。` : "标签长度适合论文图阅读。"
    },
    {
      label: "因果表达",
      ok: !causalRisk,
      detail: causalRisk ? "检测到可能过强的因果箭头；预测/推荐/分类任务建议用 flow 或 supports。" : "没有明显把相关/预测画成因果的风险。"
    },
    {
      label: "缩写可读",
      ok: undefinedAbbrev.length === 0,
      detail: undefinedAbbrev.length ? `可能有未解释缩写：${undefinedAbbrev.join(", ")}。` : "没有明显未解释的大写缩写。"
    },
    {
      label: "总体质量",
      ok: score >= 78,
      detail: score >= 88 ? "适合作为主方案继续精修。" : score >= 78 ? "结构可用，导出后仍建议人工核对。" : "分数偏低，建议先一键优化或补充输入。"
    }
  ];
}

function labelForCheck(objects: FigureObject[], id: string) {
  return objects.find((object) => object.id === id)?.label ?? id;
}
