import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@talent-hub/db";
import { createHash } from "crypto";

async function authenticateApiKey(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const key = authHeader.slice(7);
  const hashedKey = createHash("sha256").update(key).digest("hex");
  const apiKey = await prisma.apiKey.findFirst({ where: { hashedKey, isActive: true } });
  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });
  return apiKey;
}

export async function GET(req: NextRequest) {
  const apiKey = await authenticateApiKey(req);
  if (!apiKey) return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where: { organizationId: apiKey.organizationId, isArchived: false },
        select: { id: true, firstName: true, lastName: true, email: true, phone: true, currentCompany: true, currentTitle: true, location: true, source: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.candidate.count({ where: { organizationId: apiKey.organizationId, isArchived: false } }),
    ]);

    return NextResponse.json({ data: candidates, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
