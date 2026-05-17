import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Scorecard } from "@/lib/types";

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

    const filtered = recommendation
      ? interviews.filter((i) => {
          const sc = i.scorecard as Scorecard | null;
          return sc?.recommendation === recommendation;
        })
      : interviews;

    const rows = [
      [
        "Candidate Name",
        "Email",
        "Role",
        "Status",
        "Overall Score",
        "Recommendation",
        "Communication",
        "Role Fit",
        "Motivation",
        "Culture Fit",
        "Problem Solving",
        "Summary",
        "Strengths",
        "Concerns",
        "Created At",
        "Completed At",
        "Duration (mins)",
      ].join(","),
      ...filtered.map((iv) => {
        const sc = iv.scorecard as Scorecard | null;
        const esc = (s: string | undefined | null) =>
          `"${(s ?? "").replace(/"/g, '""')}"`;
        return [
          esc(iv.candidate.name),
          esc(iv.candidate.email),
          esc(iv.role.name),
          esc(iv.status),
          sc?.overall_score ?? "",
          esc(sc?.recommendation),
          sc?.dimensions.communication.score ?? "",
          sc?.dimensions.role_fit.score ?? "",
          sc?.dimensions.motivation.score ?? "",
          sc?.dimensions.culture_fit.score ?? "",
          sc?.dimensions.problem_solving.score ?? "",
          esc(sc?.summary),
          esc(sc?.strengths.join("; ")),
          esc(sc?.concerns.join("; ")),
          esc(iv.createdAt.toISOString()),
          esc(iv.completedAt?.toISOString()),
          iv.durationSecs != null ? Math.round(iv.durationSecs / 60) : "",
        ].join(",");
      }),
    ].join("\n");

    return new NextResponse(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="ai-interviews-${Date.now()}.csv"`,
      },
    });
  } catch (err) {
    console.error("[GET /api/admin/interviews/export]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
