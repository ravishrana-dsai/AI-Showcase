import { prisma } from "@talent-hub/db";
import { slugify } from "@/lib/utils";

const MAX_SLUG_RETRIES = 20;

/**
 * Generate a unique organization slug from a name.
 * Appends -2, -3 etc. on collision.
 */
export async function generateUniqueOrgSlug(name: string): Promise<string> {
  const base = slugify(name);
  if (!base) throw new Error("Cannot generate slug from empty name");

  let candidate = base;
  for (let i = 2; i <= MAX_SLUG_RETRIES + 1; i++) {
    const existing = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${base}-${i}`;
  }

  throw new Error("Could not generate a unique slug after maximum retries");
}
