import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "25");
  const acknowledged = searchParams.get("acknowledged");

  const where = {
    ...(acknowledged !== null && { acknowledged: acknowledged === "true" }),
  };

  const [alerts, total] = await Promise.all([
    prisma.slaAlert.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        request: {
          select: { id: true, externalId: true, court: { select: { name: true, city: true } } },
        },
        stage: { select: { displayName: true, color: true } },
      },
    }),
    prisma.slaAlert.count({ where }),
  ]);

  return NextResponse.json({ data: alerts, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || !["ADMIN", "OPS"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { ids } = await req.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids required" }, { status: 400 });
  }

  await prisma.slaAlert.updateMany({
    where: { id: { in: ids } },
    data: {
      acknowledged: true,
      acknowledgedBy: session.user.email,
      acknowledgedAt: new Date(),
    },
  });

  await invalidateCache(CACHE_KEYS.dashboardStats, CACHE_KEYS.slaBreaches);
  return NextResponse.json({ message: "Acknowledged" });
}
