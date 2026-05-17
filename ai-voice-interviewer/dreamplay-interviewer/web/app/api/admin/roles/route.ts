import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  try {
    const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json(roles);
  } catch (err) {
    console.error("[GET /api/admin/roles]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      name?: string;
      slug?: string;
      questionBank?: string[];
      scoringWeights?: Record<string, number>;
    };

    if (!body.name || !body.slug || !body.questionBank) {
      return NextResponse.json(
        { error: "name, slug, and questionBank are required" },
        { status: 400 }
      );
    }

    const defaultWeights = {
      communication: 0.2,
      role_fit: 0.25,
      motivation: 0.2,
      culture_fit: 0.15,
      problem_solving: 0.2,
    };

    const role = await prisma.role.create({
      data: {
        name: body.name,
        slug: body.slug,
        questionBank: body.questionBank as never,
        scoringWeights: (body.scoringWeights ?? defaultWeights) as never,
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/roles]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
