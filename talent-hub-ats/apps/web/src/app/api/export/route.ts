import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

function escapeCsvValue(value: string | null | undefined): string {
  if (value == null || value === "") return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (!type) {
      return NextResponse.json(
        { error: "type query param is required (candidates | applications | interviews)" },
        { status: 400 }
      );
    }

    const validTypes = ["candidates", "applications", "interviews"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: "type must be one of: candidates, applications, interviews" },
        { status: 400 }
      );
    }

    const organizationId = (session.user as { organizationId?: string })
      .organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    let csv = "";
    let filename = "export.csv";

    if (type === "candidates") {
      const candidates = await prisma.candidate.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "currentCompany",
        "currentTitle",
        "location",
        "source",
        "createdAt",
      ];
      csv = headers.join(",") + "\n";

      for (const c of candidates) {
        const row = [
          escapeCsvValue(c.firstName),
          escapeCsvValue(c.lastName),
          escapeCsvValue(c.email),
          escapeCsvValue(c.phone),
          escapeCsvValue(c.currentCompany),
          escapeCsvValue(c.currentTitle),
          escapeCsvValue(c.location),
          escapeCsvValue(c.source),
          escapeCsvValue(c.createdAt?.toISOString()),
        ];
        csv += row.join(",") + "\n";
      }
      filename = "candidates.csv";
    } else if (type === "applications") {
      const applications = await prisma.application.findMany({
        where: { job: { organizationId } },
        include: {
          candidate: true,
          job: true,
          currentStage: true,
        },
        orderBy: { appliedAt: "desc" },
      });

      const headers = [
        "candidateName",
        "jobTitle",
        "stage",
        "status",
        "source",
        "appliedAt",
      ];
      csv = headers.join(",") + "\n";

      for (const a of applications) {
        const candidateName = `${a.candidate.firstName} ${a.candidate.lastName}`;
        const row = [
          escapeCsvValue(candidateName),
          escapeCsvValue(a.job.title),
          escapeCsvValue(a.currentStage.name),
          escapeCsvValue(a.status),
          escapeCsvValue(a.source),
          escapeCsvValue(a.appliedAt?.toISOString()),
        ];
        csv += row.join(",") + "\n";
      }
      filename = "applications.csv";
    } else if (type === "interviews") {
      const interviews = await prisma.interview.findMany({
        where: { application: { job: { organizationId } } },
        include: {
          application: {
            include: { candidate: true, job: true },
          },
        },
        orderBy: { scheduledAt: "desc" },
      });

      const headers = [
        "candidateName",
        "jobTitle",
        "title",
        "type",
        "scheduledAt",
        "status",
      ];
      csv = headers.join(",") + "\n";

      for (const i of interviews) {
        const candidateName = `${i.application.candidate.firstName} ${i.application.candidate.lastName}`;
        const row = [
          escapeCsvValue(candidateName),
          escapeCsvValue(i.application.job.title),
          escapeCsvValue(i.title),
          escapeCsvValue(i.type),
          escapeCsvValue(i.scheduledAt?.toISOString()),
          escapeCsvValue(i.status),
        ];
        csv += row.join(",") + "\n";
      }
      filename = "interviews.csv";
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
