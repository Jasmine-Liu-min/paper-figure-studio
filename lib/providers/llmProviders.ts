import { ArchitectureDiagram, FigurePlan, MindmapNode, PaperInput, PaperStructure } from "../types";
import { hashId } from "../utils";
import { palettePromptText } from "../palettes";

export type PlannedFigure = Omit<FigurePlan, "id" | "svg" | "score" | "mermaid"> & { score?: number; diagram?: ArchitectureDiagram };

export type LlmPlanningResult =
  | {
      ok: true;
      provider: string;
      message: string;
      structure?: PaperStructure;
      plans: PlannedFigure[];
    }
  | {
      ok: false;
      provider: string;
      message: string;
    };

export type MindmapPlanningResult =
  | {
      ok: true;
      provider: string;
      message: string;
      outline: MindmapNode;
    }
  | {
      ok: false;
      provider: string;
      message: string;
    };

export async function planWithLlm(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  const provider = process.env.LLM_PROVIDER || "mock";
  if (provider === "openai") return planWithOpenAI(input, structure);
  if (provider === "gemini") return planWithGemini(input, structure);
  if (provider === "openrouter") return planWithOpenRouter(input, structure);
  if (provider === "cloudflare") return planWithCloudflare(input, structure);
  if (provider === "gateway") return planWithGateway(input, structure);
  if (isCustomProvider(provider)) return planWithCustom(input, structure);
  return {
    ok: false,
    provider: "mock",
    message: "LLM_PROVIDER is mock. Used deterministic fallback planning."
  };
}

// Generic single-prompt text call routed to the configured LLM provider.
// Returns raw text (no JSON parsing) for features like chart-code generation.
export async function runLlmText(prompt: string, temperature = 0.25): Promise<{ ok: boolean; provider: string; text: string; message: string }> {
  const provider = process.env.LLM_PROVIDER || "mock";
  try {
    if (provider === "gateway" || isCustomProvider(provider)) {
      const config = compatibleTextConfig(provider === "gateway" ? "gateway" : "custom");
      if (!config.ok) return { ok: false, provider, text: "", message: config.message };
      const text = await callCompatibleText(config, prompt, temperature);
      return { ok: true, provider, text, message: "ok" };
    }
    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) return { ok: false, provider, text: "", message: "OPENAI_API_KEY is missing." };
      const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, input: prompt, text: { format: { type: "text" } }, temperature })
      });
      if (!response.ok) return { ok: false, provider, text: "", message: `OpenAI failed with HTTP ${response.status}.` };
      return { ok: true, provider, text: extractOpenAIText(await response.json()), message: "ok" };
    }
    if (provider === "gemini") {
      if (!process.env.GEMINI_API_KEY) return { ok: false, provider, text: "", message: "GEMINI_API_KEY is missing." };
      const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash";
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } })
      });
      if (!response.ok) return { ok: false, provider, text: "", message: `Gemini failed with HTTP ${response.status}.` };
      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n") ?? "";
      return { ok: true, provider, text, message: "ok" };
    }
    if (provider === "openrouter") {
      if (!process.env.OPENROUTER_API_KEY) return { ok: false, provider, text: "", message: "OPENROUTER_API_KEY is missing." };
      const model = process.env.OPENROUTER_TEXT_MODEL || "google/gemini-2.0-flash-exp:free";
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature })
      });
      if (!response.ok) return { ok: false, provider, text: "", message: `OpenRouter failed with HTTP ${response.status}.` };
      return { ok: true, provider, text: extractChatCompletionText(await response.json()), message: "ok" };
    }
    if (provider === "cloudflare") {
      if (!process.env.CLOUDFLARE_API_KEY || !process.env.CLOUDFLARE_ACCOUNT_ID) return { ok: false, provider, text: "", message: "Cloudflare credentials missing." };
      const model = process.env.CLOUDFLARE_TEXT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature })
      });
      if (!response.ok) return { ok: false, provider, text: "", message: `Cloudflare failed with HTTP ${response.status}.` };
      return { ok: true, provider, text: extractChatCompletionText(await response.json()), message: "ok" };
    }
    return { ok: false, provider: "mock", text: "", message: "LLM_PROVIDER is mock; no live text model configured." };
  } catch (error) {
    return { ok: false, provider, text: "", message: error instanceof Error ? error.message : "LLM text call failed." };
  }
}

