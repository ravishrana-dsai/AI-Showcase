import { prisma } from "@/lib/prisma";
import { RolesManager } from "./RolesManager";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function RolesPage() {
  const cookieStore = cookies();
  const sessionPin = cookieStore.get("admin_pin")?.value;
  const ADMIN_PIN = process.env.ADMIN_PIN ?? "ADMIN_PIN_PLACEHOLDER";
  if (sessionPin !== ADMIN_PIN) redirect("/admin/login");

  const roles = await prisma.role.findMany({ orderBy: { name: "asc" } });
  return <RolesManager roles={roles as never} />;
}
