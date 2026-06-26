"use client";

import { downloadSvgAsPdf, downloadSvgAsPng, downloadTextFile, triggerDownload } from "@/lib/infra/exportUtils";
import { ConfigStatus, MindmapResult } from "@/lib/types";
import { sanitizeSvgMarkup } from "@/lib/infra/sanitizeSvg";
import { cx, slugify } from "@/lib/utils";
import { EmptyState, Notice, Panel, ProviderRow, TextBlock } from "../ui";

type XmindTopic = {
  id: string;
  title: string;
  notes?: { plain: { content: string } };
  children?: { attached: XmindTopic[] };
};

export function MindmapWorkspace({
  text,
  setText,
  file,
  setFile,
  result,
  status,
  error,
  loading,
  onGenerate,
  config
}: {
  text: string;
  setText: (value: string) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  result: MindmapResult | null;
  status: string;
  error: string;
  loading: boolean;
  onGenerate: () => void;
  config: ConfigStatus | null;
}) {
  function downloadXmind(result: MindmapResult) {
    const bytes = buildXmindArchive(result);
    triggerDownload(new Blob([bytes], { type: "application/vnd.xmind.workbook" }), `${slugify(result.title) || "paper-mindmap"}.xmind`);
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-5 py-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <section className="space-y-4">
        <Panel title="1. 上传论文或粘贴文本" eyebrow="Input">
          <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-black/20 bg-white px-3 py-4 text-sm">
            <span className="text-slate-700">{file ? file.name : "上传论文 PDF / TXT / Markdown"}</span>
            <input type="file" accept=".pdf,.txt,.md" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="my-3 text-center text-xs font-bold text-slate-400">或粘贴论文内容</div>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="如果 PDF 解析未配置 MinerU，可以先粘贴摘要、方法、结果等内容跑通导图。"
            className="min-h-72 w-full rounded-md border border-black/10 bg-white px-3 py-3 text-sm leading-6 outline-none focus:border-cobalt"
          />
          <button
            onClick={onGenerate}
            disabled={loading}
            className="mt-3 w-full rounded-md bg-ink px-4 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "正在生成..." : "生成论文导图"}
          </button>
        </Panel>
        <Panel title="2. 解析方式" eyebrow="Provider">
          {config ? (
            <div className="space-y-3">
              <ProviderRow title="LLM 导图" provider={config.llm.provider} model={config.llm.model} ready={config.llm.ready} />
              <p className="text-xs leading-5 text-slate-500">PDF 导图只需要文本 LLM。没有 API 时会使用本地 fallback，适合先验证流程。</p>
            </div>
          ) : (
            <EmptyState text="正在读取 API 配置状态。" />
          )}
        </Panel>
      </section>

      <section className="space-y-4">
        {error ? <Notice tone="error">{error}</Notice> : null}
        {status ? <Notice>{status}</Notice> : null}
        <Panel title="论文导图" eyebrow="Mindmap">
          {result ? (
            <div className="space-y-4">
              <div className="rounded-md bg-paper p-3 text-sm text-slate-700">
                <div>{result.parser.message}</div>
                <div className="mt-1">{result.planner.message}</div>
              </div>
              {result.planner.status === "fallback" ? (
                <Notice tone="warning">未调用 LLM（超时或未配置），当前为本地模板导图，质量有限。配置文本模型后重试可得到更准的结构。</Notice>
              ) : null}
              <h2 className="text-xl font-black text-ink">{result.title}</h2>
              <div
                className="overflow-auto rounded-md border border-black/10 bg-white p-2 [&>svg]:h-auto [&>svg]:max-w-full"
                role="img"
                aria-label={`论文导图：${result.title}`}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(result.svg) }}
              />
              <MindmapTree node={result.outline} />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void downloadSvgAsPng(result.svg, `${slugify(result.title) || "paper-mindmap"}.png`)}
                  className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  导出 PNG
                </button>
                <button
                  onClick={() => void downloadSvgAsPdf(result.svg, `${slugify(result.title) || "paper-mindmap"}.pdf`)}
                  className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  导出 PDF
                </button>
                <button
                  onClick={() => downloadTextFile(result.svg, `${slugify(result.title) || "paper-mindmap"}.svg`, "image/svg+xml;charset=utf-8")}
                  className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  导出 SVG
                </button>
                <button
                  onClick={() => downloadTextFile(result.markdown, `${slugify(result.title) || "paper-mindmap"}.md`, "text/markdown;charset=utf-8")}
                  className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  导出 Markdown
                </button>
                <button
                  onClick={() => downloadTextFile(result.mermaid, `${slugify(result.title) || "paper-mindmap"}.mmd`, "text/plain;charset=utf-8")}
                  className="rounded-md border border-black/10 bg-white px-3 py-2 text-sm font-semibold hover:border-cobalt"
                >
                  导出 Mermaid
                </button>
                <button
                  onClick={() => downloadXmind(result)}
                  className="rounded-md bg-coral px-3 py-2 text-sm font-semibold text-white hover:bg-[#b85d47]"
                >
                  导出 XMind
                </button>
              </div>
            </div>
          ) : (
            <EmptyState text="上传 PDF 或粘贴论文内容后，会生成论文结构导图、Markdown 和 Mermaid。" />
          )}
        </Panel>

        <Panel title="Mermaid 源码" eyebrow="Export">
          {result ? <TextBlock title="Mindmap" value={result.mermaid} mono /> : <EmptyState text="生成后这里会显示 Mermaid mindmap 源码。" />}
        </Panel>
      </section>
    </div>
  );
}