export async function planMindmapWithLlm(text: string, structure: PaperStructure): Promise<MindmapPlanningResult> {
  const provider = process.env.LLM_PROVIDER || "mock";
  const prompt = buildMindmapPrompt(text, structure);
  if (provider === "openai") return planMindmapWithOpenAI(prompt);
  if (provider === "gemini") return planMindmapWithGemini(prompt);
  if (provider === "openrouter") return planMindmapWithOpenRouter(prompt);
  if (provider === "cloudflare") return planMindmapWithCloudflare(prompt);
  if (provider === "gateway") return planMindmapWithGateway(prompt);
  if (isCustomProvider(provider)) return planMindmapWithCustom(prompt);
  return { ok: false, provider: "mock", message: "LLM_PROVIDER is mock. Used deterministic fallback mindmap." };
}

async function planMindmapWithGateway(prompt: string): Promise<MindmapPlanningResult> {
  const config = compatibleTextConfig("gateway");
  if (!config.ok) return { ok: false, provider: "gateway", message: config.message };
  try {
    const text = await callCompatibleText(config, prompt, 0.25);
    return parseMindmapJson(text, "gateway");
  } catch (error) {
    return { ok: false, provider: "gateway", message: error instanceof Error ? error.message : "Gateway mindmap failed. Used fallback mindmap." };
  }
}

async function planMindmapWithCustom(prompt: string): Promise<MindmapPlanningResult> {
  const config = compatibleTextConfig("custom");
  if (!config.ok) return { ok: false, provider: "custom", message: config.message };
  try {
    const text = await callCompatibleText(config, prompt, 0.25);
    return parseMindmapJson(text, "custom");
  } catch (error) {
    return { ok: false, provider: "custom", message: error instanceof Error ? error.message : "Custom provider mindmap failed. Used fallback mindmap." };
  }
}

async function planMindmapWithOpenAI(prompt: string): Promise<MindmapPlanningResult> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, provider: "openai", message: "OPENAI_API_KEY is missing. Used fallback mindmap." };
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: prompt, text: { format: { type: "text" } }, temperature: 0.25 })
    });
    if (!response.ok) return { ok: false, provider: "openai", message: `OpenAI mindmap failed with HTTP ${response.status}. Used fallback mindmap.` };
    return parseMindmapJson(extractOpenAIText(await response.json()), "openai");
  } catch (error) {
    return { ok: false, provider: "openai", message: error instanceof Error ? error.message : "OpenAI mindmap failed. Used fallback mindmap." };
  }
}

async function planMindmapWithGemini(prompt: string): Promise<MindmapPlanningResult> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, provider: "gemini", message: "GEMINI_API_KEY is missing. Used fallback mindmap." };
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.25 } })
    });
    if (!response.ok) return { ok: false, provider: "gemini", message: `Gemini mindmap failed with HTTP ${response.status}. Used fallback mindmap.` };
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n") ?? "";
    return parseMindmapJson(text, "gemini");
  } catch (error) {
    return { ok: false, provider: "gemini", message: error instanceof Error ? error.message : "Gemini mindmap failed. Used fallback mindmap." };
  }
}

async function planMindmapWithOpenRouter(prompt: string): Promise<MindmapPlanningResult> {
  if (!process.env.OPENROUTER_API_KEY) return { ok: false, provider: "openrouter", message: "OPENROUTER_API_KEY is missing. Used fallback mindmap." };
  const model = process.env.OPENROUTER_TEXT_MODEL || "google/gemini-2.0-flash-exp:free";
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://127.0.0.1:3000",
        "X-OpenRouter-Title": "Paper Figure Studio"
      },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], response_format: { type: "json_object" }, temperature: 0.25 })
    });
    if (!response.ok) return { ok: false, provider: "openrouter", message: `OpenRouter mindmap failed with HTTP ${response.status}. Used fallback mindmap.` };
    return parseMindmapJson(extractChatCompletionText(await response.json()), "openrouter");
  } catch (error) {
    return { ok: false, provider: "openrouter", message: error instanceof Error ? error.message : "OpenRouter mindmap failed. Used fallback mindmap." };
  }
}

