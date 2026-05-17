/**
 * All career data and mutations go through the hiring portal (apps/web).
 * The careers app does not use DATABASE_URL or Prisma.
 */

export function getHiringPortalBaseUrl(): string | null {
  const raw = process.env.HIRING_PORTAL_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Base URL for **server-side** HTTP from careers → hiring portal (RSC, route handlers).
 * Set `HIRING_PORTAL_INTERNAL_URL` when the public `HIRING_PORTAL_URL` sits behind SSO and
 * returns 302 to `/login` for unauthenticated requests (common on [Company] Experiments).
 * Use a URL that reaches the Next process directly, e.g. `http://127.0.0.1:<port>/hiring-portal`
 * (see PM2 / portal docs for the app port). Browser links and assets still use `HIRING_PORTAL_URL`.
 */
export function getHiringPortalServerFetchBaseUrl(): string | null {
  const internal = process.env.HIRING_PORTAL_INTERNAL_URL?.trim();
  if (internal) return internal.replace(/\/$/, "");
  return getHiringPortalBaseUrl();
}

/** Screening question `options` from DB — tolerate invalid JSON. */
export function parseQuestionOptionsJson(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    return null;
  }
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Use in API route proxies — must fail if env is missing. */
export function requireHiringPortalBaseUrl(): string {
  const base = getHiringPortalBaseUrl();
  if (!base) {
    throw new Error(
      "HIRING_PORTAL_URL is required (e.g. http://localhost:3050 or https://host/hiring-portal)"
    );
  }
  return base;
}

/** Outbound fetch target for server-side proxies (apply/EEO); prefers internal URL when set. */
export function requireHiringPortalServerFetchBaseUrl(): string {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) {
    throw new Error(
      "HIRING_PORTAL_URL is required (e.g. http://localhost:3050 or https://host/hiring-portal)"
    );
  }
  return base;
}

async function hiringPortalFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) {
    return new Response(null, { status: 599 });
  }
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    cache: init?.cache ?? "no-store",
    redirect: "manual",
  });
}

function logHiringPortalFetchFailure(
  label: string,
  url: string,
  res: Response
): void {
  if (res.status >= 300 && res.status < 400) {
    console.warn(
      `[careers] ${label} HTTP ${res.status} redirect (SSO/proxy?) — ${url} → ${res.headers.get("location") || ""}. Set HIRING_PORTAL_INTERNAL_URL to a loopback URL that reaches hiring-portal without SSO.`
    );
  } else if (!res.ok) {
    console.warn(`[careers] ${label} HTTP ${res.status} — ${url}`);
  }
}

export function hiringPortalPublicAssetUrl(storageKey: string): string | null {
  const base = getHiringPortalBaseUrl();
  if (!base) return null;
  const segments = storageKey.split("/").map((s) => encodeURIComponent(s));
  return `${base}/api/public/careers/assets/${segments.join("/")}`;
}

export function hiringPortalLogoSrc(
  careerLogoKey: string | null | undefined,
  orgLogo: string | null | undefined
): string | null {
  if (careerLogoKey) return hiringPortalPublicAssetUrl(careerLogoKey);
  if (orgLogo?.startsWith("http://") || orgLogo?.startsWith("https://")) return orgLogo;
  if (orgLogo?.startsWith("career-page/")) return hiringPortalPublicAssetUrl(orgLogo);
  return null;
}

export type CareerPageConfigJson = Record<string, unknown> | null;

export interface OrgCareerBundle {
  organization: {
    id: string;
    name: string;
    slug: string;
    logo: string | null;
    careerPageConfig: CareerPageConfigJson;
  };
  jobs: Array<{
    id: string;
    title: string;
    employmentType: string | null;
    location: { name: string } | null;
    department: { name: string } | null;
    publishedAt: string;
  }>;
}

export async function fetchOrgCareerBundle(slug: string): Promise<OrgCareerBundle | null> {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) return null;
  const path = `/api/public/careers/orgs/${encodeURIComponent(slug)}`;
  try {
    const res = await hiringPortalFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) {
      logHiringPortalFetchFailure("fetchOrgCareerBundle", `${base}${path}`, res);
      return null;
    }
    return await readJsonSafe<OrgCareerBundle>(res);
  } catch (e) {
    console.error("[careers] fetchOrgCareerBundle", slug, e);
    return null;
  }
}

