/**
 * Public standalone careers app URL (apps/careers-portal).
 * Used for preview links from the hiring portal and for /careers → external redirect.
 */
export function getCareersPublicSiteBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_CAREERS_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.BASE_PATH === "/hiring-portal") {
    return "https://careers.company.com";
  }
  return "http://localhost:3051/careers";
}