async function planMindmapWithCloudflare(prompt: string): Promise<MindmapPlanningResult> {
  if (!process.env.CLOUDFLARE_API_KEY || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    return { ok: false, provider: "cloudflare", message: "CLOUDFLARE_API_KEY or CLOUDFLARE_ACCOUNT_ID is missing. Used fallback mindmap." };
  }
  const model = process.env.CLOUDFLARE_TEXT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.25 })
    });
    if (!response.ok) return { ok: false, provider: "cloudflare", message: `Cloudflare mindmap failed with HTTP ${response.status}. Used fallback mindmap.` };
    return parseMindmapJson(extractChatCompletionText(await response.json()), "cloudflare");
  } catch (error) {
    return { ok: false, provider: "cloudflare", message: error instanceof Error ? error.message : "Cloudflare mindmap failed. Used fallback mindmap." };
  }
}

async function planWithOpenRouter(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  if (!process.env.OPENROUTER_API_KEY) {
    return { ok: false, provider: "openrouter", message: "OPENROUTER_API_KEY is missing. Used fallback planning." };
  }
  const model = process.env.OPENROUTER_TEXT_MODEL || "google/gemini-2.0-flash-exp:free";
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://127.0.0.1:3000",
        "X-OpenRouter-Title": "Paper Figure Studio"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildPlannerPrompt(input, structure) }],
        response_format: { type: "json_object" },
        temperature: 0.35
      })
    });
    if (!response.ok) return { ok: false, provider: "openrouter", message: `OpenRouter planner failed with HTTP ${response.status}. Used fallback planning.` };
    const data = await response.json();
    const text = extractChatCompletionText(data);
    return parsePlannerJson(text, "openrouter");
  } catch (error) {
    return { ok: false, provider: "openrouter", message: error instanceof Error ? error.message : "OpenRouter planner failed. Used fallback planning." };
  }
}

async function planWithCloudflare(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  if (!process.env.CLOUDFLARE_API_KEY || !process.env.CLOUDFLARE_ACCOUNT_ID) {
    return { ok: false, provider: "cloudflare", message: "CLOUDFLARE_API_KEY or CLOUDFLARE_ACCOUNT_ID is missing. Used fallback planning." };
  }
  const model = process.env.CLOUDFLARE_TEXT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: buildPlannerPrompt(input, structure) }],
        temperature: 0.35
      })
    });
    if (!response.ok) return { ok: false, provider: "cloudflare", message: `Cloudflare planner failed with HTTP ${response.status}. Used fallback planning.` };
    const data = await response.json();
    const text = extractChatCompletionText(data);
    return parsePlannerJson(text, "cloudflare");
  } catch (error) {
    return { ok: false, provider: "cloudflare", message: error instanceof Error ? error.message : "Cloudflare planner failed. Used fallback planning." };
  }
}

async function planWithGateway(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  const config = compatibleTextConfig("gateway");
  if (!config.ok) return { ok: false, provider: "gateway", message: config.message };
  try {
    const text = await callCompatibleText(config, buildPlannerPrompt(input, structure), 0.35);
    return parsePlannerJson(text, "gateway");
  } catch (error) {
    return { ok: false, provider: "gateway", message: error instanceof Error ? error.message : "Gateway planner failed. Used fallback planning." };
  }
}

async function planWithCustom(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  const config = compatibleTextConfig("custom");
  if (!config.ok) return { ok: false, provider: "custom", message: config.message };
  try {
    const text = await callCompatibleText(config, buildPlannerPrompt(input, structure), 0.35);
    return parsePlannerJson(text, "custom");
  } catch (error) {
    return { ok: false, provider: "custom", message: error instanceof Error ? error.message : "Custom provider planner failed. Used fallback planning." };
  }
}

async function planWithOpenAI(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { ok: false, provider: "openai", message: "OPENAI_API_KEY is missing. Used fallback planning." };
  }
  const model = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        input: buildPlannerPrompt(input, structure),
        text: { format: { type: "text" } },
        temperature: 0.35
      })
    });
    if (!response.ok) return { ok: false, provider: "openai", message: `OpenAI planner failed with HTTP ${response.status}. Used fallback planning.` };
    const data = await response.json();
    const text = extractOpenAIText(data);
    return parsePlannerJson(text, "openai");
  } catch (error) {
    return { ok: false, provider: "openai", message: error instanceof Error ? error.message : "OpenAI planner failed. Used fallback planning." };
  }
}

