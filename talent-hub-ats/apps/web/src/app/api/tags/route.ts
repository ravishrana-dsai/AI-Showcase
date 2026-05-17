import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(tags);
}
