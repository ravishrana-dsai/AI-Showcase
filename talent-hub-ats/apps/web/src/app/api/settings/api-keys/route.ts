import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: (session.user as any).organizationId },
    select: { id: true, name: true, key: true, lastUsedAt: true, expiresAt: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    const rawKey = `th_${randomBytes(32).toString("hex")}`;
    const hashedKey = createHash("sha256").update(rawKey).digest("hex");

    const apiKey = await prisma.apiKey.create({
      data: { name, key: rawKey.slice(0, 12) + "...", hashedKey, organizationId: (session.user as any).organizationId },
    });

    return NextResponse.json({ apiKey: { ...apiKey, fullKey: rawKey } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}