async function planWithGemini(input: PaperInput, structure: PaperStructure): Promise<LlmPlanningResult> {
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, provider: "gemini", message: "GEMINI_API_KEY is missing. Used fallback planning." };
  }
  const model = process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash";
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": process.env.GEMINI_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildPlannerPrompt(input, structure) }] }],
        generationConfig: { temperature: 0.35 }
      })
    });
    if (!response.ok) return { ok: false, provider: "gemini", message: `Gemini planner failed with HTTP ${response.status}. Used fallback planning.` };
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("\n") ?? "";
    return parsePlannerJson(text, "gemini");
  } catch (error) {
    return { ok: false, provider: "gemini", message: error instanceof Error ? error.message : "Gemini planner failed. Used fallback planning." };
  }
}

function buildPlannerPrompt(input: PaperInput, structure: PaperStructure) {
  return `You are a multi-agent scientific figure design system inspired by PaperBanana, ChatPaper2Xmind, and academic figure generators.

Task:
1. Refine the paper structure.
2. Generate exactly 1 polished scientific figure plan (with its full diagram).
3. Give it a publication-readiness score.
4. Return strict JSON only. No markdown fences. Keep the response compact so it returns fast.

JSON shape:
{
  "structure": {
    "title": "string",
    "abstract": "string",
    "methods": [{"title":"string","content":"string"}],
    "results": [{"title":"string","content":"string"}],
    "keywords": ["string"],
    "limitations": ["string"]
  },
  "plans": [
    {
      "name": "string",
      "score": 88,
      "rationale": "string",
      "layout": "string",
      "caption": "string",
      "modules": ["EXACTLY 4-7 figure node labels in ENGLISH Title Case: concise TECHNICAL NOUN PHRASES naming actual components/blocks (e.g. 'Spectral Analysis Block', 'Pyramid Attention Module', 'Quantile Head'), ordered from inputs to outputs, each <= 5 words, NO Chinese, NO full sentences, NO verbs, NO trailing fragments"],
      "diagram": {
        "blocks": [{"title": "English block name <= 4 words", "abbrev": "optional short tag e.g. SAB", "substeps": ["2-5 internal operations, each <= 4 words e.g. 'FFT', 'Learnable Freq Transform', 'iFFT', 'Residual + LayerNorm'"], "category": "one lowercase word grouping color e.g. spectral / attention / fusion / output / input"}],
        "connections": [{"from": "exact block title", "to": "exact block title", "label": "optional tensor/shape annotation e.g. 'Z0 ∈ R^{H×d}' or 'H×d'"}],
        "legend": [{"label": "Human-readable category name", "category": "matches block category"}]
      },
      "relationships": ["A -> B, using the exact module label text on both sides"],
      "visualNotes": ["specific rendering advice"],
      "prompt": "English image generation prompt for a journal-ready academic figure",
      "negativePrompt": "English negative prompt"
    }
  ]
}

Constraints:
- Chinese user, English image prompts.
- Do not invent numeric results.
- Prefer editable vector-like diagrams over decorative illustrations.
- "modules" become the labeled boxes in the rendered figure. They MUST read as clean, self-contained technical terms a reviewer would recognize — never sentence fragments, never cut off mid-word.
- "diagram" drives a DENSE architecture schematic (like a top-tier paper method figure). List 4-8 main processing blocks left-to-right in dataflow order; give each 2-5 concrete internal sub-steps (operations/layers actually described in the paper). Add inter-block connections (use exact block titles) with optional tensor-shape labels only when the paper states them. Provide a small legend grouping blocks by category. Everything in English, no fabricated numbers.
- Return exactly ONE plan in the "plans" array (the single best figure), with its full "diagram". Keep all text compact so the response returns quickly.
- Figure type: ${input.figureType}
- Field: ${input.field}
- Purpose: ${input.purpose}
- Aspect ratio: ${input.aspectRatio}
- Palette: ${input.palette} — ${palettePromptText(input.palette)}
- Style: ${input.style}

Initial extracted structure:
${JSON.stringify(structure)}

Paper text:
${input.text.slice(0, 5000)}`;
}

function buildMindmapPrompt(text: string, structure: PaperStructure) {
  return `You are a paper-to-mindmap system inspired by ChatPaper2Xmind.

Read the paper text and return strict JSON only. No markdown fences.

JSON shape:
{
  "outline": {
    "id": "root",
    "title": "paper title",
    "summary": "one concise Chinese summary",
    "children": [
      {
        "id": "background",
        "title": "研究背景",
        "summary": "string",
        "children": [{"id":"background-1","title":"string","summary":"string","children":[]}]
      }
    ]
  }
}

Requirements:
- Chinese output.
- 5-7 top-level branches: 研究问题, 背景, 方法, 实验, 结果, 贡献, 局限/未来.
- Each branch has 2-5 concise child nodes.
- Do not invent numeric results.
- Keep titles short enough for mindmap display.

Initial structure:
${JSON.stringify(structure)}

Paper text:
${text.slice(0, 11000)}`;
}

