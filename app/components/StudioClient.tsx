"use client";

import { useEffect, useState } from "react";
import { ConfigStatus, MindmapResult } from "@/lib/types";
import { cx } from "@/lib/utils";
import { ChartWorkspace } from "./chart/ChartWorkspace";
import { FigureWorkspace } from "./figure/FigureWorkspace";
import { MindmapWorkspace } from "./mindmap/MindmapWorkspace";

type WorkMode = "mindmap" | "figure" | "chart";

export function StudioClient() {
  const [mode, setMode] = useState<WorkMode>("mindmap");
  const [mindmapFile, setMindmapFile] = useState<File | null>(null);
  const [mindmapText, setMindmapText] = useState("");
  const [mindmapResult, setMindmapResult] = useState<MindmapResult | null>(null);
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    try {
      const response = await fetch("/api/config");
      if (!response.ok) return;
      const data = (await response.json()) as ConfigStatus;
      setConfig(data);
    } catch {
      // Config status is non-critical; leave it null and the UI shows "reading status".
    }
  }

  async function generatePaperMindmap() {
    if (loading) return;
    setLoading(true);
    setStatus("正在解析 PDF 并生成论文导图...");
    setError("");
    try {
      const formData = new FormData();
      formData.set("text", mindmapText);
      if (mindmapFile) formData.set("file", mindmapFile);
      const response = await fetch("/api/mindmap", { method: "POST", body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "导图生成失败");
        return;
      }
      setMindmapResult(data as MindmapResult);
    } catch {
      setError("请求失败，请检查网络或本地服务后重试。");
    } finally {
      setStatus("");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-7xl px-5 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-wide text-coral">Paper Figure Studio</div>
              <h1 className="mt-1 text-3xl font-black tracking-normal text-ink">把论文内容整理成可用的视觉材料</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">先把 PDF 变成论文导图，或把你的研究内容变成科研图方案、Prompt 和 SVG 草图。</p>
            </div>
            <ConfigPill config={config} mode={mode} />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <ModeButton
              active={mode === "mindmap"}
              title="读论文：生成导图"
              description="上传论文或粘贴文本，整理成大纲、Markdown、Mermaid、XMind。"
              onClick={() => setMode("mindmap")}
            />
            <ModeButton
              active={mode === "figure"}
              title="讲项目：生成架构图"
              description="把方法描述变成引言用的全文架构图、可编辑 SVG。"
              onClick={() => setMode("figure")}
            />
            <ModeButton
              active={mode === "chart"}
              title="出数据：生成图表代码"
              description="粘数据，生成出版级 seaborn / ggplot2 绘图代码。"
              onClick={() => setMode("chart")}
            />
          </div>
        </div>
      </header>

      {mode === "mindmap" ? (
        <MindmapWorkspace
          text={mindmapText}
          setText={setMindmapText}
          file={mindmapFile}
          setFile={setMindmapFile}
          result={mindmapResult}
          status={status}
          error={error}
          loading={loading}
          onGenerate={generatePaperMindmap}
          config={config}
        />
      ) : mode === "chart" ? (
        <ChartWorkspace />
      ) : (
        <FigureWorkspace config={config} />
      )}
    </main>
  );
}

function ModeButton({ active, title, description, onClick }: { active: boolean; title: string; description: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-lg border p-4 text-left transition",
        active ? "border-ink bg-ink text-white shadow-soft" : "border-black/10 bg-paper text-ink hover:border-cobalt"
      )}
    >
      <div className="text-base font-black">{title}</div>
      <div className={cx("mt-1 text-sm leading-5", active ? "text-white/75" : "text-slate-600")}>{description}</div>
    </button>
  );
}

function ConfigPill({ config, mode }: { config: ConfigStatus | null; mode: WorkMode }) {
  if (!config) return null;
  const modeHint =
    mode === "mindmap"
      ? "当前：导图只用文本模型"
      : mode === "chart"
        ? "当前：图表只生成代码"
        : "当前：严谨 SVG，AI 配图可选";
  return (
    <div className="flex flex-wrap gap-2 text-xs font-bold text-slate-600">
      <span className={cx("rounded-md px-2.5 py-1.5", config.llm.ready ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700")}>LLM: {config.llm.provider}</span>
      <span className="rounded-md bg-paper px-2.5 py-1.5 text-slate-600">{modeHint}</span>
      {mode === "figure" && config.image.ready ? <span className="rounded-md bg-green-50 px-2.5 py-1.5 text-green-700">Image ready: {config.image.provider}</span> : null}
    </div>
  );
}
