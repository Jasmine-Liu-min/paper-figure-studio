import { clampTextWithFlag } from "../utils";

export type ParsePaperFileResult = {
  text: string;
  status: "mineru" | "fallback" | "failed";
  message: string;
};

// Reject oversized uploads before doing any work: large PDFs OOM pdf.js and
// always exceed the serverless function time limit on MinerU.
const MAX_FILE_BYTES = 15 * 1024 * 1024;
// Cap pages parsed locally so a 300-page PDF can't hang the request.
const MAX_PDF_PAGES = 40;

function truncationNote(truncated: boolean) {
  return truncated ? "（论文较长，仅分析了前一部分内容）" : "";
}

export async function parsePaperFile(file: File): Promise<ParsePaperFileResult> {
  const fileName = file.name.toLowerCase();
  if (file.size > MAX_FILE_BYTES) {
    return {
      text: "",
      status: "failed",
      message: `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB，上限 15MB）。请压缩 PDF 或直接粘贴论文文本。`
    };
  }
  if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
    const { text, truncated } = clampTextWithFlag(await file.text());
    return {
      text,
      status: "fallback",
      message: `已读取文本文件。${truncationNote(truncated)}`
    };
  }

  if (fileName.endsWith(".pdf")) {
    const token = process.env.MINERU_API_KEY || process.env.MINERU_TOKEN;
    if (token) {
      const mineru = await parseWithMinerU(file);
      if (mineru.status === "mineru" && mineru.text) return mineru;
      // MinerU configured but failed → fall back to local pdfjs so upload still works.
      const local = await parseWithPdfjs(file);
      return local.text ? local : mineru;
    }
    // No MinerU token → local pdfjs extraction (zero-config, offline, free).
    return parseWithPdfjs(file);
  }

  if (fileName.endsWith(".docx")) {
    return {
      text: "",
      status: "failed",
      message: "DOCX adapter is reserved for the next step. Paste text to continue."
    };
  }

  return {
    text: "",
    status: "failed",
    message: "Unsupported file type. Use PDF, TXT, Markdown, or paste paper text."
  };
}