function buildXmindArchive(result: MindmapResult) {
  const now = new Date().toISOString();
  const content = [
    {
      id: result.id,
      class: "sheet",
      title: result.title,
      rootTopic: toXmindTopic(result.outline),
      topicPositioning: "fixed",
      extensions: []
    }
  ];
  const metadata = {
    creator: {
      name: "Paper Figure Studio",
      version: "0.1.0"
    },
    created: now,
    modified: now
  };
  const manifest = {
    "file-entries": {
      "content.json": {},
      "metadata.json": {}
    }
  };
  return zipStore({
    "content.json": JSON.stringify(content, null, 2),
    "metadata.json": JSON.stringify(metadata, null, 2),
    "manifest.json": JSON.stringify(manifest, null, 2)
  });
}

function toXmindTopic(node: MindmapResult["outline"]): XmindTopic {
  return {
    id: node.id,
    title: node.title,
    notes: node.summary ? { plain: { content: node.summary } } : undefined,
    children: node.children.length
      ? {
          attached: node.children.map(toXmindTopic)
        }
      : undefined
  };
}

function zipStore(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  Object.entries(files).forEach(([name, value]) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(value);
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data
    ]);
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes
    ]);
    localParts.push(local);
    centralParts.push(central);
    offset += local.length;
  });

  const centralDirectory = concatBytes(centralParts);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centralParts.length),
    u16(centralParts.length),
    u32(centralDirectory.length),
    u32(offset),
    u16(0)
  ]);
  return concatBytes([...localParts, centralDirectory, end]);
}

function concatBytes(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function u16(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function u32(value: number) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function MindmapTree({ node }: { node: MindmapResult["outline"] }) {
  return (
    <div className="rounded-md border border-black/10 bg-white p-4">
      <div className="text-base font-black text-ink">{node.title}</div>
      {node.summary ? <p className="mt-1 text-sm leading-6 text-slate-600">{node.summary}</p> : null}
      {node.children.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {node.children.map((child) => (
            <div key={child.id} className="rounded-md bg-paper p-3">
              <div className="font-bold text-ink">{child.title}</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">{child.summary}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {child.children.map((leaf) => (
                  <li key={leaf.id}>- {leaf.title}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
