export interface DimensionScore {
  score: number;
  notes: string;
}

export interface Scorecard {
  overall_score: number;
  recommendation: "strong_pass" | "pass" | "hold" | "reject";
  dimensions: {
    communication: DimensionScore;
    role_fit: DimensionScore;
    motivation: DimensionScore;
    culture_fit: DimensionScore;
    problem_solving: DimensionScore;
  };
  strengths: string[];
  concerns: string[];
  suggested_followup_questions: string[];
  summary: string;
}

export interface TranscriptEntry {
  role: "candidate" | "aria";
  content: string;
}

export interface InterviewWithRelations {
  id: string;
  token: string;
  status: string;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationSecs: number | null;
  transcript: TranscriptEntry[] | null;
  scorecard: Scorecard | null;
  dailyRoomUrl: string | null;
  notes: string | null;
  createdAt: Date;
  candidate: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  };
  role: {
    id: string;
    name: string;
    slug: string;
  };
}
