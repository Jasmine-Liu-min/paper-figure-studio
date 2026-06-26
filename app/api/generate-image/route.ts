import { NextResponse } from "next/server";
import { generateImage } from "@/lib/providers/imageProviders";
import { appendImageResult } from "@/lib/infra/storage";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    projectId?: string;
    prompt?: string;
    negativePrompt?: string;
    aspectRatio?: string;
    provider?: string;
    mode?: "standard" | "hybrid";
    overlaySvg?: string;
  };
  if (!body.projectId || !body.prompt || body.prompt.length < 20) {
    return NextResponse.json({ error: "projectId and prompt are required." }, { status: 422 });
  }
  const input = {
    projectId: body.projectId,
    prompt: body.prompt,
    negativePrompt: body.negativePrompt ?? "",
    aspectRatio: body.aspectRatio ?? "16:9",
    provider: body.provider,
    mode: body.mode,
    overlaySvg: body.overlaySvg
  };
  const image = await generateImage(input);
  await appendImageResult(input.projectId, image);
  return NextResponse.json(image);
}
