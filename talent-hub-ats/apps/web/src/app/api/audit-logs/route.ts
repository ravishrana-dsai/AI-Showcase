import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  actorId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  dateFrom: z.string().datetime({ offset: true }).optional(),
  dateTo: z.string().datetime({ offset: true }).optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { page, limit, actorId, action, entityType, dateFrom, dateTo } = parsed.data;

  const where = {
    organizationId: session.user.organizationId,
    ...(actorId ? { actorId } : {}),
    ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}),
    ...(entityType ? { entityType } : {}),
    ...((dateFrom || dateTo)
      ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorId: true,
        actorEmail: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, limit });
}
