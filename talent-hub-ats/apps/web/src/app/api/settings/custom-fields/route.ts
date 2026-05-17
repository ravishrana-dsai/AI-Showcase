import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fields = await prisma.customFieldDefinition.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: [{ entityType: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(fields);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, fieldKey, type, entityType, options, isRequired } = body;

  if (!name || !fieldKey || !type || !entityType) {
    return NextResponse.json(
      { error: "name, fieldKey, type, and entityType are required" },
      { status: 400 }
    );
  }

  const VALID_TYPES = ["TEXT", "NUMBER", "DATE", "SELECT", "MULTI_SELECT", "BOOLEAN", "URL"];
  const VALID_ENTITY_TYPES = ["JOB", "CANDIDATE", "APPLICATION", "OFFER"];

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!VALID_ENTITY_TYPES.includes(entityType)) {
    return NextResponse.json({ error: "Invalid entityType" }, { status: 400 });
  }

  const field = await prisma.customFieldDefinition.create({
    data: {
      name: name.trim(),
      fieldKey: fieldKey.trim().toLowerCase().replace(/\s+/g, "_"),
      type,
      entityType,
      options: options ? JSON.stringify(options) : null,
      isRequired: isRequired ?? false,
      organizationId: session.user.organizationId,
    },
  });

  return NextResponse.json(field, { status: 201 });
}
