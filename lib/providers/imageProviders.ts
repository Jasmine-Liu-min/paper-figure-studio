import { ImageGenerationResult } from "../types";

export type GenerateImageInput = {
  projectId: string;
  prompt: string;
  negativePrompt: string;
  aspectRatio: string;
  provider?: string;
  mode?: "standard" | "hybrid";
  overlaySvg?: string;
};

type ImageModelResult = {
  imageUrl: string;
  model: string;
  message: string;
};

const IMAGE_REQUEST_TIMEOUT_MS = 45000;

// Single source of truth for image providers. Add a new backend by appending ONE
// entry here (ready/model/generate together) — dispatch in generateImage() and the
// /api/config readiness + model labels all derive from this registry.
type ImageProviderEntry = {
  id: string;
  aliases?: string[];
  ready: () => boolean;
  model: () => string;
  generate: (input: GenerateImageInput) => Promise<ImageModelResult>;
};

const IMAGE_PROVIDERS: ImageProviderEntry[] = [
  {
    id: "gateway",
    ready: () => Boolean((process.env.GATEWAY_API_KEY || process.env.IMAGE_GATEWAY_API_KEY) && (process.env.IMAGE_GATEWAY_BASE_URL || process.env.GATEWAY_BASE_URL)),
    model: () => process.env.GATEWAY_IMAGE_MODEL || process.env.IMAGE_GATEWAY_MODEL || "gpt-image-1",
    generate: generateWithGateway
  },
  {
    id: "custom-image",
    aliases: ["custom", "openai-compatible"],
    ready: () => Boolean((process.env.CUSTOM_IMAGE_BASE_URL || process.env.CUSTOM_LLM_BASE_URL) && (process.env.CUSTOM_IMAGE_API_KEY || process.env.CUSTOM_LLM_API_KEY)),
    model: () => process.env.CUSTOM_IMAGE_MODEL || process.env.CUSTOM_LLM_TEXT_MODEL || "gpt-image-1",
    generate: generateWithCustomImage
  },
  { id: "openrouter", ready: () => Boolean(process.env.OPENROUTER_API_KEY), model: () => process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image-preview", generate: generateWithOpenRouter },
  { id: "replicate", ready: () => Boolean(process.env.REPLICATE_API_TOKEN), model: () => process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell", generate: generateWithReplicate },
  { id: "stability", ready: () => Boolean(process.env.STABILITY_API_KEY), model: () => process.env.STABILITY_IMAGE_MODEL || "stable-image-core", generate: generateWithStability },
  { id: "pollinations", ready: () => true, model: () => process.env.POLLINATIONS_IMAGE_MODEL || "flux", generate: generateWithPollinations },
  { id: "openai", ready: () => Boolean(process.env.OPENAI_API_KEY), model: () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", generate: generateWithOpenAI },
  { id: "gemini", ready: () => Boolean(process.env.GEMINI_API_KEY), model: () => process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image", generate: generateWithGemini },
  {
    id: "qwen",
    aliases: ["qwen-image", "dashscope", "tongyi", "wanx"],
    ready: () => Boolean(process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY),
    model: () => process.env.QWEN_IMAGE_MODEL || "qwen-image",
    generate: generateWithQwen
  }
];

function findImageProvider(id: string) {
  const key = normalizeProvider(id);
  return IMAGE_PROVIDERS.find((entry) => entry.id === key || entry.aliases?.includes(key));
}

export function imageProviderReady(id: string) {
  if (normalizeProvider(id) === "mock") return true;
  return findImageProvider(id)?.ready() ?? false;
}

export function imageProviderModel(id: string) {
  if (normalizeProvider(id) === "mock") return "mock";
  return findImageProvider(id)?.model() ?? "mock";
}

export function listImageProviders() {
  return ["mock", ...IMAGE_PROVIDERS.map((entry) => entry.id)];
}

export async function generateImage(input: GenerateImageInput): Promise<ImageGenerationResult> {
  const provider = normalizeProvider(input.provider || process.env.IMAGE_PROVIDER || "mock");
  if (provider === "mock") return generateMock(input);

  const entry = findImageProvider(provider);
  if (!entry) {
    return blocked(provider, `Unsupported IMAGE_PROVIDER "${provider}". Use ${listImageProviders().join(", ")}.`, input.prompt);
  }

  try {
    return ready(entry.id, await entry.generate(input), input);
  } catch (error) {
    return {
      provider: entry.id,
      status: "failed",
      message: error instanceof Error ? error.message : "Image generation failed.",
      prompt: input.prompt,
      mode: input.mode ?? "standard",
      createdAt: new Date().toISOString()
    };
  }
}

async function generateWithGateway(input: GenerateImageInput): Promise<ImageModelResult> {
  const apiKey = process.env.GATEWAY_API_KEY || process.env.IMAGE_GATEWAY_API_KEY;
  const baseUrl = process.env.IMAGE_GATEWAY_BASE_URL || process.env.GATEWAY_BASE_URL;
  if (!apiKey || !baseUrl) throw new Error("GATEWAY_BASE_URL and GATEWAY_API_KEY are required for IMAGE_PROVIDER=gateway.");

  const model = process.env.GATEWAY_IMAGE_MODEL || process.env.IMAGE_GATEWAY_MODEL || "gpt-image-1";
  const prompt = buildImagePrompt(input);
  const failures: string[] = [];
  const mode = (process.env.GATEWAY_IMAGE_MODE || "auto").toLowerCase();

  if (mode === "images" || mode === "auto") {
    try {
      return await callOpenAICompatibleImage({
        providerName: "Gateway",
        endpoint: imageEndpoint(baseUrl),
        apiKey,
        model,
        prompt,
        size: sizeForAspectRatio(input.aspectRatio)
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Gateway images endpoint failed.");
      if (mode === "images") throw error;
    }
  }

  if (mode === "responses" || mode === "auto") {
    try {
      return await callOpenAICompatibleResponsesImage({
        providerName: "Gateway",
        endpoint: responsesEndpoint(baseUrl),
        apiKey,
        model,
        prompt
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Gateway responses endpoint failed.");
      if (mode === "responses") throw error;
    }
  }

  if (mode === "chat" || mode === "auto") {
    try {
      return await callOpenAICompatibleChatImage({
        providerName: "Gateway",
        endpoint: chatEndpoint(baseUrl),
        apiKey,
        model,
        prompt
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Gateway chat endpoint failed.");
      if (mode === "chat") throw error;
    }
  }

  throw new Error(`Gateway image generation failed. Tried modes: ${mode}. ${failures.join(" | ")}`);
}

async function generateWithCustomImage(input: GenerateImageInput): Promise<ImageModelResult> {
  const apiKey = process.env.CUSTOM_IMAGE_API_KEY || process.env.CUSTOM_LLM_API_KEY;
  const baseUrl = process.env.CUSTOM_IMAGE_BASE_URL || process.env.CUSTOM_LLM_BASE_URL;
  if (!apiKey || !baseUrl) throw new Error("CUSTOM_IMAGE_BASE_URL/CUSTOM_IMAGE_API_KEY or CUSTOM_LLM_BASE_URL/CUSTOM_LLM_API_KEY are required for IMAGE_PROVIDER=custom-image.");

  const model = process.env.CUSTOM_IMAGE_MODEL || "gpt-image-1";
  const prompt = buildImagePrompt(input);
  const failures: string[] = [];
  const mode = (process.env.CUSTOM_IMAGE_MODE || "auto").toLowerCase();

  if (mode === "images" || mode === "auto") {
    try {
      return await callOpenAICompatibleImage({
        providerName: "Custom image provider",
        endpoint: imageEndpoint(baseUrl),
        apiKey,
        model,
        prompt,
        // Some OpenAI-compatible image APIs (e.g. 智谱 CogView) only accept a
        // fixed set of sizes. CUSTOM_IMAGE_SIZE pins one regardless of aspect ratio.
        size: process.env.CUSTOM_IMAGE_SIZE || sizeForAspectRatio(input.aspectRatio)
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Custom images endpoint failed.");
      if (mode === "images") throw error;
    }
  }

  if (mode === "responses" || mode === "auto") {
    try {
      return await callOpenAICompatibleResponsesImage({
        providerName: "Custom image provider",
        endpoint: responsesEndpoint(baseUrl),
        apiKey,
        model,
        prompt
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Custom responses endpoint failed.");
      if (mode === "responses") throw error;
    }
  }

  if (mode === "chat" || mode === "auto") {
    try {
      return await callOpenAICompatibleChatImage({
        providerName: "Custom image provider",
        endpoint: chatEndpoint(baseUrl),
        apiKey,
        model,
        prompt
      });
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Custom chat endpoint failed.");
      if (mode === "chat") throw error;
    }
  }

  throw new Error(`Custom image provider failed. Tried modes: ${mode}. ${failures.join(" | ")}`);
}

async function generateWithOpenRouter(input: GenerateImageInput): Promise<ImageModelResult> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY is required for IMAGE_PROVIDER=openrouter.");
  const model = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image-preview";
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL || "http://127.0.0.1:3000",
      "X-Title": "Paper Figure Studio"
    },
    body: JSON.stringify({
      model,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: buildImagePrompt(input) }],
      temperature: 0.2
    })
  });

  if (!response.ok) throw new Error(`OpenRouter image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const data = await response.json();
  const imageUrl = extractOpenRouterImage(data);
  if (!imageUrl) throw new Error("OpenRouter returned no image. Try a model that explicitly supports image output.");
  return { imageUrl, model, message: "Generated final image with OpenRouter image model." };
}

async function generateWithReplicate(input: GenerateImageInput): Promise<ImageModelResult> {
  if (!process.env.REPLICATE_API_TOKEN) throw new Error("REPLICATE_API_TOKEN is required for IMAGE_PROVIDER=replicate.");
  const model = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-schnell";
  const response = await fetchWithTimeout("https://api.replicate.com/v1/models/" + model + "/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: "wait=60"
    },
    body: JSON.stringify({
      input: {
        prompt: buildImagePrompt(input),
        negative_prompt: input.negativePrompt,
        aspect_ratio: normalizeReplicateAspectRatio(input.aspectRatio),
        output_format: "png"
      }
    })
  }, 75000);

  if (!response.ok) throw new Error(`Replicate image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const data = await waitForReplicatePrediction(await response.json());
  const imageUrl = extractReplicateImage(data);
  if (!imageUrl) throw new Error(`Replicate returned no image URL. Status: ${replicateStatus(data)}. Check model name and account access.`);
  return { imageUrl, model, message: "Generated final image with Replicate." };
}

async function generateWithStability(input: GenerateImageInput): Promise<ImageModelResult> {
  if (!process.env.STABILITY_API_KEY) throw new Error("STABILITY_API_KEY is required for IMAGE_PROVIDER=stability.");
  const model = process.env.STABILITY_IMAGE_MODEL || "stable-image-core";
  const endpoint = process.env.STABILITY_IMAGE_ENDPOINT || "https://api.stability.ai/v2beta/stable-image/generate/core";
  const form = new FormData();
  form.set("prompt", buildImagePrompt(input));
  form.set("negative_prompt", input.negativePrompt);
  form.set("aspect_ratio", normalizeStabilityAspectRatio(input.aspectRatio));
  form.set("output_format", "png");

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
      Accept: "image/*"
    },
    body: form
  }, 90000);

  if (!response.ok) throw new Error(`Stability image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return {
    imageUrl: `data:image/png;base64,${base64}`,
    model,
    message: "Generated final image with Stability AI."
  };
}

async function generateWithPollinations(input: GenerateImageInput): Promise<ImageModelResult> {
  const model = process.env.POLLINATIONS_IMAGE_MODEL || "flux";
  const { width, height } = dimensionsForAspectRatio(input.aspectRatio);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: "true",
    enhance: "true",
    safe: "true",
    seed: String(Math.floor(Math.random() * 1_000_000_000))
  });
  // Pollinations encodes the prompt into the URL path, so an over-long prompt
  // triggers HTTP 414 (URI Too Long). Cap it to a safe length.
  const pollinationsPrompt = buildImagePrompt(input).slice(0, 1500);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(pollinationsPrompt)}?${params.toString()}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: { Accept: "image/*" }
  }, 90000);

  if (!response.ok) throw new Error(`Pollinations image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return {
    imageUrl: `data:${contentType};base64,${base64}`,
    model,
    message: "Generated final image with Pollinations free image API."
  };
}

// 阿里云百炼 通义 image models (native DashScope protocol, NOT OpenAI-compatible).
// Two API styles, auto-selected by model code:
//   - SYNC  (qwen-image-2.0 / 2.0-pro / max): multimodal-generation/generation
//   - ASYNC (qwen-image / qwen-image-plus / wanx*): text2image/image-synthesis + polling
// Best domestic option for figures with Chinese/English labels. Returns a 24h URL.
async function generateWithQwen(input: GenerateImageInput): Promise<ImageModelResult> {
  const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY;
  if (!apiKey) throw new Error("DASHSCOPE_API_KEY (阿里云百炼) is required for IMAGE_PROVIDER=qwen.");
  const model = process.env.QWEN_IMAGE_MODEL || "qwen-image-2.0";
  const baseUrl = (process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com").replace(/\/$/, "");
  const isAsync = /^wanx/i.test(model) || model === "qwen-image" || model === "qwen-image-plus";
  return isAsync ? generateWithQwenAsync(apiKey, baseUrl, model, input) : generateWithQwenSync(apiKey, baseUrl, model, input);
}

async function generateWithQwenSync(apiKey: string, baseUrl: string, model: string, input: GenerateImageInput): Promise<ImageModelResult> {
  const response = await fetchWithTimeout(
    `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input: { messages: [{ role: "user", content: [{ text: buildImagePrompt(input) }] }] },
        parameters: { size: qwenSizeForAspectRatio(input.aspectRatio), negative_prompt: input.negativePrompt || " ", n: 1, prompt_extend: true, watermark: false }
      })
    },
    90000
  );
  if (!response.ok) throw new Error(`Qwen-Image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const imageUrl = extractQwenImage(await response.json());
  if (!imageUrl) throw new Error("Qwen-Image returned no image URL. Check model access, API key, and DashScope region (Beijing vs Singapore use different keys/URLs).");
  return { imageUrl, model, message: "Generated final image with Qwen-Image (阿里云百炼)。注意：返回的是 24 小时有效的临时链接，请尽快下载保存。" };
}

async function generateWithQwenAsync(apiKey: string, baseUrl: string, model: string, input: GenerateImageInput): Promise<ImageModelResult> {
  const createResponse = await fetchWithTimeout(
    `${baseUrl}/api/v1/services/aigc/text2image/image-synthesis`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "X-DashScope-Async": "enable" },
      body: JSON.stringify({
        model,
        input: { prompt: buildImagePrompt(input), negative_prompt: input.negativePrompt || "" },
        parameters: { size: qwenSizeForAspectRatio(input.aspectRatio), n: 1, prompt_extend: true, watermark: false }
      })
    },
    30000
  );
  if (!createResponse.ok) throw new Error(`Qwen-Image(async) create failed with HTTP ${createResponse.status}: ${await compactError(createResponse)}`);
  const created = (await createResponse.json()) as { output?: { task_id?: string } };
  const taskId = created.output?.task_id;
  if (!taskId) throw new Error("Qwen-Image(async) returned no task_id.");

  const startedAt = Date.now();
  while (Date.now() - startedAt < 120000) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const pollResponse = await fetchWithTimeout(`${baseUrl}/api/v1/tasks/${taskId}`, { headers: { Authorization: `Bearer ${apiKey}` } }, 30000);
    if (!pollResponse.ok) continue;
    const data = (await pollResponse.json()) as { output?: { task_status?: string; message?: string; results?: Array<{ url?: string }> } };
    const status = data.output?.task_status;
    if (status === "SUCCEEDED") {
      const url = data.output?.results?.find((item) => item.url)?.url;
      if (!url) throw new Error("Qwen-Image(async) succeeded but returned no image URL.");
      return { imageUrl: url, model, message: "Generated final image with Qwen-Image/Wanx (async)。注意：返回的是临时链接，请尽快下载保存。" };
    }
    if (status === "FAILED") throw new Error(`Qwen-Image(async) task failed: ${data.output?.message || "unknown error"}`);
  }
  throw new Error("Qwen-Image(async) timed out after 120s.");
}

function qwenSizeForAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") return "1328*1328";
  if (aspectRatio === "4:3") return "1472*1104";
  if (aspectRatio === "3:2") return "1584*1056";
  return "1664*928";
}

function extractQwenImage(data: unknown) {
  const response = data as { output?: { choices?: Array<{ message?: { content?: Array<{ image?: string }> } }> } };
  for (const choice of response.output?.choices ?? []) {
    for (const item of choice.message?.content ?? []) {
      if (item.image) return item.image;
    }
  }
  return null;
}

async function generateWithOpenAI(input: GenerateImageInput): Promise<ImageModelResult> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for IMAGE_PROVIDER=openai.");
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  return callOpenAICompatibleImage({
    providerName: "OpenAI",
    endpoint: "https://api.openai.com/v1/images/generations",
    apiKey: process.env.OPENAI_API_KEY,
    model,
    prompt: buildImagePrompt(input),
    size: sizeForAspectRatio(input.aspectRatio)
  });
}

async function generateWithGemini(input: GenerateImageInput): Promise<ImageModelResult> {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for IMAGE_PROVIDER=gemini.");
  const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
  const response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildImagePrompt(input) }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
    })
  });

  if (!response.ok) throw new Error(`Gemini image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const image = extractGeminiImage(await response.json());
  if (!image) throw new Error("Gemini returned no inline image. Check whether your account can access the selected image model.");
  return {
    model,
    message: "Generated final image with Gemini image model.",
    imageUrl: `data:${image.mimeType};base64,${image.data}`
  };
}

async function callOpenAICompatibleImage(input: {
  providerName: string;
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
}): Promise<ImageModelResult> {
  const response = await fetchWithTimeout(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      prompt: input.prompt,
      size: input.size
    })
  });

  if (!response.ok) throw new Error(`${input.providerName} image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const data = await response.json();
  const imageUrl = extractOpenAICompatibleImage(data);
  if (!imageUrl) throw new Error(`${input.providerName} returned no image. Check model access and endpoint format.`);
  return { imageUrl, model: input.model, message: `Generated final image with ${input.providerName}.` };
}