async function parseWithMinerU(file: File): Promise<ParsePaperFileResult> {
  const token = process.env.MINERU_API_KEY || process.env.MINERU_TOKEN;
  if (!token) {
    return {
      text: "",
      status: "fallback",
      message: "未配置 MinerU Token。请先在 mineru.net 拿到 API Token 填入 MINERU_API_KEY，或直接粘贴论文文本。"
    };
  }
  // MINERU_ENDPOINT overrides the base for private deployments; default = official cloud.
  const base = (process.env.MINERU_ENDPOINT || "https://mineru.net").replace(/\/+$/, "").replace(/\/api\/v4$/, "");
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  try {
    // 1) Request a presigned upload URL.
    const batchResponse = await fetch(`${base}/api/v4/file-urls/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        enable_formula: true,
        enable_table: true,
        language: "auto",
        model_version: "vlm",
        files: [{ name: file.name, is_ocr: false, data_id: "paper" }]
      })
    });
    const batchData = (await batchResponse.json()) as { code?: number; msg?: string; data?: { batch_id?: string; file_urls?: string[] } };
    if (!batchResponse.ok || batchData.code !== 0 || !batchData.data?.batch_id || !batchData.data.file_urls?.[0]) {
      return { text: "", status: "failed", message: `MinerU 申请上传链接失败：${batchData.msg || `HTTP ${batchResponse.status}`}。可先粘贴文本。` };
    }
    const batchId = batchData.data.batch_id;

    // 2) Upload the file to the presigned URL (no auth header on the PUT).
    const uploadResponse = await fetch(batchData.data.file_urls[0], { method: "PUT", body: await file.arrayBuffer() });
    if (!uploadResponse.ok) {
      return { text: "", status: "failed", message: `MinerU 上传文件失败：HTTP ${uploadResponse.status}。可先粘贴文本。` };
    }

    // 3) Poll for completion (parsing auto-starts after upload).
    const zipUrl = await pollMinerUBatch(`${base}/api/v4/extract-results/batch/${batchId}`, headers);
    if (!zipUrl) {
      return { text: "", status: "failed", message: "MinerU 解析超时或失败，请稍后重试或先粘贴文本。" };
    }

    // 4) Download the result zip and extract the markdown.
    const markdown = await fetchMinerUMarkdown(zipUrl);
    const { text, truncated } = clampTextWithFlag(markdown);
    return {
      text,
      status: text ? "mineru" : "failed",
      message: text ? `已用 MinerU 解析 PDF（含公式/表格/阅读顺序）。${truncationNote(truncated)}` : "MinerU 返回空内容，请先粘贴文本。"
    };
  } catch (error) {
    return {
      text: "",
      status: "failed",
      message: error instanceof Error ? `MinerU 解析出错：${error.message}` : "MinerU 解析失败，请先粘贴文本。"
    };
  }
}

// Local, offline PDF text extraction via pdf.js — zero-config fallback that
// needs no MinerU token. Good for single-column text/abstracts; complex
// two-column/formula layouts are better with MinerU.
async function parseWithPdfjs(file: File): Promise<ParsePaperFileResult> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await file.arrayBuffer());
    const doc = await pdfjs.getDocument({ data }).promise;
    const pageLimit = Math.min(doc.numPages, MAX_PDF_PAGES);
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const line = content.items.map((item) => ("str" in item ? (item as { str: string }).str : "")).join(" ");
      pages.push(line);
    }
    const pagesCapped = doc.numPages > MAX_PDF_PAGES;
    const { text, truncated } = clampTextWithFlag(pages.join("\n\n").replace(/[ \t]+/g, " ").replace(/\s+\n/g, "\n").trim());
    const note = pagesCapped ? `（仅解析前 ${MAX_PDF_PAGES} 页）` : truncationNote(truncated);
    return {
      text,
      status: text ? "fallback" : "failed",
      message: text
        ? `已用本地 pdfjs 解析 PDF(基础文本)。${note}复杂双栏/公式建议配 MinerU Token 获得更高精度。`
        : "本地解析未提取到文本(可能是扫描版 PDF)。请粘贴文本，或配置 MinerU。"
    };
  } catch (error) {
    return { text: "", status: "failed", message: error instanceof Error ? `本地 PDF 解析失败：${error.message}` : "本地 PDF 解析失败。" };
  }
}

// Poll within a bounded time budget. Serverless platforms (e.g. Vercel) cap a
// function at ~60s, so the default budget stays under that; self-hosted runs can
// raise it via MINERU_POLL_MS for very large PDFs.
async function pollMinerUBatch(
  url: string,
  headers: Record<string, string>,
  intervalMs = 5000,
  budgetMs = Number(process.env.MINERU_POLL_MS || 50000)
): Promise<string | null> {
  const attempts = Math.max(1, Math.floor(budgetMs / intervalMs));
  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(url, { headers });
    if (response.ok) {
      const payload = (await response.json()) as { data?: { extract_result?: Array<{ state?: string; full_zip_url?: string; err_msg?: string }> } };
      const item = payload.data?.extract_result?.[0];
      if (item?.state === "done" && item.full_zip_url) return item.full_zip_url;
      if (item?.state === "failed") return null;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

async function fetchMinerUMarkdown(zipUrl: string): Promise<string> {
  const { unzipSync, strFromU8 } = await import("fflate");
  const response = await fetch(zipUrl);
  if (!response.ok) throw new Error(`下载结果 zip 失败：HTTP ${response.status}`);
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  // Prefer full.md, then any .md file in the archive.
  const names = Object.keys(files);
  const mdName = names.find((name) => /full\.md$/i.test(name)) || names.find((name) => name.toLowerCase().endsWith(".md"));
  return mdName ? strFromU8(files[mdName]) : "";
}
