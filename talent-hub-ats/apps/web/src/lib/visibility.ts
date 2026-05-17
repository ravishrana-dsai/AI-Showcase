// Field-level visibility control for candidate profiles.
// Admins configure which roles can see which fields via the visibility settings page.
// This module provides the default config and the canView() helper.

export type VisibilityField =
  | "resume"
  | "contactInfo"
  | "expectedCtc"
  | "noticePeriod"
  | "linkedinUrl"
  | "source"
  | "skills"
  | "summary";

export const DEFAULT_VISIBILITY: Record<VisibilityField, Record<string, boolean>> = {
  resume: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: true,
    INTERVIEWER: true,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  contactInfo: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: true,
    INTERVIEWER: false,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  expectedCtc: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: false,
    INTERVIEWER: false,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  noticePeriod: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: false,
    INTERVIEWER: false,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  linkedinUrl: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: true,
    INTERVIEWER: false,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  source: {
    RECRUITER: true,
    SUB_RECRUITER: false,
    HIRING_MANAGER: false,
    INTERVIEWER: false,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  skills: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: true,
    INTERVIEWER: true,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
  summary: {
    RECRUITER: true,
    SUB_RECRUITER: true,
    HIRING_MANAGER: true,
    INTERVIEWER: true,
    ADMIN: true,
    SUPER_ADMIN: true,
  },
};

/**
 * Merges stored org config with the defaults.
 * Stored values win for all configurable roles: RECRUITER, HIRING_MANAGER,
 * INTERVIEWER (managed by Admins), and SUB_RECRUITER (managed by Recruiters).
 * Non-configurable roles (ADMIN, SUPER_ADMIN) always use the default.
 */
export function mergeVisibilityConfig(
  stored: Record<string, Record<string, boolean>>
): Record<VisibilityField, Record<string, boolean>> {
  const fields = Object.keys(DEFAULT_VISIBILITY) as VisibilityField[];
  const result = {} as Record<VisibilityField, Record<string, boolean>>;

  for (const field of fields) {
    const storedField = stored[field] ?? {};
    result[field] = { ...DEFAULT_VISIBILITY[field], ...storedField };
  }

  return result;
}

/**
 * Returns true if the given role is allowed to view the given field,
 * according to the merged visibility config.
 */
export function canView(
  field: VisibilityField,
  role: string,
  config: Record<string, Record<string, boolean>>
): boolean {
  const fieldConfig = config[field] ?? DEFAULT_VISIBILITY[field];
  if (fieldConfig !== undefined && role in fieldConfig) {
    return fieldConfig[role];
  }
  return DEFAULT_VISIBILITY[field]?.[role] ?? false;
}