export interface CareersJobsResponse {
  jobs: Array<{
    id: string;
    title: string;
    employmentType: string | null;
    location: { name: string } | null;
    department: { name: string } | null;
    organization: { name: string; slug: string } | null;
    publishedAt: string;
  }>;
}

export async function fetchAllOpenJobs(): Promise<CareersJobsResponse["jobs"]> {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) return [];
  const path = "/api/public/careers/jobs";
  try {
    const res = await hiringPortalFetch(path);
    if (!res.ok) {
      logHiringPortalFetchFailure("fetchAllOpenJobs", `${base}${path}`, res);
      return [];
    }
    const data = await readJsonSafe<CareersJobsResponse>(res);
    return data?.jobs ?? [];
  } catch (e) {
    console.error("[careers] fetchAllOpenJobs", e);
    return [];
  }
}

export interface OrgJobDetailResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    careerPageConfig: { logoUrl: string | null; primaryColor: string } | null;
  };
  job: {
    id: string;
    title: string;
    employmentType: string | null;
    experienceLevel: string | null;
    openingParagraph: string | null;
    description: string | null;
    requirements: string | null;
    location: { name: string } | null;
    department: { name: string } | null;
    organization: { id: string; name: string } | null;
  };
  screeningQuestions: Array<{
    id: string;
    question: string;
    type: string;
    options: string | null;
    isRequired: boolean;
  }>;
}

export async function fetchOrgJobDetail(
  slug: string,
  jobId: string
): Promise<OrgJobDetailResponse | null> {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) return null;
  const path = `/api/public/careers/orgs/${encodeURIComponent(slug)}/jobs/${encodeURIComponent(jobId)}`;
  try {
    const res = await hiringPortalFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) {
      logHiringPortalFetchFailure("fetchOrgJobDetail", `${base}${path}`, res);
      return null;
    }
    return await readJsonSafe<OrgJobDetailResponse>(res);
  } catch (e) {
    console.error("[careers] fetchOrgJobDetail", slug, jobId, e);
    return null;
  }
}

export async function fetchJobMeta(jobId: string): Promise<{ title: string; orgName: string | null } | null> {
  const jobs = await fetchAllOpenJobs();
  const j = jobs.find((x) => x.id === jobId);
  if (!j) return null;
  return { title: j.title, orgName: j.organization?.name ?? null };
}

export interface JobApplyBundleResponse {
  job: {
    id: string;
    title: string;
    employmentType: string | null;
    experienceLevel: string | null;
    openingParagraph: string | null;
    description: string | null;
    requirements: string | null;
    location: { name: string } | null;
    department: { name: string } | null;
    organization: { id: string; name: string; slug: string } | null;
  };
  screeningQuestions: Array<{
    id: string;
    question: string;
    type: string;
    options: string | null;
    isRequired: boolean;
  }>;
}

export async function fetchJobApplyBundle(jobId: string): Promise<JobApplyBundleResponse | null> {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) return null;
  const path = `/api/public/careers/jobs/${encodeURIComponent(jobId)}`;
  try {
    const res = await hiringPortalFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) {
      logHiringPortalFetchFailure("fetchJobApplyBundle", `${base}${path}`, res);
      return null;
    }
    return await readJsonSafe<JobApplyBundleResponse>(res);
  } catch (e) {
    console.error("[careers] fetchJobApplyBundle", jobId, e);
    return null;
  }
}

export interface CandidateEeoPayload {
  id: string;
  firstName: string;
  lastName: string;
  hasEeoResponse: boolean;
}

export async function fetchCandidateForEeo(candidateId: string): Promise<CandidateEeoPayload | null> {
  const base = getHiringPortalServerFetchBaseUrl();
  if (!base) return null;
  const path = `/api/public/careers/candidates/${encodeURIComponent(candidateId)}`;
  try {
    const res = await hiringPortalFetch(path);
    if (res.status === 404) return null;
    if (!res.ok) {
      logHiringPortalFetchFailure("fetchCandidateForEeo", `${base}${path}`, res);
      return null;
    }
    return await readJsonSafe<CandidateEeoPayload>(res);
  } catch (e) {
    console.error("[careers] fetchCandidateForEeo", candidateId, e);
    return null;
  }
}
