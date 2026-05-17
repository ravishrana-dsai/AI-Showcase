import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@talent-hub/db";

/**
 * GET /api/candidates/search?q=query
 * Search candidates by name or email
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const q = request.nextUrl.searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json({ candidates: [] });
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      createdAt: true,
    },
    take: 20,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ candidates });
}
