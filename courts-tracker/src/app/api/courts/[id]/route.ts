import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";
import { z } from "zod";

const updateCourtSchema = z.object({
  name: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().optional(),
  address: z.string().optional(),
  partnerName: z.string().optional(),
  partnerContact: z.string().optional(),
  partnerEmail: z.string().email().optional().or(z.literal("")),
  surfaceType: z.string().optional(),
  totalCourts: z.number().int().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ONBOARDING", "SUSPENDED"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const court = await prisma.court.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { requests: true } },
      requests: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          stageLogs: {
            include: { stage: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  if (!court) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Compute stats
  const stats = await prisma.request.groupBy({
    by: ["status"],
    where: { courtId: params.id },
    _count: { status: true },
  });

  const slaBreached = await prisma.request.count({
    where: { courtId: params.id, slaBreached: true },
  });

  return NextResponse.json({ data: { ...court, stats, slaBreached } });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || !["ADMIN", "OPS"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = updateCourtSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const court = await prisma.court.update({
    where: { id: params.id },
    data: parsed.data,
  });

  await invalidateCache(CACHE_KEYS.courtList, CACHE_KEYS.courtStats(params.id), CACHE_KEYS.dashboardStats);
  return NextResponse.json({ data: court });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.court.delete({ where: { id: params.id } });
  await invalidateCache(CACHE_KEYS.courtList, CACHE_KEYS.dashboardStats);
  return NextResponse.json({ message: "Deleted" });
}
