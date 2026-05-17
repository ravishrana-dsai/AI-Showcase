import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { mergeCandidates } from "@/lib/candidates/candidate-merge";
import { z } from "zod";

const schema = z.object({
  primaryId: z.string().min(1),
  duplicateId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowedRoles = ["RECRUITER", "ADMIN", "SUPER_ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "primaryId and duplicateId are required" },
        { status: 400 }
      );
    }

    await mergeCandidates(
      parsed.data.primaryId,
      parsed.data.duplicateId,
      session.user.organizationId,
      session.user.id
    );

    return NextResponse.json({ success: true, primaryId: parsed.data.primaryId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to merge candidates";
    console.error("Merge candidates error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
