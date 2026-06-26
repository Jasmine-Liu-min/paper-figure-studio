"use client";

import { FigurePlan } from "@/lib/types";
import { cx } from "@/lib/utils";
import { EmptyState } from "../ui";
import { figureTypeLabel, inputChecks, rendererLabel, type FigureChoiceAdvice, type ResearchPreset } from "./figureHelpers";

export function FigurePlanBrief({ plan }: { plan: FigurePlan }) {
  const critic = plan.critic;
  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="rounded-md bg-paper p-3">
        <div className="text-sm font-black text-ink">{plan.name}</div>
        <div className="mt-2 inline-flex rounded bg-white px-2 py-1 text-[11px] font-black text-cobalt">{rendererLabel(plan)}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{plan.rationale}</p>
        <div className="mt-3 text-xs font-black uppercase text-slate-500">Layout</div>
        <p className="mt-1 text-sm leading-6 text-slate-700">{plan.layout}</p>
        {plan.relationships.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.relationships.slice(0, 6).map((relationship) => (
              <span key={relationship} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                {relationship}
              </span>
            ))}
          </div>
        ) : null}
        {plan.visualNotes?.length ? (
          <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-600">
            {plan.visualNotes.map((note) => (
              <li key={note}>- {note}</li>
            ))}
          </ul>
        ) : null}
        {plan.references?.length ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {plan.references.slice(0, 2).map((reference) => (
              <div key={reference.id} className="rounded-md border border-black/10 bg-white p-2">
                <div className="text-xs font-black text-ink">{reference.title}</div>
                <p className="mt-1 text-[11px] leading-4 text-slate-600">{reference.layoutPattern}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="rounded-md border border-black/10 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-black uppercase text-slate-500">Critic Review</div>
          <div className="rounded bg-coral/10 px-2 py-1 text-sm font-black text-coral">{critic?.total ?? plan.score}</div>
        </div>
        {critic ? (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <ScorePill label="Faithful" value={critic.faithful} />
              <ScorePill label="Readable" value={critic.readable} />
              <ScorePill label="Concise" value={critic.concise} />
              <ScorePill label="Visual" value={critic.visual} />
              <ScorePill label="Risk" value={critic.reviewerRisk} />
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-600">{critic.verdict}</p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-700">
              {critic.issues.slice(0, 3).map((issue) => (
                <li key={issue}>- {issue}</li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState text="这个历史方案还没有 Critic 评审。" />
        )}
      </div>
    </div>
  );
}

export function InputCoach({ text, preset }: { text: string; preset: ResearchPreset }) {
  const checks = inputChecks(text, preset.id);
  const done = checks.filter((check) => check.ok).length;
  return (
    <div className="mt-3 rounded-md border border-black/10 bg-paper p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase text-slate-500">新手检查</div>
        <div className={cx("rounded px-2 py-1 text-[11px] font-black", done >= checks.length - 1 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
          {done}/{checks.length} 已覆盖
        </div>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">生成前尽量让文本覆盖这些信息，图会更准、更不容易胡编。</p>
      <div className="mt-2 grid gap-1.5">
        {checks.map((check) => (
          <div key={check.label} className="flex items-start gap-2 text-xs leading-5">
            <span className={cx("mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-black", check.ok ? "bg-green-100 text-green-700" : "bg-white text-slate-400")}>
              {check.ok ? "✓" : "!"}
            </span>
            <span className={check.ok ? "text-slate-600" : "text-amber-700"}>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BeginnerEmptyState() {
  return (
    <div className="rounded-md border border-dashed border-black/15 bg-paper p-4">
      <div className="text-sm font-black text-ink">小白怎么用？</div>
      <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-3">
        <div className="rounded bg-white p-3">
          <div className="font-bold text-ink">1. 选场景</div>
          <p className="mt-1 text-xs leading-5">比如统计建模、推荐系统、图像处理。</p>
        </div>
        <div className="rounded bg-white p-3">
          <div className="font-bold text-ink">2. 粘内容</div>
          <p className="mt-1 text-xs leading-5">写清数据、方法、输出、指标和限制。</p>
        </div>
        <div className="rounded bg-white p-3">
          <div className="font-bold text-ink">3. 选高分图</div>
          <p className="mt-1 text-xs leading-5">先用 SVG 草图，再按需导出或生图。</p>
        </div>
      </div>
    </div>
  );
}

export function FigureChoiceAdvisor({
  advice,
  current,
  onSelect
}: {
  advice: FigureChoiceAdvice;
  current: string;
  onSelect: (value: string) => void;
}) {
  const active = current === advice.recommendedType;
  return (
    <div className="mb-3 rounded-md border border-cobalt/20 bg-cobalt/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase text-cobalt">系统建议</div>
          <div className="mt-1 text-sm font-black text-ink">
            推荐画：{figureTypeLabel(advice.recommendedType)} <span className="text-xs text-slate-500">置信度 {advice.confidence}</span>
          </div>
        </div>
        {!active ? (
          <button onClick={() => onSelect(advice.recommendedType)} className="rounded-md bg-cobalt px-3 py-2 text-xs font-bold text-white hover:bg-[#244a82]">
            采用推荐
          </button>
        ) : (
          <span className="rounded-md bg-white px-3 py-2 text-xs font-bold text-cobalt">已采用</span>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-700">{advice.reason}</p>
      <p className="mt-1 text-xs leading-5 text-amber-700">{advice.avoid}</p>
      {advice.missing.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {advice.missing.map((item) => (
            <span key={item} className="rounded bg-white px-2 py-1 text-[11px] font-bold text-slate-600">
              建议补：{item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-paper px-2 py-1">
      <div className="text-[10px] font-black uppercase text-slate-500">{label}</div>
      <div className={cx("text-sm font-black", value >= 84 ? "text-green-700" : value >= 70 ? "text-amber-700" : "text-red-700")}>{value}</div>
    </div>
  );
}

export function FigureSpecInspector({ plan }: { plan: FigurePlan }) {
  const spec = plan.spec;
  if (!spec) return null;
  return (
    <div className="mt-4 grid gap-3 lg:grid-cols-2">
      <div className="rounded-md border border-black/10 bg-white p-3">
        <div className="text-xs font-black uppercase text-slate-500">FigureSpec 元素</div>
        <div className="mt-2 overflow-hidden rounded-md border border-black/10">
          {spec.objects.slice(0, 9).map((object) => (
            <div key={object.id} className="grid grid-cols-[96px_minmax(0,1fr)_54px] border-b border-black/5 px-2 py-2 text-xs last:border-b-0">
              <span className="font-bold text-slate-500">{object.kind}</span>
              <span className="truncate font-semibold text-ink">{object.label}</span>
              <span className={cx("text-right font-black", object.confidence >= 0.8 ? "text-green-700" : "text-amber-700")}>{Math.round(object.confidence * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-md border border-black/10 bg-white p-3">
        <div className="text-xs font-black uppercase text-slate-500">证据映射</div>
        <div className="mt-2 max-h-64 space-y-2 overflow-auto">
          {spec.evidenceMapping.slice(0, 9).map((mapping) => (
            <div key={mapping.targetId} className="rounded bg-paper p-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-black text-ink">{mapping.claim}</span>
                <RiskBadge risk={mapping.risk} />
              </div>
              <p className="mt-1 leading-5 text-slate-600">{mapping.sourceExcerpt}</p>
            </div>
          ))}
        </div>
      </div>
      {plan.iterations?.length ? (
        <div className="rounded-md border border-black/10 bg-white p-3 lg:col-span-2">
          <div className="text-xs font-black uppercase text-slate-500">优化记录</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.iterations.slice(0, 4).map((iteration) => (
              <span key={iteration.id} className="rounded bg-cobalt/10 px-2 py-1 text-xs font-semibold text-cobalt">
                {iteration.beforeScore} {"->"} {iteration.afterScore} · {iteration.action}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  return (
    <span
      className={cx(
        "rounded px-2 py-0.5 text-[10px] font-black uppercase",
        risk === "low" && "bg-green-50 text-green-700",
        risk === "medium" && "bg-amber-50 text-amber-700",
        risk === "high" && "bg-red-50 text-red-700"
      )}
    >
      {risk}
    </span>
  );
}

export function EditableTextBlock({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs font-black uppercase text-slate-500">{title}</div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-h-52 min-h-24 w-full rounded-md border border-black/10 bg-paper p-3 text-xs leading-5 text-slate-700 outline-none focus:border-cobalt"
      />
    </div>
  );
}
