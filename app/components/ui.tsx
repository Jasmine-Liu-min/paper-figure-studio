"use client";

import { cx } from "@/lib/utils";

export function Panel({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-black/10 bg-white p-4 shadow-soft">
      <div className="mb-4">
        {eyebrow ? <div className="text-[11px] font-black uppercase tracking-wide text-coral">{eyebrow}</div> : null}
        <div className="mt-1 text-lg font-black text-ink">{title}</div>
      </div>
      {children}
    </section>
  );
}

export function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="mb-3 block">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextBlock({ title, value, mono = false }: { title: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-xs font-black uppercase text-slate-500">{title}</div>
      <div className={cx("max-h-48 overflow-auto rounded-md bg-paper p-3 text-xs leading-5 text-slate-700", mono && "font-mono")}>{value}</div>
    </div>
  );
}

export function ProviderRow({ title, provider, model, ready }: { title: string; provider: string; model: string; ready: boolean }) {
  return (
    <div className="rounded-md border border-black/10 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black uppercase text-slate-500">{title}</span>
        <span className={cx("rounded px-2 py-1 text-xs font-bold", ready ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>
          {ready ? "ready" : "not ready"}
        </span>
      </div>
      <div className="mt-1 text-sm font-bold text-ink">{provider}</div>
      <div className="mt-1 break-all text-xs text-slate-500">{model}</div>
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-black/15 bg-paper px-4 py-10 text-center text-sm leading-6 text-slate-500">{text}</div>;
}

export function Notice({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "error" | "success" | "warning" }) {
  return (
    <div
      className={cx(
        "rounded-md px-3 py-2 text-sm",
        tone === "error" && "bg-red-50 text-red-700",
        tone === "success" && "bg-green-50 text-green-700",
        tone === "warning" && "bg-amber-50 text-amber-700",
        tone === "info" && "bg-cobalt/10 text-cobalt"
      )}
    >
      {children}
    </div>
  );
}
