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
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const skip = (page - 1) * limit;

    const where: any = { organizationId: apiKey.organizationId };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        select: { id: true, title: true, slug: true, status: true, employmentType: true, experienceLevel: true, salaryMin: true, salaryMax: true, salaryCurrency: true, createdAt: true, publishedAt: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return NextResponse.json({ data: jobs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
