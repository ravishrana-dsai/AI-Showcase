import { z } from "zod";

// ===========================================
// Zod validation schemas
// ===========================================

// Auth
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  organizationName: z.string().min(2, "Organization name is required").optional(),
});

// Jobs
export const createJobSchema = z.object({
  title: z.string().min(2, "Job title is required"),
  description: z.string().min(10, "Description is required"),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  employmentType: z.enum([
    "FULL_TIME",
    "PART_TIME",
    "CONTRACT",
    "INTERNSHIP",
    "TEMPORARY",
    "FREELANCE",
  ]),
  experienceLevel: z
    .enum(["ENTRY", "MID", "SENIOR", "LEAD", "EXECUTIVE"])
    .optional(),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  hiringManagerId: z.string().optional(),
  requisitionId: z.string().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  salaryCurrency: z.string().default("INR"),
  showSalary: z.boolean().default(false),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

export const updateJobSchema = createJobSchema.partial();

// Candidates
export const createCandidateSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
  portfolioUrl: z.string().url().optional().or(z.literal("")),
  currentCompany: z.string().optional(),
  currentTitle: z.string().optional(),
  location: z.string().optional(),
  summary: z.string().optional(),
  source: z.string().optional(),
  sourceDetail: z.string().optional(),
});

export const updateCandidateSchema = createCandidateSchema.partial();

// Applications
export const createApplicationSchema = z.object({
  candidateId: z.string(),
  jobId: z.string(),
  source: z.string().optional(),
  referredBy: z.string().optional(),
  screeningAnswers: z.array(z.unknown()).default([]),
});

export const moveApplicationSchema = z.object({
  applicationId: z.string(),
  targetStageId: z.string(),
});

// Interviews
export const scheduleInterviewSchema = z.object({
  applicationId: z.string(),
  title: z.string().min(1, "Interview title is required"),
  type: z.enum(["PHONE", "VIDEO", "IN_PERSON", "TAKE_HOME"]),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  timezone: z.string().default("UTC"),
  meetingLink: z.string().url().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  panelistIds: z.array(z.string()).min(1, "At least one interviewer is required"),
});

// Scorecards
export const submitScorecardSchema = z.object({
  applicationId: z.string(),
  interviewId: z.string().optional(),
  overallRating: z.enum(["STRONG_NO", "NO", "NEUTRAL", "YES", "STRONG_YES"]),
  recommendation: z
    .enum(["DEFINITELY_NOT", "NO", "MAYBE", "YES", "STRONG_YES"])
    .optional(),
  summary: z.string().optional(),
  ratings: z.array(
    z.object({
      criteriaName: z.string(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional(),
    })
  ),
});

// Offers
export const createOfferSchema = z.object({
  applicationId: z.string(),
  title: z.string().min(1, "Job title is required"),
  salary: z.number().positive("Salary must be positive"),
  salaryCurrency: z.string().default("INR"),
  salaryPeriod: z.enum(["ANNUAL", "MONTHLY", "HOURLY"]).default("ANNUAL"),
  equity: z.string().optional(),
  bonus: z.string().optional(),
  startDate: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  customFields: z.record(z.string(), z.unknown()).default({}),
});

// Requisitions
export const createRequisitionSchema = z.object({
  title: z.string().min(2, "Title is required"),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  headcount: z.number().int().positive().default(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  justification: z.string().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  salaryCurrency: z.string().default("INR"),
  employmentType: z
    .enum([
      "FULL_TIME",
      "PART_TIME",
      "CONTRACT",
      "INTERNSHIP",
      "TEMPORARY",
      "FREELANCE",
    ])
    .default("FULL_TIME"),
});

// Notes
export const createNoteSchema = z.object({
  candidateId: z.string(),
  content: z.string().min(1, "Note content is required"),
  isPrivate: z.boolean().default(false),
  mentions: z.array(z.string()).default([]),
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Type exports
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type UpdateJobInput = z.infer<typeof updateJobSchema>;
export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type MoveApplicationInput = z.infer<typeof moveApplicationSchema>;
export type ScheduleInterviewInput = z.infer<typeof scheduleInterviewSchema>;
export type SubmitScorecardInput = z.infer<typeof submitScorecardSchema>;
export type CreateOfferInput = z.infer<typeof createOfferSchema>;
export type CreateRequisitionInput = z.infer<typeof createRequisitionSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
