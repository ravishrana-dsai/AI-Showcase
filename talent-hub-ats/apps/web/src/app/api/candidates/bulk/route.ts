import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { candidateIds, action, tagId } = body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return NextResponse.json(
        { error: "candidateIds array is required and must not be empty" },
        { status: 400 }
      );
    }

    const validActions = ["archive", "unarchive", "tag", "untag"];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: "action must be one of: archive, unarchive, tag, untag" },
        { status: 400 }
      );
    }

    if ((action === "tag" || action === "untag") && !tagId) {
      return NextResponse.json(
        { error: "tagId is required for tag and untag actions" },
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

    const where = {
      id: { in: candidateIds },
      organizationId,
    };

    let count = 0;

    switch (action) {
      case "archive": {
        const result = await prisma.candidate.updateMany({
          where,
          data: { isArchived: true },
        });
        count = result.count;
        break;
      }
      case "unarchive": {
        const result = await prisma.candidate.updateMany({
          where,
          data: { isArchived: false },
        });
        count = result.count;
        break;
      }
      case "tag": {
        const candidates = await prisma.candidate.findMany({
          where,
          select: { id: true },
        });
        const tag = await prisma.tag.findFirst({
          where: { id: tagId, organizationId },
        });
        if (!tag) {
          return NextResponse.json(
            { error: "Tag not found" },
            { status: 404 }
          );
        }
        let created = 0;
        for (const c of candidates) {
          try {
            await prisma.candidateTag.create({
              data: { candidateId: c.id, tagId },
            });
            created++;
          } catch {
            // Skip duplicates
          }
        }
        count = created;
        break;
      }
      case "untag": {
        const result = await prisma.candidateTag.deleteMany({
          where: {
            candidateId: { in: candidateIds },
            tagId,
            candidate: { organizationId },
          },
        });
        count = result.count;
        break;
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("Bulk candidate action error:", error);
    return NextResponse.json(
      { error: "Failed to perform bulk action" },
      { status: 500 }
    );
  }
}