async function callOpenAICompatibleResponsesImage(input: {
  providerName: string;
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<ImageModelResult> {
  const response = await fetchWithTimeout(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      input: input.prompt,
      tools: [{ type: "image_generation" }]
    })
  });

  if (!response.ok) throw new Error(`${input.providerName} responses image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const imageUrl = extractOpenAICompatibleImage(await response.json());
  if (!imageUrl) throw new Error(`${input.providerName} responses endpoint returned no image.`);
  return { imageUrl, model: input.model, message: `Generated final image with ${input.providerName} Responses API.` };
}

async function callOpenAICompatibleChatImage(input: {
  providerName: string;
  endpoint: string;
  apiKey: string;
  model: string;
  prompt: string;
}): Promise<ImageModelResult> {
  const response = await fetchWithTimeout(input.endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: input.model,
      messages: [{ role: "user", content: input.prompt }],
      modalities: ["text", "image"],
      temperature: 0.2
    })
  });

  if (!response.ok) throw new Error(`${input.providerName} chat image generation failed with HTTP ${response.status}: ${await compactError(response)}`);
  const data = await response.json();
  const imageUrl = extractChatImage(data) || extractOpenRouterImage(data);
  if (!imageUrl) throw new Error(`${input.providerName} chat endpoint returned no image. It may be a text-only chat model.`);
  return { imageUrl, model: input.model, message: `Generated final image with ${input.providerName} chat image model.` };
}

function generateMock(input: GenerateImageInput): ImageGenerationResult {
  if (input.mode === "hybrid" && input.overlaySvg) {
    return {
      provider: "mock",
      status: "ready",
      message: "Generated a local Hybrid preview. Labels/arrows stay in editable SVG; no external image API was called.",
      imageUrl: input.overlaySvg,
      prompt: input.prompt,
      mode: "hybrid",
      model: "mock",
      createdAt: new Date().toISOString()
    };
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768">
    <rect width="1024" height="768" fill="#f7f5ef"/>
    <rect x="72" y="72" width="880" height="624" rx="12" fill="#ffffff" stroke="#d9d4c8"/>
    <text x="112" y="142" font-family="Arial" font-size="30" font-weight="700" fill="#17202a">Mock final image preview</text>
    <text x="112" y="188" font-family="Arial" font-size="17" fill="#586474">No external image API was called. Set IMAGE_PROVIDER to gateway, replicate, openai, openrouter, or gemini for real generation.</text>
    <rect x="112" y="238" width="800" height="350" rx="10" fill="#f4f7fb" stroke="#d7e0eb"/>
    <foreignObject x="140" y="270" width="744" height="285">
      <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial; font-size: 20px; color: #17202a; line-height: 1.45;">${escapeHtml(input.prompt.slice(0, 520))}</div>
    </foreignObject>
    <text x="112" y="642" font-family="Arial" font-size="16" fill="#7a4b3f">This is a placeholder, not the final cloud-rendered figure.</text>
  </svg>`;
  return {
    provider: "mock",
    status: "ready",
    message: "Generated a local mock preview. Configure IMAGE_PROVIDER for real cloud image generation.",
    imageUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    prompt: input.prompt,
    mode: input.mode ?? "standard",
    model: "mock",
    createdAt: new Date().toISOString()
  };
}