function extractOpenAIText(data: unknown) {
  const response = data as { output_text?: string; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (response.output_text) return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .filter((content) => content.type === "output_text" || content.text)
      .map((content) => content.text ?? "")
      .join("\n") ?? ""
  );
}

function extractChatCompletionText(data: unknown) {
  const response = data as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }> };
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  return content?.map((part) => part.text ?? "").join("\n") ?? "";
}

type CompatibleTextConfig = {
  provider: "gateway" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: "chat" | "responses";
};

function compatibleTextConfig(provider: "gateway" | "custom"):
  | ({ ok: true } & CompatibleTextConfig)
  | { ok: false; message: string } {
  const prefix = provider === "custom" ? "CUSTOM_LLM" : "GATEWAY";
  const baseUrl = process.env[`${prefix}_BASE_URL`]?.trim();
  const apiKey = process.env[`${prefix}_API_KEY`]?.trim();
  const model = process.env[`${prefix}_TEXT_MODEL`]?.trim() || (provider === "custom" ? "gpt-4o-mini" : "gemini-2.5-flash");
  const wireApi = normalizeWireApi(process.env[`${prefix}_WIRE_API`] || process.env.CUSTOM_LLM_WIRE_API || (provider === "custom" ? "chat" : "chat"));
  if (!baseUrl || !apiKey) {
    return { ok: false, message: `${prefix}_BASE_URL or ${prefix}_API_KEY is missing. Used fallback planning.` };
  }
  return {
    ok: true,
    provider,
    baseUrl,
    apiKey,
    model,
    wireApi
  };
}

async function callCompatibleText(config: CompatibleTextConfig, prompt: string, temperature: number) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.LLM_TIMEOUT_MS || 90000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  if (config.wireApi === "responses") {
    try {
      const response = await fetch(responsesUrl(config.baseUrl), {
        method: "POST",
        headers: compatibleHeaders(config.apiKey),
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          input: prompt,
          text: { format: { type: "text" } },
          temperature
        })
      });
      if (!response.ok) throw new Error(`${config.provider} responses failed with HTTP ${response.status}. Used fallback planning.`);
      return extractOpenAIText(await response.json());
    } catch (error) {
      if (isAbortError(error)) throw new Error(`${config.provider} responses timed out after ${timeoutMs}ms. Used fallback planning.`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    const response = await fetch(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: compatibleHeaders(config.apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature
      })
    });
    if (!response.ok) throw new Error(`${config.provider} chat completions failed with HTTP ${response.status}. Used fallback planning.`);
    return extractChatCompletionText(await response.json());
  } catch (error) {
    if (isAbortError(error)) throw new Error(`${config.provider} chat completions timed out after ${timeoutMs}ms. Used fallback planning.`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function compatibleHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
}

function chatCompletionsUrl(baseUrl: string) {
  const clean = baseUrl.replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  if (clean.endsWith("/responses")) return clean.replace(/\/responses$/, "/chat/completions");
  if (clean.endsWith("/v1")) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}

function responsesUrl(baseUrl: string) {
  const clean = baseUrl.replace(/\/+$/, "");
  if (clean.endsWith("/responses")) return clean;
  if (clean.endsWith("/chat/completions")) return clean.replace(/\/chat\/completions$/, "/responses");
  if (clean.endsWith("/v1")) return `${clean}/responses`;
  return `${clean}/v1/responses`;
}

function normalizeWireApi(value: string): "chat" | "responses" {
  return value.trim().toLowerCase() === "responses" ? "responses" : "chat";
}

function isCustomProvider(provider: string) {
  return provider === "custom" || provider === "openai-compatible";
}

// Models frequently wrap JSON in prose ("Here is the JSON:") or ```fences```,
// despite instructions not to. Pull out the JSON payload before parsing so a
// well-formed object inside chatter still works instead of silently falling back.
function extractJsonBlock(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end > start) return candidate.slice(start, end + 1);
  return candidate;
}

