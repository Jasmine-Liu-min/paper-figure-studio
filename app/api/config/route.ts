import { NextResponse } from "next/server";
import { imageProviderModel, imageProviderReady } from "@/lib/providers/imageProviders";

export async function GET() {
  const llmProvider = process.env.LLM_PROVIDER || "mock";
  const imageProvider = process.env.IMAGE_PROVIDER || "mock";
  return NextResponse.json({
    llm: {
      provider: llmProvider,
      ready: providerReady(llmProvider),
      model: modelFor(llmProvider, "text")
    },
    image: {
      provider: imageProvider,
      ready: imageProviderReady(imageProvider),
      model: imageProviderModel(imageProvider)
    },
    recommendations: [
      {
        provider: "gemini",
        label: "Gemini API",
        cost: "官方免费层，适合先跑通文本规划；注意免费层数据可能用于产品改进。"
      },
      {
        provider: "openrouter",
        label: "OpenRouter",
        cost: "统一入口，可选择 free/低价文本模型；部分图片模型也可通过同一个 key 调用。"
      },
      {
        provider: "cloudflare",
        label: "Cloudflare Workers AI",
        cost: "每天有免费 Neurons 配额，超出后按量计费，适合便宜文本规划。"
      },
      {
        provider: "gateway",
        label: "自建/学校网关",
        cost: "OpenAI-compatible 统一入口，最适合你现在这种已有网关的情况。"
      },
      {
        provider: "custom",
        label: "自定义兼容 API",
        cost: "给其他用户复用：填写 base URL、API key、model，即可接 OpenAI-compatible 文本或图片接口。"
      },
      {
        provider: "replicate",
        label: "Replicate",
        cost: "适合低成本先跑通 FLUX 等图片模型，按量计费，配置简单。"
      },
      {
        provider: "pollinations",
        label: "Pollinations",
        cost: "免 key 免费图片 API，适合先跑通端到端链路；质量和稳定性不作为最终方案。"
      },
      {
        provider: "stability",
        label: "Stability AI",
        cost: "直连图片 API，适合快速生成插画/科研示意图，按量计费。"
      },
      {
        provider: "openai",
        label: "OpenAI",
        cost: "图像质量强，但图片生成通常不是最低成本方案。"
      }
    ]
  });
}

function providerReady(provider: string) {
  if (provider === "mock") return true;
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (provider === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
  if (provider === "cloudflare") return Boolean(process.env.CLOUDFLARE_API_KEY && process.env.CLOUDFLARE_ACCOUNT_ID);
  if (provider === "gateway") return Boolean(process.env.GATEWAY_BASE_URL && process.env.GATEWAY_API_KEY);
  if (provider === "custom" || provider === "openai-compatible") return Boolean(process.env.CUSTOM_LLM_BASE_URL && process.env.CUSTOM_LLM_API_KEY);
  return false;
}

function modelFor(provider: string, kind: "text" | "image") {
  if (kind === "text") {
    if (provider === "openai") return process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
    if (provider === "gemini") return process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash";
    if (provider === "openrouter") return process.env.OPENROUTER_TEXT_MODEL || "google/gemini-2.0-flash-exp:free";
    if (provider === "cloudflare") return process.env.CLOUDFLARE_TEXT_MODEL || "@cf/meta/llama-3.1-8b-instruct-fp8-fast";
    if (provider === "gateway") return process.env.GATEWAY_TEXT_MODEL || "gemini-2.5-flash";
    if (provider === "custom" || provider === "openai-compatible") return process.env.CUSTOM_LLM_TEXT_MODEL || "gpt-4o-mini";
  }
  // Image-provider models are derived from the imageProviders registry (see GET above).
  return "mock";
}