function ready(provider: string, result: ImageModelResult, input: GenerateImageInput): ImageGenerationResult {
  const hybrid = input.mode === "hybrid" && input.overlaySvg;
  const imageUrl = hybrid ? input.overlaySvg : result.imageUrl;
  return {
    provider,
    status: "ready",
    message: hybrid
      ? `${result.message} Hybrid mode kept labels/arrows in editable SVG; the cloud image is stored as a style/reference layer.`
      : result.message,
    imageUrl,
    baseImageUrl: hybrid ? result.imageUrl : undefined,
    mode: input.mode ?? "standard",
    prompt: input.prompt,
    model: result.model,
    createdAt: new Date().toISOString()
  };
}

function blocked(provider: string, message: string, prompt: string): ImageGenerationResult {
  return {
    provider,
    status: "blocked",
    message,
    prompt,
    createdAt: new Date().toISOString()
  };
}

function buildImagePrompt(input: GenerateImageInput) {
  if (input.mode === "hybrid") {
    return [
      "Create a clean text-free scientific visual background for a research figure.",
      "Important: do not render any readable text, labels, numbers, arrows, captions, UI, legends, watermarks, or fake symbols. The final labels and arrows will be overlaid by an editable SVG layer.",
      "Use a white or near-white canvas with very light scientific pastel regions, subtle abstract thumbnails, soft stage containers, and restrained vector-like medical/scientific shapes.",
      "Keep the composition spacious and low contrast so overlaid labels remain readable.",
      `Aspect ratio: ${input.aspectRatio}.`,
      "Use the following design brief only to infer domain, palette, and broad composition. Do not copy its labels as text:",
      input.prompt.slice(0, 2400),
      input.negativePrompt ? `Negative constraints: readable text, random letters, fake numeric values, watermark, dark background, clutter, ${input.negativePrompt}` : "Negative constraints: readable text, random letters, fake numeric values, watermark, dark background, clutter"
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    input.prompt,
    "",
    "Render this as a polished scientific figure for a journal manuscript or academic presentation.",
    "Use clean vector-like shapes, readable labels, careful spacing, restrained colors, and no unsupported claims.",
    `Aspect ratio: ${input.aspectRatio}.`,
    input.negativePrompt ? `Negative constraints: ${input.negativePrompt}` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeProvider(provider: string) {
  return provider.trim().toLowerCase();
}


function imageEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/images/generations")) return trimmed;
  if (trimmed.endsWith("/chat/completions")) return trimmed.replace(/\/chat\/completions$/, "/images/generations");
  if (trimmed.endsWith("/responses")) return trimmed.replace(/\/responses$/, "/images/generations");
  if (trimmed.endsWith("/v1")) return `${trimmed}/images/generations`;
  return `${trimmed}/v1/images/generations`;
}

function responsesEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/responses")) return trimmed;
  if (trimmed.endsWith("/chat/completions")) return trimmed.replace(/\/chat\/completions$/, "/responses");
  if (trimmed.endsWith("/images/generations")) return trimmed.replace(/\/images\/generations$/, "/responses");
  if (trimmed.endsWith("/v1")) return `${trimmed}/responses`;
  return `${trimmed}/v1/responses`;
}

function chatEndpoint(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/responses")) return trimmed.replace(/\/responses$/, "/chat/completions");
  if (trimmed.endsWith("/images/generations")) return trimmed.replace(/\/images\/generations$/, "/chat/completions");
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function sizeForAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") return "1024x1024";
  if (aspectRatio === "3:2") return "1536x1024";
  if (aspectRatio === "4:3") return "1536x1024";
  return "1536x864";
}

function dimensionsForAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") return { width: 1024, height: 1024 };
  if (aspectRatio === "4:3") return { width: 1024, height: 768 };
  if (aspectRatio === "3:2") return { width: 1152, height: 768 };
  return { width: 1280, height: 720 };
}

function normalizeReplicateAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") return "1:1";
  if (aspectRatio === "4:3") return "4:3";
  if (aspectRatio === "3:2") return "3:2";
  return "16:9";
}

function normalizeStabilityAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") return "1:1";
  if (aspectRatio === "4:3") return "4:3";
  if (aspectRatio === "3:2") return "3:2";
  return "16:9";
}

function extractOpenAICompatibleImage(data: unknown) {
  const response = data as {
    data?: Array<{ b64_json?: string; url?: string }>;
    output?: Array<{ type?: string; result?: string; content?: Array<{ type?: string; image_url?: string; image?: string; b64_json?: string }> }>;
  };
  const first = response.data?.[0];
  if (first?.b64_json) return `data:image/png;base64,${first.b64_json}`;
  if (first?.url) return first.url;
  const outputImage = response.output?.find((output) => output.type === "image_generation_call" && output.result)?.result;
  if (outputImage) return outputImage.startsWith("http") || outputImage.startsWith("data:") ? outputImage : `data:image/png;base64,${outputImage}`;
  for (const output of response.output ?? []) {
    for (const item of output.content ?? []) {
      const raw = item.image_url || item.image || item.b64_json;
      if (raw) return raw.startsWith("http") || raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    }
  }
  return null;
}

function extractChatImage(data: unknown) {
  const response = data as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; image_url?: { url?: string } | string; image?: string; b64_json?: string }>;
      };
    }>;
  };
  const content = response.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    for (const item of content) {
      const imageUrl = typeof item.image_url === "string" ? item.image_url : item.image_url?.url;
      const raw = imageUrl || item.image || item.b64_json;
      if (raw) return raw.startsWith("http") || raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    }
  }
  return typeof content === "string" ? findImageUrl(content) : null;
}

