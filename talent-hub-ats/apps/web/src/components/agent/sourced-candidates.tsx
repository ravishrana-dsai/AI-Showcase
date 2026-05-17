"use client";

import { Linkedin, UserPlus, Check, ExternalLink } from "lucide-react";

export interface SourcedCandidate {
  /** Unique key for this result — derived from LinkedIn URL slug */
  id: string;
  name: string;
  linkedinUrl: string;
  title: string | null;
  company: string | null;
  summary: string | null;
  /** Set after successful import to ATS */
  imported?: boolean;
}

interface SourcedCandidatesProps {
  candidates: SourcedCandidate[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function SourcedCandidates({ candidates, selected, onToggle }: SourcedCandidatesProps) {
  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No LinkedIn profiles found. Try adjusting the job requirements or location.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {selected.size > 0
          ? `${selected.size} of ${candidates.length} selected for import`
          : `${candidates.length} profile(s) found. Select the ones you want to import.`}
      </p>
      {candidates.map((c) => {
        const isSelected = selected.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => !c.imported && onToggle(c.id)}
            disabled={c.imported}
            className={[
              "w-full text-left rounded-lg border px-4 py-3 transition-colors",
              c.imported
                ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 cursor-default"
                : isSelected
                ? "bg-primary/5 border-primary/40"
                : "bg-card hover:bg-muted/40",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              {/* Selection indicator */}
              <span
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                  c.imported
                    ? "bg-green-500 border-green-500 text-white"
                    : isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                ].join(" ")}
              >
                {c.imported ? <Check className="h-3 w-3" /> : isSelected ? <Check className="h-3 w-3" /> : null}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.imported && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 font-medium">
                      Imported
                    </span>
                  )}
                  <a
                    href={c.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
                {(c.title || c.company) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {[c.title, c.company].filter(Boolean).join(" at ")}
                  </p>
                )}
                {c.summary && (
                  <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 leading-relaxed">
                    {c.summary}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}

      {candidates.length > 0 && (
        <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
          <Linkedin className="h-3 w-3" />
          Sourced via Exa LinkedIn Search. Review profiles before importing.
          <span className="ml-auto flex items-center gap-1">
            <UserPlus className="h-3 w-3" />
            Import adds to ATS without a resume.
          </span>
        </p>
      )}
    </div>
  );
}
