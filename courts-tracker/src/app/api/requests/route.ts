import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "25");
  const courtId = searchParams.get("courtId");
  const status = searchParams.get("status");
  const stageId = searchParams.get("stageId");
  const slaBreached = searchParams.get("slaBreached");
  const assignedTo = searchParams.get("assignedTo");
  const search = searchParams.get("search");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortDir = (searchParams.get("sortDir") ?? "desc") as "asc" | "desc";

  const where = {
    ...(courtId && { courtId }),
    ...(status && { status: status as never }),
    ...(stageId && { currentStageId: stageId }),
    ...(slaBreached !== null && { slaBreached: slaBreached === "true" }),
    ...(assignedTo && { assignedTo }),
    ...(dateFrom || dateTo
      ? {
          createdAt: {
            ...(dateFrom && { gte: new Date(dateFrom) }),
            ...(dateTo && { lte: new Date(dateTo) }),
          },
        }
      : {}),
    ...(search && {
      OR: [
        { externalId: { contains: search, mode: "insensitive" as const } },
        { playerName: { contains: search, mode: "insensitive" as const } },
        { playerId: { contains: search, mode: "insensitive" as const } },
        { court: { name: { contains: search, mode: "insensitive" as const } } },
      ],
    }),
  };

  const [requests, total] = await Promise.all([
    prisma.request.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sortBy]: sortDir },
      include: {
        court: { select: { id: true, name: true, city: true } },
        stageLogs: {
          include: { stage: { select: { id: true, name: true, displayName: true, color: true, stageOrder: true } } },
          orderBy: { createdAt: "asc" },
        },
        slaAlerts: {
          where: { acknowledged: false },
          select: { id: true, alertType: true },
        },
      },
    }),
    prisma.request.count({ where }),
  ]);

  return NextResponse.json({
    data: requests,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