function extractOpenRouterImage(data: unknown) {
  const response = data as {
    choices?: Array<{
      message?: {
        images?: Array<{ image_url?: { url?: string }; url?: string }>;
        content?: string | Array<{ type?: string; image_url?: { url?: string }; text?: string }>;
      };
    }>;
  };
  const message = response.choices?.[0]?.message;
  const direct = message?.images?.[0]?.image_url?.url || message?.images?.[0]?.url;
  if (direct) return direct;
  if (Array.isArray(message?.content)) {
    return message.content.find((part) => part.image_url?.url)?.image_url?.url ?? null;
  }
  return typeof message?.content === "string" ? findImageUrl(message.content) : null;
}

function extractReplicateImage(data: unknown) {
  const response = data as { output?: string | string[] | Array<{ url?: string }>; urls?: { get?: string } };
  if (typeof response.output === "string") return response.output;
  if (Array.isArray(response.output)) {
    const first = response.output[0];
    return typeof first === "string" ? first : first?.url ?? null;
  }
  return response.urls?.get ?? null;
}

async function waitForReplicatePrediction(initial: unknown) {
  let prediction = initial as {
    status?: string;
    error?: string;
    urls?: { get?: string };
  };
  const terminal = new Set(["succeeded", "failed", "canceled"]);
  const startedAt = Date.now();
  while (prediction.urls?.get && prediction.status && !terminal.has(prediction.status) && Date.now() - startedAt < 120000) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetchWithTimeout(prediction.urls.get, {
      headers: { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` }
    }, 30000);
    if (!response.ok) throw new Error(`Replicate polling failed with HTTP ${response.status}: ${await compactError(response)}`);
    prediction = await response.json();
  }
  if (prediction.status === "failed") throw new Error(`Replicate prediction failed: ${prediction.error || "unknown error"}`);
  if (prediction.status === "canceled") throw new Error("Replicate prediction was canceled.");
  return prediction;
}

function replicateStatus(data: unknown) {
  const prediction = data as { status?: string; error?: string };
  return prediction.error ? `${prediction.status || "unknown"} (${prediction.error})` : prediction.status || "unknown";
}

function extractGeminiImage(data: unknown) {
  const response = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }> };
    }>;
  };
  const inlinePart = response.candidates?.flatMap((candidate) => candidate.content?.parts ?? []).find((part) => part.inlineData?.data || part.inline_data?.data);
  if (inlinePart?.inlineData?.data) return { mimeType: inlinePart.inlineData.mimeType ?? "image/png", data: inlinePart.inlineData.data };
  if (inlinePart?.inline_data?.data) return { mimeType: inlinePart.inline_data.mime_type ?? "image/png", data: inlinePart.inline_data.data };
  return null;
}

async function compactError(response: Response) {
  const text = await response.text();
  return text.slice(0, 500);
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = IMAGE_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Image provider request timed out after ${Math.round(timeoutMs / 1000)}s: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function findImageUrl(text: string) {
  return text.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp)(?:\?\S*)?/i)?.[0] ?? null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}
