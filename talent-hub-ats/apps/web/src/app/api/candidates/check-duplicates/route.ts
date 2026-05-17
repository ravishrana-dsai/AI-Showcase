import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { findDuplicates } from "@/lib/candidates/duplicate-detection";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const duplicates = await findDuplicates(session.user.organizationId, parsed.data);
    return NextResponse.json({ duplicates });
  } catch (error) {
    console.error("Check duplicates error:", error);
    return NextResponse.json({ error: "Failed to check duplicates" }, { status: 500 });
  }
}
