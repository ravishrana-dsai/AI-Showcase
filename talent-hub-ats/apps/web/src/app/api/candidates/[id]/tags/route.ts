import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

// GET /api/candidates/[id]/tags — list tags on a candidate
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const tags = await prisma.candidateTag.findMany({
    where: { candidateId: id },
    include: { tag: true },
    orderBy: { assignedAt: "asc" },
  });

  return NextResponse.json(tags.map((ct) => ct.tag));
}

// POST /api/candidates/[id]/tags — add a tag (by tagId or create new)
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
  const { tagId, name, color } = body;

  const candidate = await prisma.candidate.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  let resolvedTagId: string = tagId;

  if (!tagId && name) {
    // Create or find tag by name
    const tag = await prisma.tag.upsert({
      where: {
        organizationId_name: {
          organizationId: session.user.organizationId,
          name: name.trim(),
        },
      },
      update: {},
      create: {
        name: name.trim(),
        color: color || "#6B7280",
        organizationId: session.user.organizationId,
      },
    });
    resolvedTagId = tag.id;
  }

  if (!resolvedTagId) {
    return NextResponse.json(
      { error: "tagId or name is required" },
      { status: 400 }
    );
  }

  // Add tag (ignore if already exists)
  await prisma.candidateTag.upsert({
    where: { candidateId_tagId: { candidateId: id, tagId: resolvedTagId } },
    update: {},
    create: { candidateId: id, tagId: resolvedTagId },
  });

  const tag = await prisma.tag.findUnique({ where: { id: resolvedTagId } });

  return NextResponse.json(tag, { status: 201 });
}

// DELETE /api/candidates/[id]/tags?tagId=xxx — remove a tag
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const tagId = searchParams.get("tagId");

  if (!tagId) {
    return NextResponse.json({ error: "tagId is required" }, { status: 400 });
  }

  await prisma.candidateTag.deleteMany({
    where: { candidateId: id, tagId },
  });

  return NextResponse.json({ success: true });
}
