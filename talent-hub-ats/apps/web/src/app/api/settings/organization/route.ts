import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";
import { generateUniqueOrgSlug } from "@/lib/slug";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string })
    .organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        website: true,
        industry: true,
        size: true,
      },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json(org);
  } catch (error) {
    console.error("Get organization error:", error);
    return NextResponse.json(
      { error: "Failed to load organization" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = (session.user as { organizationId?: string })
    .organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    if (name !== undefined && !name) {
      return NextResponse.json(
        { error: "Organization name is required" },
        { status: 400 }
      );
    }

    // Regenerate slug when organization name changes
    let newSlug: string | undefined;
    if (name !== undefined) {
      const currentOrg = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      if (currentOrg && currentOrg.name !== name) {
        newSlug = await generateUniqueOrgSlug(name);
      }
    }

    const org = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        ...(name !== undefined && { name }),
        ...(newSlug !== undefined && { slug: newSlug }),
        ...(body.website !== undefined && {
          website: body.website ? String(body.website).trim() : null,
        }),
        ...(body.industry !== undefined && {
          industry: body.industry ? String(body.industry).trim() : null,
        }),
        ...(body.size !== undefined && {
          size: body.size ? String(body.size).trim() : null,
        }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        website: true,
        industry: true,
        size: true,
      },
    });
    return NextResponse.json(org);
  } catch (error) {
    console.error("Update organization error:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
}
