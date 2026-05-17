/**
 * LinkedIn profile importer via Proxycurl API.
 * If PROXYCURL_API_KEY is not set, returns a minimal profile with just the URL
 * so the form can still be used for manual entry.
 */
import type { LinkedInProfileData } from "./linkedin-types";

const PROXYCURL_API = "https://nubela.co/proxycurl/api/v2/linkedin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProxycurlResponse(data: any, linkedinUrl: string): LinkedInProfileData {
  const experience: LinkedInProfileData["experience"] = (data.experiences ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => ({
      company: e.company ?? "",
      title: e.title ?? "",
      starts_at: e.starts_at ?? undefined,
      ends_at: e.ends_at ?? null,
      description: e.description ?? undefined,
    })
  );

  const current = experience[0] ?? null;

  return {
    firstName: data.first_name ?? "",
    lastName: data.last_name ?? "",
    email: data.personal_emails?.[0] ?? null,
    headline: data.headline ?? null,
    currentTitle: current?.title ?? data.occupation ?? null,
    currentCompany: current?.company ?? null,
    location: data.city
      ? [data.city, data.state, data.country].filter(Boolean).join(", ")
      : null,
    linkedinUrl,
    skills: (data.skills ?? []).slice(0, 20),
    experience,
  };
}

export async function importLinkedInProfile(
  linkedinUrl: string
): Promise<LinkedInProfileData> {
  const apiKey = process.env.PROXYCURL_API_KEY;

  if (!apiKey) {
    // Manual entry mode: return stub with just the URL
    return {
      firstName: "",
      lastName: "",
      email: null,
      headline: null,
      currentTitle: null,
      currentCompany: null,
      location: null,
      linkedinUrl,
      skills: [],
      experience: [],
    };
  }

  const url = new URL(PROXYCURL_API);
  url.searchParams.set("url", linkedinUrl);
  url.searchParams.set("personal_email", "include");
  url.searchParams.set("skills", "include");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    throw new Error(`Proxycurl API error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return mapProxycurlResponse(data, linkedinUrl);
}
