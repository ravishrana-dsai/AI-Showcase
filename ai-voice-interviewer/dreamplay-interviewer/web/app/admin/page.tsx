import { prisma } from "@/lib/prisma";
import { AdminDashboard } from "./AdminDashboard";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { role?: string; recommendation?: string; pin?: string };
}) {
  const cookieStore = cookies();
  const sessionPin = cookieStore.get("admin_pin")?.value;
  const paramPin = searchParams.pin;

  const ADMIN_PIN = process.env.ADMIN_PIN ?? "ADMIN_PIN_PLACEHOLDER";

  // Simple PIN gate — redirect to login if not authenticated
  const isAuthenticated = sessionPin === ADMIN_PIN || paramPin === ADMIN_PIN;
  if (!isAuthenticated) {
    redirect("/admin/login");
  }

  const [interviews, roles] = await Promise.all([
    prisma.interview.findMany({
      where: {
        ...(searchParams.role ? { role: { slug: searchParams.role } } : {}),
      },
      include: { candidate: true, role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Filter by recommendation (stored inside JSON)
  const filtered = searchParams.recommendation
    ? interviews.filter((i) => {
        const sc = i.scorecard as { recommendation?: string } | null;
        return sc?.recommendation === searchParams.recommendation;
      })
    : interviews;

  return <AdminDashboard interviews={filtered as never} roles={roles} />;
}
