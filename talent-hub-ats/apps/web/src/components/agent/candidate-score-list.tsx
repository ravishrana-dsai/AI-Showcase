"use client";

import { MapPin, Mail, ExternalLink } from "lucide-react";
import { getApiUrl } from "@/lib/api";

export interface ScoredCandidate {
  id: string;
  name: string;
  score: number;
  title?: string;
  company?: string;
  rationale: string;
  email?: string;
  location?: string;
  tags?: string[];
  // profileId: the actual DB candidate id (different from the parsed index id)
  profileId?: string;
}

interface CandidateScoreListProps {
  candidates: ScoredCandidate[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
      : score >= 60
      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
      : "bg-muted text-muted-foreground";

  const width = `${score}%`;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded ${color}`}>
        {score}/100
      </span>
      <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 80
              ? "bg-green-500"
              : score >= 60
              ? "bg-yellow-500"
              : "bg-muted-foreground/40"
          }`}
          style={{ width }}
        />
      </div>
    </div>
  );
}

export function CandidateScoreList({ candidates, selected, onToggle }: CandidateScoreListProps) {
  const selectedCount = selected.size;

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No candidates scored yet. Run step 2 to generate matches.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">
          Select candidates for the outreach step. Top {candidates.length} ranked by AI.
        </p>
        {selectedCount > 0 && (
          <span className="text-xs font-medium text-primary">
            {selectedCount} selected
          </span>
        )}
      </div>

      {candidates.map((c) => (
        <label
          key={c.id}
          className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
            selected.has(c.id)
              ? "border-primary bg-primary/5"
              : "hover:border-border/80 hover:bg-muted/40"
          }`}
        >
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => onToggle(c.id)}
            className="mt-1 h-4 w-4 rounded border-border accent-primary shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{c.name}</span>
                {c.profileId && (
                  <a
                    href={getApiUrl(`/dashboard/candidates/${c.profileId}`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Open candidate profile"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <ScoreBadge score={c.score} />
            </div>

            {(c.title || c.company) && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {[c.title, c.company].filter(Boolean).join(" at ")}
              </p>
            )}

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {c.email && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 shrink-0" />
                  {c.email}
                </span>
              )}
              {c.location && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {c.location}
                </span>
              )}
            </div>

            {c.tags && c.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {c.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed italic">
              {c.rationale}
            </p>
          </div>
        </label>
      ))}
    </div>
  );
}
