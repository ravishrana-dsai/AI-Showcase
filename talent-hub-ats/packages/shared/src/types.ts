// ===========================================
// Shared TypeScript types
// ===========================================

export type UserRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "RECRUITER"
  | "SUB_RECRUITER"
  | "HIRING_MANAGER"
  | "INTERVIEWER"
  | "LIMITED";

export type JobStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "OPEN"
  | "CLOSED"
  | "ON_HOLD"
  | "ARCHIVED";

export type ApplicationStatus =
  | "ACTIVE"
  | "REJECTED"
  | "WITHDRAWN"
  | "HIRED"
  | "ARCHIVED";

export type OfferStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "SENT"
  | "ACCEPTED"
  | "DECLINED"
  | "VOIDED"
  | "EXPIRED";

export type InterviewStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type ScorecardRating =
  | "STRONG_NO"
  | "NO"
  | "NEUTRAL"
  | "YES"
  | "STRONG_YES";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Session user type (what's available in auth context)
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  organizationId: string;
  avatar: string | null;
}
