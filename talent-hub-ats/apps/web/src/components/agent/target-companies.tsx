"use client";

import { Check, Building2, ArrowRight } from "lucide-react";

export interface TargetCompany {
  id: string;
  name: string;
  why: string;
  size: string | null;
  confidence: "High" | "Medium" | "Low";
}

interface TargetCompaniesProps {
  companies: TargetCompany[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSourceSelected: () => void;
}

const confidenceStyles: Record<TargetCompany["confidence"], string> = {
  High: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  Medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  Low: "bg-muted text-muted-foreground",
};

export function TargetCompanies({ companies, selected, onToggle, onSourceSelected }: TargetCompaniesProps) {
  if (companies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No target companies identified. Try running again or select a different job.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        {selected.size > 0
          ? `${selected.size} of ${companies.length} selected`
          : `${companies.length} target companies identified. Select the ones you want to source from.`}
      </p>

      {companies.map((c) => {
        const isSelected = selected.has(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={[
              "w-full text-left rounded-lg border px-4 py-3 transition-colors",
              isSelected
                ? "bg-primary/5 border-primary/40"
                : "bg-card hover:bg-muted/40",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                ].join(" ")}
              >
                {isSelected ? <Check className="h-3 w-3" /> : null}
              </span>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${confidenceStyles[c.confidence]}`}>
                    {c.confidence}
                  </span>
                  {c.size && (
                    <span className="text-[10px] text-muted-foreground ml-auto">{c.size}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{c.why}</p>
              </div>
            </div>
          </button>
        );
      })}

      {selected.size > 0 && (
        <button
          onClick={onSourceSelected}
          className="mt-2 w-full flex items-center justify-center gap-2 text-xs px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors"
        >
          <Building2 className="h-3.5 w-3.5" />
          Source from {selected.size} selected {selected.size === 1 ? "company" : "companies"}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}

      <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
        <Building2 className="h-3 w-3" />
        Companies identified by Claude AI based on job requirements. No external search.
      </p>
    </div>
  );
}
