import { prisma } from "@talent-hub/db";

const HIDE_DEMO_KEY = "hideDemoData";

/**
 * Returns whether the organization has "hide demo data" enabled.
 * When true, list/count queries should exclude records where isDemo is true.
 */
export async function getOrgHideDemoData(
  organizationId: string
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  if (!org) return false;
  try {
    const s = JSON.parse(org.settings || "{}") as Record<string, unknown>;
    return s[HIDE_DEMO_KEY] === true;
  } catch {
    return false;
  }
}

/**
 * Where clause addition for Prisma: when hideDemo is true, only non-demo records.
 * Use: where: { ...orgWhere, ...demoFilterWhere(hideDemo) }
 */
export function demoFilterWhere(hideDemo: boolean): { isDemo?: boolean } {
  if (!hideDemo) return {};
  return { isDemo: false };
}
