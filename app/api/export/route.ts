import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as { svg?: string; fileName?: string };
  if (!body.svg || body.svg.length < 20) {
    return NextResponse.json({ error: "svg is required." }, { status: 422 });
  }
  const fileName = body.fileName ?? "figure-draft.svg";
  return new NextResponse(body.svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9_.-]/g, "-")}"`
    }
  });
}
