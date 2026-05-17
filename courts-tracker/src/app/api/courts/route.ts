import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { invalidateCache, CACHE_KEYS } from "@/lib/redis";
import { z } from "zod";

const createCourtSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().default("India"),
  address: z.string().optional(),
  partnerName: z.string().optional(),
  partnerContact: z.string().optional(),
  partnerEmail: z.string().email().optional().or(z.literal("")),
  surfaceType: z.string().optional(),
  totalCourts: z.number().int().min(1).default(1),
  externalId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status");
  const city = searchParams.get("city");

  const where = {
    ...(status && { status: status as never }),
    ...(city && { city: { contains: city, mode: "insensitive" as const } }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { city: { contains: search, mode: "insensitive" as const } },
        { partnerName: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [courts, total] = await Promise.all([
    prisma.court.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { requests: true } },
      },
    }),
    prisma.court.count({ where }),
  ]);

  return NextResponse.json({
    data: courts,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !["ADMIN", "OPS"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createCourtSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const court = await prisma.court.create({ data: parsed.data });
  await invalidateCache(CACHE_KEYS.courtList, CACHE_KEYS.dashboardStats);

  return NextResponse.json({ data: court }, { status: 201 });
}
