import { NextResponse } from "next/server";
import { deleteChartProject, listChartProjects } from "@/lib/infra/storage";

export async function GET() {
  const projects = await listChartProjects();
  return NextResponse.json({ projects });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (typeof body.id !== "string" || !body.id) {
    return NextResponse.json({ error: "Missing or invalid chart project id." }, { status: 422 });
  }
  const deleted = await deleteChartProject(body.id);
  return NextResponse.json({ ok: deleted });
}
