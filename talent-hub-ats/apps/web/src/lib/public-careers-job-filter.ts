/**
 * Jobs shown on public career pages and apply flows.
 * Use status OPEN only — do not require `publishedAt` (many live rows never had it backfilled).
 */
export const publicCareersJobWhere = {
  status: "OPEN" as const,
};
