import { NextResponse } from "next/server";
import { generateImage } from "@/lib/providers/imageProviders";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return testProvider({
    provider: url.searchParams.get("provider") ?? undefined,
    prompt: url.searchParams.get("prompt") ?? undefined,
    aspectRatio: url.searchParams.get("aspectRatio") ?? undefined
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    provider?: string;
    prompt?: string;
    aspectRatio?: string;
  };
  return testProvider(body);
}

async function testProvider(body: { provider?: string; prompt?: string; aspectRatio?: string }) {
  const result = await generateImage({
    projectId: "provider-test",
    provider: body.provider,
    prompt:
      body.prompt ||
      "A minimal clean scientific figure: three labeled vector boxes connected by arrows, white background, readable labels, journal style.",
    negativePrompt: "photorealistic, decorative, cluttered, unreadable text, unsupported claims",
    aspectRatio: body.aspectRatio || "1:1"
  });

  return NextResponse.json({
    provider: result.provider,
    status: result.status,
    model: result.model,
    message: result.message,
    hasImage: Boolean(result.imageUrl),
    imageUrl: result.imageUrl?.startsWith("data:") ? result.imageUrl.slice(0, 60) + "..." : result.imageUrl
  });
}
