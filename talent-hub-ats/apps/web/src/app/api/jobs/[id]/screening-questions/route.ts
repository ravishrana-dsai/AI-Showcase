import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const showToCandidate = req.nextUrl.searchParams.get("showToCandidate");

  const where: Record<string, unknown> = { jobId: id };
  if (showToCandidate === "true") where.showToCandidate = true;
  if (showToCandidate === "false") where.showToCandidate = false;

  const questions = await prisma.screeningQuestion.findMany({
    where,
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ questions });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const question = await prisma.screeningQuestion.create({
    data: {
      jobId: id,
      question: body.question ?? "",
      type: body.type ?? "TEXT",
      options: Array.isArray(body.options) ? JSON.stringify(body.options) : (body.options ?? null),
      isRequired: body.isRequired ?? false,
      isKnockout: body.isKnockout ?? false,
      knockoutAnswer: body.knockoutAnswer ?? null,
      showToCandidate: body.showToCandidate ?? false,
      order: body.order ?? 0,
    },
  });

  return NextResponse.json({ question });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { questions } = body;

  if (!Array.isArray(questions)) {
    return NextResponse.json({ error: "questions must be an array" }, { status: 400 });
  }

  // Upsert each question so stale IDs don't cause a P2025 crash
  const updated = await Promise.all(
    questions.map((q: {
      id: string;
      question: string;
      type: string;
      options?: string[] | string | null;
      isRequired?: boolean;
      isKnockout?: boolean;
      knockoutAnswer?: string | null;
      showToCandidate?: boolean;
      order: number;
    }, idx: number) => {
      const data = {
        question: q.question,
        type: q.type,
        options: Array.isArray(q.options) ? JSON.stringify(q.options) : (q.options ?? null),
        isRequired: q.isRequired ?? false,
        isKnockout: q.isKnockout ?? false,
        knockoutAnswer: q.knockoutAnswer ?? null,
        showToCandidate: q.showToCandidate ?? false,
        order: q.order ?? idx,
      };
      return prisma.screeningQuestion.upsert({
        where: { id: q.id },
        update: data,
        create: { id: q.id, jobId: id, ...data },
      });
    })
  );

  return NextResponse.json({ questions: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const questionId = req.nextUrl.searchParams.get("questionId");
  if (!questionId) {
    return NextResponse.json({ error: "questionId is required" }, { status: 400 });
  }

  await prisma.screeningQuestion.delete({ where: { id: questionId } });

  return NextResponse.json({ success: true });
}
