import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const roleSlug = searchParams.get("role");
    const recommendation = searchParams.get("recommendation");

    const interviews = await prisma.interview.findMany({
      where: {
        ...(roleSlug ? { role: { slug: roleSlug } } : {}),
      },
      include: { candidate: true, role: true },
      orderBy: { createdAt: "desc" },
    });

    // Filter by recommendation post-query (stored inside JSON scorecard)
    const filtered = recommendation
      ? interviews.filter((i) => {
          const scorecard = i.scorecard as { recommendation?: string } | null;
          return scorecard?.recommendation === recommendation;
        })
      : interviews;

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[GET /api/admin/interviews]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