function parsePlannerJson(text: string, provider: string): LlmPlanningResult {
  try {
    const parsed = JSON.parse(extractJsonBlock(text)) as { structure?: PaperStructure; plans?: PlannedFigure[] };
    if (!parsed.plans || parsed.plans.length < 1) {
      return { ok: false, provider, message: `${provider} returned no plan. Used fallback planning.` };
    }
    return {
      ok: true,
      provider,
      message: `Generated figure plan with ${provider}.`,
      structure: parsed.structure,
      plans: parsed.plans.slice(0, 3).map((plan) => ({
        ...plan,
        modules: plan.modules?.slice(0, 8) ?? [],
        relationships: plan.relationships ?? [],
        negativePrompt: plan.negativePrompt || "low resolution, blurry labels, illegible text, watermark"
      }))
    };
  } catch {
    return { ok: false, provider, message: `${provider} did not return valid JSON. Used fallback planning.` };
  }
}

function parseMindmapJson(text: string, provider: string): MindmapPlanningResult {
  try {
    const parsed = JSON.parse(extractJsonBlock(text)) as { outline?: MindmapNode };
    if (!parsed.outline?.children?.length) {
      return { ok: false, provider, message: `${provider} returned incomplete mindmap. Used fallback mindmap.` };
    }
    return {
      ok: true,
      provider,
      message: `Generated paper mindmap with ${provider}.`,
      outline: normalizeMindmapNode(parsed.outline, "root")
    };
  } catch {
    return { ok: false, provider, message: `${provider} did not return valid mindmap JSON. Used fallback mindmap.` };
  }
}

function normalizeMindmapNode(node: MindmapNode, fallbackId: string): MindmapNode {
  return {
    id: node.id || fallbackId,
    title: node.title || "节点",
    summary: node.summary || "",
    children: (node.children || []).slice(0, 8).map((child, index) => normalizeMindmapNode(child, `${fallbackId}-${index + 1}`))
  };
}

export function normalizeLlmPlan(plan: PlannedFigure, index: number) {
  return {
    id: hashId("plan"),
    name: plan.name || `Candidate Plan ${index + 1}`,
    score: Math.max(0, Math.min(100, Math.round(plan.score ?? 82))),
    rationale: plan.rationale || "Generated by cloud planner.",
    layout: plan.layout || "structured academic figure layout",
    caption: plan.caption || "AI-generated scientific figure caption.",
    modules: plan.modules?.length ? plan.modules.slice(0, 8) : ["Research Problem", "Method", "Evidence", "Output"],
    relationships: plan.relationships ?? [],
    template: plan.template || "method-framework",
    visualNotes: plan.visualNotes ?? [],
    prompt: plan.prompt || "Create a clean, vector-like academic research figure with readable labels.",
    negativePrompt: plan.negativePrompt || "low resolution, blurry labels, illegible text, watermark",
    diagram: sanitizeDiagram(plan.diagram)
  };
}

function sanitizeDiagram(diagram: ArchitectureDiagram | undefined): ArchitectureDiagram | undefined {
  const blocks = (diagram?.blocks ?? [])
    .filter((block) => block && typeof block.title === "string" && block.title.trim().length > 0)
    .slice(0, 8)
    .map((block) => ({
      title: block.title.trim().slice(0, 36),
      abbrev: block.abbrev?.trim().slice(0, 8) || undefined,
      substeps: (block.substeps ?? []).filter((step) => typeof step === "string" && step.trim()).slice(0, 5).map((step) => step.trim().slice(0, 34)),
      category: block.category?.trim().toLowerCase().slice(0, 16) || undefined
    }));
  if (blocks.length < 2) return undefined;
  const titles = new Set(blocks.map((block) => block.title));
  const connections = (diagram?.connections ?? [])
    .filter((connection) => connection && titles.has(connection.from?.trim()?.slice(0, 36) ?? "") && titles.has(connection.to?.trim()?.slice(0, 36) ?? ""))
    .slice(0, 16)
    .map((connection) => ({ from: connection.from.trim().slice(0, 36), to: connection.to.trim().slice(0, 36), label: connection.label?.trim().slice(0, 24) || undefined }));
  const legend = (diagram?.legend ?? [])
    .filter((item) => item && typeof item.label === "string" && typeof item.category === "string")
    .slice(0, 6)
    .map((item) => ({ label: item.label.trim().slice(0, 24), category: item.category.trim().toLowerCase().slice(0, 16) }));
  return { blocks, connections, legend };
}
