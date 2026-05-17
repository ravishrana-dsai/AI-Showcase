import { distance } from "fastest-levenshtein";
import { prisma } from "@talent-hub/db";

export type DuplicateConfidence = "EXACT" | "PROBABLE";

export interface DuplicateMatch {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    currentTitle: string | null;
    currentCompany: string | null;
    phone: string | null;
  };
  confidence: DuplicateConfidence;
}

export interface DuplicateCheckInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

/**
 * Find duplicate candidates for the given input within an organization.
 *
 * Strategy:
 *  1. Exact email match (case-insensitive) = EXACT confidence
 *  2. Pre-filter by first letter of lastName, run Levenshtein similarity on
 *     fullName (>= 0.80 threshold) AND phone exact match = PROBABLE confidence
 */
export async function findDuplicates(
  organizationId: string,
  input: DuplicateCheckInput
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const seenIds = new Set<string>();

  // 1. Exact email match
  if (input.email) {
    const emailMatches = await prisma.candidate.findMany({
      where: {
        organizationId,
        email: { equals: input.email.toLowerCase().trim(), mode: "insensitive" },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        currentTitle: true,
        currentCompany: true,
        phone: true,
      },
    });

    for (const c of emailMatches) {
      seenIds.add(c.id);
      matches.push({ candidate: c, confidence: "EXACT" });
    }
  }

  // 2. Fuzzy name + phone match
  if (input.firstName && input.lastName && input.phone) {
    const inputFullName = `${input.firstName.trim()} ${input.lastName.trim()}`.toLowerCase();
    const lastInitial = input.lastName.trim().charAt(0).toLowerCase();

    // Pre-filter by last name initial to reduce the comparison set
    const candidates = await prisma.candidate.findMany({
      where: {
        organizationId,
        lastName: { startsWith: lastInitial, mode: "insensitive" },
        phone: input.phone.trim(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        currentTitle: true,
        currentCompany: true,
        phone: true,
      },
    });

    for (const c of candidates) {
      if (seenIds.has(c.id)) continue;

      const candidateFullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      const maxLen = Math.max(inputFullName.length, candidateFullName.length);
      if (maxLen === 0) continue;

      const editDistance = distance(inputFullName, candidateFullName);
      const similarity = 1 - editDistance / maxLen;

      if (similarity >= 0.8) {
        seenIds.add(c.id);
        matches.push({ candidate: c, confidence: "PROBABLE" });
      }
    }
  }

  return matches;
}
