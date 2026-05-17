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
  if (!["ADMIN", "SUPER_ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const format = req.nextUrl.searchParams.get("format") || "json";

  const candidate = await prisma.candidate.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      applications: {
        include: {
          job: { select: { title: true } },
          currentStage: { select: { name: true } },
          stageHistory: {
            include: { stage: { select: { name: true } } },
            orderBy: { enteredAt: "asc" },
          },
          interviews: {
            include: {
              panelists: { include: { user: { select: { name: true, email: true } } } },
            },
            orderBy: { scheduledAt: "asc" },
          },
          offer: true,
        },
      },
      notes: {
        include: { author: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
      },
      documents: { orderBy: { uploadedAt: "desc" } },
      tags: { include: { tag: { select: { name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, take: 200 },
      eeoResponse: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const filename = `candidate-${candidate.firstName}-${candidate.lastName}-${id.slice(-8)}`;

  if (format === "csv") {
    const csv = buildCsv(candidate);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
      },
    });
  }

  // JSON export
  return new NextResponse(JSON.stringify(candidate, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}.json"`,
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCsv(candidate: any): string {
  const escape = (v: unknown) => {
    const s = String(v ?? "").replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows: string[][] = [];

  // Profile section
  rows.push(["Section", "Field", "Value"]);
  rows.push(["Profile", "First Name", candidate.firstName]);
  rows.push(["Profile", "Last Name", candidate.lastName]);
  rows.push(["Profile", "Email", candidate.email]);
  rows.push(["Profile", "Phone", candidate.phone ?? ""]);
  rows.push(["Profile", "Location", candidate.location ?? ""]);
  rows.push(["Profile", "Current Title", candidate.currentTitle ?? ""]);
  rows.push(["Profile", "Current Company", candidate.currentCompany ?? ""]);
  rows.push(["Profile", "LinkedIn", candidate.linkedinUrl ?? ""]);
  rows.push(["Profile", "Source", candidate.source ?? ""]);
  rows.push(["Profile", "Created At", candidate.createdAt]);

  // Applications
  for (const app of candidate.applications ?? []) {
    rows.push(["Application", "Job", app.job?.title ?? ""]);
    rows.push(["Application", "Status", app.status]);
    rows.push(["Application", "Stage", app.currentStage?.name ?? ""]);
    rows.push(["Application", "Applied At", app.appliedAt]);
    if (app.hiredAt) rows.push(["Application", "Hired At", app.hiredAt]);
    if (app.rejectedAt) rows.push(["Application", "Rejected At", app.rejectedAt]);
  }

  // Notes
  for (const note of candidate.notes ?? []) {
    rows.push(["Note", "Author", note.author?.email ?? ""]);
    rows.push(["Note", "Content", note.content ?? ""]);
    rows.push(["Note", "Date", note.createdAt]);
  }

  // EEO
  if (candidate.eeoResponse) {
    const eeo = candidate.eeoResponse;
    rows.push(["EEO", "Gender", eeo.gender ?? ""]);
    rows.push(["EEO", "Race", eeo.race ?? ""]);
    rows.push(["EEO", "Ethnicity", eeo.ethnicity ?? ""]);
    rows.push(["EEO", "Veteran Status", eeo.veteranStatus ?? ""]);
    rows.push(["EEO", "Disability Status", eeo.disabilityStatus ?? ""]);
  }

  return rows.map((row) => row.map(escape).join(",")).join("\n");
}
