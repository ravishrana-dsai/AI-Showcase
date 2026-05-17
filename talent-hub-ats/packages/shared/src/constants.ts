// ===========================================
// Application-wide constants
// ===========================================

export const APP_NAME = "[Company] AI";

export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  RECRUITER: "RECRUITER",
  SUB_RECRUITER: "SUB_RECRUITER",
  HIRING_MANAGER: "HIRING_MANAGER",
  INTERVIEWER: "INTERVIEWER",
  LIMITED: "LIMITED",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  RECRUITER: "Recruiter",
  SUB_RECRUITER: "Sub-Recruiter",
  HIRING_MANAGER: "Hiring Manager",
  INTERVIEWER: "Interviewer",
  LIMITED: "Limited Access",
};

export const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  RECRUITER: 60,
  SUB_RECRUITER: 55,
  HIRING_MANAGER: 40,
  INTERVIEWER: 20,
  LIMITED: 10,
};

export const JOB_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  OPEN: "Open",
  CLOSED: "Closed",
  ON_HOLD: "On Hold",
  ARCHIVED: "Archived",
};

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  HIRED: "Hired",
  ARCHIVED: "Archived",
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  VOIDED: "Voided",
  EXPIRED: "Expired",
};

export const SCORECARD_RATING_LABELS: Record<string, string> = {
  STRONG_NO: "Strong No",
  NO: "No",
  NEUTRAL: "Neutral",
  YES: "Yes",
  STRONG_YES: "Strong Yes",
};

export const STAGE_TYPE_LABELS: Record<string, string> = {
  NEW: "New",
  LEAD: "Lead",
  REACHED_OUT: "Reached Out",
  SCREEN: "Screen",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  HIRED: "Hired",
  CUSTOM: "Custom",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  FULL_TIME: "Full Time",
  PART_TIME: "Part Time",
  CONTRACT: "Contract",
  INTERNSHIP: "Internship",
  TEMPORARY: "Temporary",
  FREELANCE: "Freelance",
};

export const EXPERIENCE_LEVEL_LABELS: Record<string, string> = {
  "1": "Level 1",
  "2": "Level 2",
  "3": "Level 3",
  "4": "Level 4",
  "5": "Level 5",
  "6": "Level 6",
  "7": "Level 7",
  "8": "Level 8",
  "9": "Level 9",
};

export const EXPERIENCE_LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

// Permissions matrix: what each role can do
export const PERMISSIONS = {
  // Job management
  "jobs.create": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "jobs.edit": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "jobs.delete": ["SUPER_ADMIN", "ADMIN"],
  "jobs.approve": ["SUPER_ADMIN", "ADMIN", "HIRING_MANAGER"],
  "jobs.view": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER", "INTERVIEWER", "LIMITED"],

  // Candidate management
  "candidates.create": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "candidates.edit": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "candidates.delete": ["SUPER_ADMIN", "ADMIN"],
  "candidates.view": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER", "INTERVIEWER"],

  // Application management
  "applications.move": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "applications.reject": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER"],
  "applications.view": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER", "INTERVIEWER"],

  // Interview management
  "interviews.schedule": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "interviews.feedback": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER", "INTERVIEWER"],
  "interviews.view": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER", "INTERVIEWER"],

  // Offer management
  "offers.create": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "offers.approve": ["SUPER_ADMIN", "ADMIN", "HIRING_MANAGER"],
  "offers.send": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER"],
  "offers.view": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER"],

  // Analytics
  "analytics.view": ["SUPER_ADMIN", "ADMIN", "RECRUITER", "SUB_RECRUITER", "HIRING_MANAGER"],
  "analytics.export": ["SUPER_ADMIN", "ADMIN"],

  // Settings & admin
  "settings.manage": ["SUPER_ADMIN", "ADMIN"],
  "settings.visibility": ["SUPER_ADMIN", "ADMIN", "RECRUITER"],
  "users.manage": ["SUPER_ADMIN", "ADMIN"],
  "integrations.manage": ["SUPER_ADMIN", "ADMIN"],
} as const;

export type Permission = keyof typeof PERMISSIONS;
