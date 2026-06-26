"use client";

import { useEffect, useState, type PointerEvent } from "react";
import { FigureArrow, FigureObject, FigureSpec } from "@/lib/types";
import { cx } from "@/lib/utils";
import { EmptyState } from "../ui";

export function SpecDragEditor({ spec, onChange }: { spec: FigureSpec; onChange: (spec: FigureSpec) => void }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(spec.objects[0]?.id ?? "");
  const [selectedArrowId, setSelectedArrowId] = useState(spec.arrows[0]?.id ?? "");
  const width = 860;
  const height = 420;
  const objects = spec.objects.slice(0, 9);
  const points = new Map(objects.map((object, index) => [object.id, editorPoint(object, index, objects.length, width, height)]));
  const selected = objects.find((object) => object.id === selectedId) ?? objects[0];
  const selectedArrow = spec.arrows.find((arrow) => arrow.id === selectedArrowId) ?? spec.arrows[0];

  // When the parent replaces `spec` (e.g. after optimize/rerender), reconcile the
  // stored selection so the property panels don't point at a node that's gone.
  useEffect(() => {
    if (!spec.objects.some((object) => object.id === selectedId)) setSelectedId(spec.objects[0]?.id ?? "");
    if (!spec.arrows.some((arrow) => arrow.id === selectedArrowId)) setSelectedArrowId(spec.arrows[0]?.id ?? "");
  }, [spec, selectedId, selectedArrowId]);

  function updateObject(id: string, next: Partial<FigureObject>) {
    const current = spec.objects.find((object) => object.id === id);
    const nextLabel = next.label ?? current?.label;
    const nextEvidence = next.evidence ?? current?.evidence;
    onChange({
      ...spec,
      objects: spec.objects.map((object) => (object.id === id ? { ...object, ...next } : object)),
      evidenceMapping: spec.evidenceMapping.map((mapping) =>
        mapping.targetId === id
          ? {
              ...mapping,
              claim: nextLabel ?? mapping.claim,
              sourceExcerpt: nextEvidence?.trim() || mapping.sourceExcerpt,
              risk: nextEvidence?.trim() ? "low" : mapping.risk
            }
          : mapping
      )
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!draggingId) return;
    const target = objects.find((object) => object.id === draggingId);
    if (!target || target.locked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    updateObject(draggingId, { position: { x: snapUnit(x), y: snapUnit(y) } });
  }

  function autoArrange() {
    onChange({
      ...spec,
      objects: spec.objects.map((object, index) => (object.locked ? object : { ...object, position: editorDefaultPosition(index, spec.objects.length, spec.figureType) }))
    });
  }

  function unlockAll() {
    onChange({
      ...spec,
      objects: spec.objects.map((object) => ({ ...object, locked: false }))
    });
  }

  function updateArrow(id: string, next: Partial<FigureArrow>) {
    onChange({
      ...spec,
      arrows: spec.arrows.map((arrow) => (arrow.id === id ? { ...arrow, ...next } : arrow))
    });
  }

  function deleteArrow(id: string) {
    const nextArrows = spec.arrows.filter((arrow) => arrow.id !== id);
    setSelectedArrowId(nextArrows[0]?.id ?? "");
    onChange({ ...spec, arrows: nextArrows });
  }

  function addArrow() {
    if (spec.objects.length < 2) return;
    const existing = new Set(spec.arrows.map((arrow) => `${arrow.from}:${arrow.to}`));
    const pair = spec.objects.slice(0, -1).find((object, index) => !existing.has(`${object.id}:${spec.objects[index + 1].id}`));
    const fromIndex = pair ? spec.objects.findIndex((object) => object.id === pair.id) : 0;
    const from = spec.objects[fromIndex];
    const to = spec.objects[Math.min(fromIndex + 1, spec.objects.length - 1)];
    if (!from || !to || from.id === to.id) return;
    const arrow: FigureArrow = {
      id: `arrow-manual-${Date.now().toString(36)}`,
      from: from.id,
      to: to.id,
      label: "supports",
      relation: "supports"
    };
    setSelectedArrowId(arrow.id);
    onChange({ ...spec, arrows: [...spec.arrows, arrow] });
  }

  return (
    <div className="mb-4 rounded-md border border-black/10 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-slate-500">拖拽布局</div>
          <p className="mt-1 text-xs leading-5 text-slate-600">拖动节点只改变位置，不改变证据映射；锁定后自动整理会跳过该节点。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={autoArrange} className="rounded-md border border-black/10 bg-paper px-3 py-2 text-xs font-bold text-slate-700 hover:border-cobalt">
            自动整理
          </button>
          <button onClick={unlockAll} className="rounded-md border border-black/10 bg-paper px-3 py-2 text-xs font-bold text-slate-700 hover:border-cobalt">
            全部解锁
          </button>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-auto w-full rounded-md border border-black/10 bg-[#fffdf8]"
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingId(null)}
        onPointerLeave={() => setDraggingId(null)}
      >
        <defs>
          <pattern id="editor-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#ece7dc" strokeWidth="1" />
          </pattern>
          <marker id="editor-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#17202a" />
          </marker>
        </defs>
        <rect width={width} height={height} fill="url(#editor-grid)" />
        {spec.arrows.map((arrow) => {
          const from = points.get(arrow.from);
          const to = points.get(arrow.to);
          if (!from || !to) return null;
          return (
            <g key={arrow.id} onClick={() => setSelectedArrowId(arrow.id)} className="cursor-pointer">
              <path d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} stroke={selectedArrowId === arrow.id ? "#315c9f" : "#17202a"} strokeWidth={selectedArrowId === arrow.id ? 3 : 2} markerEnd="url(#editor-arrow)" opacity="0.65" />
              {arrow.label ? (
                <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 7} textAnchor="middle" fontSize="11" fontWeight="800" fill="#586474">
                  {trimUi(arrow.label, 18)}
                </text>
              ) : null}
            </g>
          );
        })}
        {objects.map((object, index) => {
          const point = points.get(object.id) ?? editorPoint(object, index, objects.length, width, height);
          const riskTone = object.confidence >= 0.8 ? "#4b6f53" : "#c96850";
          return (
            <g
              key={object.id}
              transform={`translate(${point.x - 74} ${point.y - 30})`}
              className={object.locked ? "cursor-not-allowed" : "cursor-grab"}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setSelectedId(object.id);
                setDraggingId(object.id);
              }}
            >
              <rect width="148" height="60" rx="8" fill={object.locked ? "#f2eee5" : "#ffffff"} stroke={draggingId === object.id ? "#315c9f" : "#d8d2c6"} strokeWidth={draggingId === object.id ? 2 : 1} />
              <circle cx="18" cy="19" r="8" fill={riskTone} opacity="0.9" />
              <text x="34" y="20" fontSize="12" fontWeight="800" fill="#17202a">
                {trimUi(object.label, 18)}
              </text>
              <text x="34" y="40" fontSize="10" fontWeight="700" fill="#586474">
                {object.kind} · {Math.round(object.confidence * 100)}%
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {objects.map((object) => (
          <button
            key={object.id}
            onClick={() => updateObject(object.id, { locked: !object.locked })}
            className={cx(
              "flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-semibold",
              object.locked ? "border-coral/40 bg-coral/10 text-coral" : "border-black/10 bg-paper text-slate-700"
            )}
          >
            <span className="truncate">{object.label}</span>
            <span>{object.locked ? "已锁定" : "可拖动"}</span>
          </button>
        ))}
      </div>
      {selected ? <ObjectPropertyPanel object={selected} onUpdate={(next) => updateObject(selected.id, next)} /> : null}
      <ArrowPropertyPanel
        arrow={selectedArrow}
        objects={spec.objects}
        onAdd={addArrow}
        onDelete={deleteArrow}
        onUpdate={(id, next) => updateArrow(id, next)}
      />
    </div>
  );
}

function ArrowPropertyPanel({
  arrow,
  objects,
  onAdd,
  onDelete,
  onUpdate
}: {
  arrow?: FigureArrow;
  objects: FigureObject[];
  onAdd: () => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, next: Partial<FigureArrow>) => void;
}) {
  const relations: FigureArrow["relation"][] = ["flow", "causal", "feedback", "contrast", "supports"];
  return (
    <div className="mt-3 rounded-md border border-black/10 bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase text-slate-500">关系箭头</div>
          <p className="mt-1 text-xs leading-5 text-slate-600">只表达输入文本支持的关系，避免把流程箭头画成因果结论。</p>
        </div>
        <button onClick={onAdd} className="rounded-md border border-black/10 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-cobalt">
          新增关系
        </button>
      </div>
      {arrow ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">From</span>
            <select
              value={arrow.from}
              onChange={(event) => onUpdate(arrow.id, { from: event.target.value })}
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
            >
              {objects.map((object) => (
                <option key={object.id} value={object.id}>
                  {object.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">To</span>
            <select
              value={arrow.to}
              onChange={(event) => onUpdate(arrow.id, { to: event.target.value })}
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
            >
              {objects.map((object) => (
                <option key={object.id} value={object.id}>
                  {object.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">关系标签</span>
            <input
              value={arrow.label}
              onChange={(event) => onUpdate(arrow.id, { label: event.target.value })}
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
            />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase text-slate-500">关系类型</span>
            <select
              value={arrow.relation}
              onChange={(event) => onUpdate(arrow.id, { relation: event.target.value as FigureArrow["relation"] })}
              className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
            >
              {relations.map((relation) => (
                <option key={relation} value={relation}>
                  {relation}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => onDelete(arrow.id)} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:border-red-400 lg:col-span-2">
            删除当前关系
          </button>
        </div>
      ) : (
        <EmptyState text="当前没有关系箭头，可以新增一个。" />
      )}
    </div>
  );
}

function ObjectPropertyPanel({ object, onUpdate }: { object: FigureObject; onUpdate: (next: Partial<FigureObject>) => void }) {
  const kinds: FigureObject["kind"][] = ["concept", "dataset", "process", "model", "metric", "finding", "cell", "molecule", "output"];
  return (
    <div className="mt-3 grid gap-3 rounded-md border border-black/10 bg-paper p-3 lg:grid-cols-[minmax(0,1fr)_160px]">
      <label className="block">
        <span className="text-xs font-black uppercase text-slate-500">节点标签</span>
        <input
          value={object.label}
          onChange={(event) => onUpdate({ label: event.target.value })}
          className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        />
      </label>
      <label className="block">
        <span className="text-xs font-black uppercase text-slate-500">节点类型</span>
        <select
          value={object.kind}
          onChange={(event) => onUpdate({ kind: event.target.value as FigureObject["kind"] })}
          className="mt-1 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-cobalt"
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </label>
      <label className="block lg:col-span-2">
        <span className="text-xs font-black uppercase text-slate-500">证据摘录</span>
        <textarea
          value={object.evidence ?? ""}
          onChange={(event) => onUpdate({ evidence: event.target.value, confidence: event.target.value.trim() ? Math.max(object.confidence, 0.82) : 0.52 })}
          className="mt-1 min-h-20 w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-cobalt"
        />
      </label>
    </div>
  );
}

function editorPoint(object: FigureObject, index: number, total: number, width: number, height: number) {
  const fallback = editorDefaultPosition(index, total, "method-framework", object);
  const x = object.position?.x ?? fallback.x;
  const y = object.position?.y ?? fallback.y;
  return {
    x: 48 + clampUnit(x) * (width - 96),
    y: 54 + clampUnit(y) * (height - 108)
  };
}

function editorDefaultPosition(index: number, total: number, figureType: FigureSpec["figureType"], object?: FigureObject) {
  const count = Math.max(total, 1);
  if (figureType === "graphical-abstract") {
    if (index === count - 1) return { x: 0.5, y: 0.5 };
    const angle = (-90 + (360 / Math.max(count - 1, 1)) * index) * (Math.PI / 180);
    return { x: clampUnit(0.5 + Math.cos(angle) * 0.34), y: clampUnit(0.52 + Math.sin(angle) * 0.28) };
  }
  if (figureType === "comparison") return { x: index % 2 ? 0.68 : 0.32, y: clampUnit(0.24 + Math.floor(index / 2) * 0.2) };
  if (figureType === "timeline") return { x: 0.1 + (0.8 / Math.max(count - 1, 1)) * index, y: index % 2 ? 0.62 : 0.4 };
  if (figureType === "mechanism") {
    return (
      [
        { x: 0.16, y: 0.5 },
        { x: 0.38, y: 0.34 },
        { x: 0.56, y: 0.5 },
        { x: 0.38, y: 0.68 },
        { x: 0.8, y: 0.5 }
      ][index] ?? { x: 0.12 + index * 0.12, y: 0.5 }
    );
  }
  if (figureType === "experiment-flow") return { x: 0.44, y: 0.18 + (0.64 / Math.max(count - 1, 1)) * index };
  if (figureType === "neural-network") return { x: index % 2 ? 0.58 : 0.32, y: 0.2 + (0.6 / Math.max(count - 1, 1)) * index };
  if (object) {
    const stage = editorStageForObject(object);
    const stageItemsBefore = Math.max(0, indexWithinStage(index, total, stage));
    const stageCounts = approximateStageCounts(total);
    const countInStage = Math.max(1, stageCounts[stage]);
    return {
      x: [0.14, 0.38, 0.62, 0.86][stage],
      y: 0.22 + (0.56 / Math.max(countInStage - 1, 1)) * stageItemsBefore
    };
  }
  return { x: 0.1 + (0.8 / Math.max(count - 1, 1)) * index, y: 0.5 };
}

function editorStageForObject(object: FigureObject) {
  const label = object.label.toLowerCase();
  if (/输出|诊断|风险评分|热力图|证据摘要|auc|f1|召回|output|score|heatmap/.test(label) || object.kind === "output" || object.kind === "metric" || object.kind === "finding") return 3;
  if (/编码器|encoder|特征|病灶|症状|病史|用药|feature/.test(label) || object.kind === "process") return 1;
  if (/medfuse|跨模态|注意力|融合|attention|fusion|框架|模型|model/.test(label) || object.kind === "model") return 2;
  return 0;
}

function approximateStageCounts(total: number) {
  if (total >= 9) return [3, 2, 1, 3];
  if (total >= 8) return [3, 2, 1, 2];
  if (total >= 6) return [2, 2, 1, Math.max(1, total - 5)];
  return [1, 1, 1, Math.max(1, total - 3)];
}

function indexWithinStage(index: number, total: number, stage: number) {
  const counts = approximateStageCounts(total);
  const start = counts.slice(0, stage).reduce((sum, count) => sum + count, 0);
  return index - start;
}

function snapUnit(value: number) {
  return Number((Math.round(clampUnit(value) / 0.025) * 0.025).toFixed(3));
}

function clampUnit(value: number) {
  return Math.max(0.06, Math.min(0.94, value));
}

function trimUi(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
