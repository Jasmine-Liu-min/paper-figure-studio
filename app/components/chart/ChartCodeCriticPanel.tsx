"use client";

import { cx } from "@/lib/utils";

export type ChartCriticReviewClient = {
  total: number;
  verdict: string;
  issues: Array<{
    label: string;
    ok: boolean;
    detail: string;
  }>;
  suggestions: string[];
};

export function ChartCodeCriticPanel({ critic }: { critic: ChartCriticReviewClient }) {
  const ready = critic.total >= 84;
  return (
    <div className={cx("rounded-md border p-3", ready ? "border-green-200 bg-green-50/70" : "border-amber-200 bg-amber-50/70")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase text-slate-500">代码质量检查</div>
          <div className={cx("mt-1 text-sm font-black", ready ? "text-green-800" : "text-amber-800")}>{critic.total}/100 · {critic.verdict}</div>
        </div>
        <span className={cx("rounded bg-white px-2 py-1 text-xs font-black", ready ? "text-green-700" : "text-amber-700")}>
          {critic.issues.filter((issue) => issue.ok).length}/{critic.issues.length} 通过
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {critic.issues.map((issue) => (
          <div key={issue.label} className="rounded bg-white px-3 py-2 text-xs leading-5">
            <div className="flex items-center gap-2 font-black text-ink">
              <span className={cx("inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px]", issue.ok ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700")}>
                {issue.ok ? "✓" : "!"}
              </span>
              {issue.label}
            </div>
            <p className="mt-1 text-slate-600">{issue.detail}</p>
          </div>
        ))}
      </div>
      {critic.suggestions.length ? (
        <div className="mt-3 rounded bg-white px-3 py-2 text-xs leading-5 text-slate-600">
          <span className="font-black text-ink">建议：</span>
          {critic.suggestions.slice(0, 2).join("；")}
        </div>
      ) : null}
    </div>
  );
}
