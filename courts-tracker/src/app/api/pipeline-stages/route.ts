import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const stageSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  stageOrder: z.number().int().min(0),
  slaHours: z.number().min(0.1),
  isActive: z.boolean().default(true),
  color: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stages = await prisma.pipelineStage.findMany({
    orderBy: { stageOrder: "asc" },
  });
  return NextResponse.json({ data: stages });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = stageSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const stage = await prisma.pipelineStage.create({ data: parsed.data });
  return NextResponse.json({ data: stage }, { status: 201 });
}
