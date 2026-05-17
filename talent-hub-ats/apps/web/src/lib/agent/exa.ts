/**
 * SECURITY: Server-side only. Never import in client components.
 *
 * WHAT GOES TO EXA:
 *   Only plain-text search terms derived from job postings:
 *   job title, required skills, location.
 *
 * WHAT NEVER GOES TO EXA:
 *   Database IDs, organisation IDs, candidate records, salary data,
 *   user info, internal names, or any other DB-sourced values.
 *
 * SSRF NOTE: LinkedIn URLs returned by Exa are stored as plain strings.
 *   This server never fetches those URLs directly.
 */

import Exa from "exa-js";

// Field length caps — prevent prompt injection or oversized payloads
const MAX_NAME_LEN = 200;
const MAX_TITLE_LEN = 200;
const MAX_COMPANY_LEN = 200;
const MAX_SUMMARY_LEN = 2000;
const MAX_QUERY_LEN = 400;

export interface ExaLinkedInResult {
  name: string;
  linkedinUrl: string;
  title: string | null;
  company: string | null;
  summary: string | null;
}

export interface LinkedInSearchResult {
  results: ExaLinkedInResult[];
  /** "exact" = location filter matched; "keyword" = fell back to location-as-keyword; "none" = location dropped entirely */
  locationStrategy: "exact" | "keyword" | "none";
}

export interface LinkedInSearchParams {
  jobTitle: string;
  skills: string;
  location: string;
  maxResults?: number;
}

/**
 * Parse "Jane Smith - Senior Engineer at Acme Corp | LinkedIn"
 * into name, title, and company fields.
 */
function parseTitleField(raw: string): {
  name: string;
  title: string | null;
  company: string | null;
} {
  const cleaned = raw.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const dashIdx = cleaned.indexOf(" - ");
  if (dashIdx === -1) {
    return { name: cleaned.slice(0, MAX_NAME_LEN), title: null, company: null };
  }
  const name = cleaned.slice(0, dashIdx).trim().slice(0, MAX_NAME_LEN);
  const roleStr = cleaned.slice(dashIdx + 3).trim();
  const atIdx = roleStr.toLowerCase().indexOf(" at ");
  if (atIdx === -1) {
    return { name, title: roleStr.slice(0, MAX_TITLE_LEN), company: null };
  }
  const title = roleStr.slice(0, atIdx).trim().slice(0, MAX_TITLE_LEN);
  const company = roleStr.slice(atIdx + 4).trim().slice(0, MAX_COMPANY_LEN);
  return { name, title, company };
}

/**
 * Validate that a URL is a legitimate LinkedIn /in/ profile URL.
 * Rejects anything that is not a direct profile path.
 */
export function isValidLinkedInProfileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "linkedin.com" && host !== "www.linkedin.com") return false;
    if (!parsed.pathname.startsWith("/in/")) return false;
    // Must have a non-trivial slug after /in/
    const slug = parsed.pathname.slice(4).replace(/\/$/, "");
    if (!slug || slug.length < 2) return false;
    // Reject path traversal
    if (slug.includes("..") || slug.includes("//")) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a single Exa search and return parsed LinkedIn results.
 * Internal helper — callers use searchLinkedInCandidates.
 */
async function runExaSearch(
  exa: Exa,
  query: string,
  maxResults: number
): Promise<ExaLinkedInResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const response = await (exa as any).search(query, {
    category: "person",
    includeDomains: ["linkedin.com"],
    numResults: maxResults,
  });

  const results: ExaLinkedInResult[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const item of (response?.results ?? []) as any[]) {
    const url: string = item.url ?? "";
    if (!isValidLinkedInProfileUrl(url)) continue;

    const { name, title, company } = parseTitleField(item.title ?? "");
    if (!name || name.length < 2) continue;

    const summary = typeof item.text === "string"
      ? item.text.slice(0, MAX_SUMMARY_LEN)
      : null;

    results.push({
      name,
      linkedinUrl: url,
      title: title || null,
      company: company || null,
      summary,
    });
  }

  return results;
}

/**
 * Search LinkedIn via Exa People Search.
 * Only accepts plain-text search terms — no database data is forwarded.
 *
 * Location retry strategy (prevents empty results for sparse markets):
 *   1. "based in <location> <title> <skills>"  — strong geo signal
 *   2. "<title> <skills> <location>"           — location as keyword
 *   3. "<title> <skills>"                      — no location, note in result
 */
export async function searchLinkedInCandidates(
  params: LinkedInSearchParams
): Promise<LinkedInSearchResult> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey) {
    throw new Error("EXA_API_KEY is not configured");
  }

  const jobTitle = params.jobTitle.trim();
  const skills = params.skills.trim();
  const location = params.location.trim();
  const maxResults = Math.min(params.maxResults ?? 10, 10);

  if (!jobTitle && !skills) {
    return { results: [], locationStrategy: "none" };
  }

  const exa = new Exa(apiKey);
  const core = [jobTitle, skills].filter(Boolean).join(" ");

  // Attempt 1: location-prefixed phrase
  if (location) {
    const q1 = `based in ${location} ${core}`.slice(0, MAX_QUERY_LEN);
    const r1 = await runExaSearch(exa, q1, maxResults);
    if (r1.length > 0) {
      return { results: r1, locationStrategy: "exact" };
    }

    // Attempt 2: location appended as keyword
    const q2 = `${core} ${location}`.slice(0, MAX_QUERY_LEN);
    const r2 = await runExaSearch(exa, q2, maxResults);
    if (r2.length > 0) {
      return { results: r2, locationStrategy: "keyword" };
    }
  }

  // Attempt 3: no location at all
  const q3 = core.slice(0, MAX_QUERY_LEN);
  const r3 = await runExaSearch(exa, q3, maxResults);
  return { results: r3, locationStrategy: "none" };
}
