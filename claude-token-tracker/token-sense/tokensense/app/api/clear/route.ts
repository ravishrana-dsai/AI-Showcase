import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const project = searchParams.get("project");

    if (!project) {
      return NextResponse.json({ error: "project param required" }, { status: 400 });
    }

    const db = getDb();
    const result = db.prepare("DELETE FROM api_calls WHERE project_id = ?").run(project);

    return NextResponse.json({ deleted: result.changes, project });
  } catch (err) {
    console.error("[clear]", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
