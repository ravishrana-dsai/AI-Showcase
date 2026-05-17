import type {
  Court,
  PipelineStage,
  Request,
  RequestStageLog,
  SlaAlert,
  User,
  CourtStatus,
  RequestStatus,
  StageLogStatus,
  AlertType,
  UserRole,
} from "@prisma/client";

// Re-export prisma types
export type {
  Court,
  PipelineStage,
  Request,
  RequestStageLog,
  SlaAlert,
  User,
  CourtStatus,
  RequestStatus,
  StageLogStatus,
  AlertType,
  UserRole,
};

// ─── Extended / Composed Types ────────────────────────────────────────────────

export type RequestWithRelations = Request & {
  court: Court;
  stageLogs: (RequestStageLog & { stage: PipelineStage })[];
  slaAlerts: (SlaAlert & { stage: PipelineStage })[];
  currentStage?: PipelineStage | null;
};

export type CourtWithStats = Court & {
  _count: {
    requests: number;
  };
  stats?: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    slaBreached: number;
    avgCompletionMinutes: number | null;
  };
};

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export interface DashboardStats {
  totalCourts: number;
  activeCourts: number;
  totalRequests: number;
  requestsToday: number;
  requestsThisWeek: number;
  pendingRequests: number;
  inProgressRequests: number;
  completedRequests: number;
  failedRequests: number;
  slaBreachedRequests: number;
  unacknowledgedAlerts: number;
  avgCompletionTimeMin: number | null;
  byStage: { stageName: string; displayName: string; count: number; color: string | null }[];
  completionTrend: { date: string; completed: number; failed: number }[];
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface RequestFilters {
  courtId?: string;
  status?: RequestStatus;
  stageId?: string;
  slaBreached?: boolean;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface CourtFilters {
  status?: CourtStatus;
  city?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// ─── Webhook Payload Types ────────────────────────────────────────────────────

export interface WebhookStageEvent {
  externalRequestId: string;
  externalCourtId: string;
  stageName: string;
  stageStatus: "started" | "completed" | "failed";
  timestamp: string;
  metadata?: Record<string, unknown>;
  errorMessage?: string;
}

export interface WebhookNewRequestEvent {
  externalRequestId: string;
  externalCourtId: string;
  playerId?: string;
  playerName?: string;
  matchDate?: string;
  videoUrl?: string;
  videoDuration?: number;
  videoSizeBytes?: number;
  videoMetadata?: Record<string, unknown>;
  timestamp: string;
}

// ─── Session Extension ────────────────────────────────────────────────────────

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      isActive: boolean;
    };
  }
}
