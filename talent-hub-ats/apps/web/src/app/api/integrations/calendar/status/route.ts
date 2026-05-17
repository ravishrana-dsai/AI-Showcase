import { NextResponse } from "next/server";
import { getSession } from "@/lib/get-session";
import { prisma } from "@talent-hub/db";

export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await prisma.calendarIntegration.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      isActive: true,
      needsReauth: true,
      calendarId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ integration });
}
