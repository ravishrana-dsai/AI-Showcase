"use client";

import { useState } from "react";
import { Eye, Pencil, Check, Loader2, Plus, X } from "lucide-react";
import { getApiUrl } from "@/lib/api";

const CULTURAL_VALUES = [
  "Data Oriented",
  "Ownership",
  "Perseverance",
  "User First",
  "Transparency",
];

const RATING_BUTTONS = [
  { value: 1, label: "Strong No Hire", short: "1" },
  { value: 2, label: "No Hire", short: "2" },
  { value: 3, label: "Hire", short: "3" },
  { value: 4, label: "Strong Hire", short: "4" },
  { value: "NA", label: "N/A", short: "NA" },
] as const;

function PreviewRatingRow({ criterion }: { criterion: string }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="text-sm font-medium w-full sm:w-48 shrink-0 text-foreground">
        {criterion}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {RATING_BUTTONS.map((btn) => (
          <span
            key={String(btn.value)}
            title={btn.label}
            className="px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-background text-muted-foreground select-none"
          >
            {btn.short}
          </span>
        ))}
      </div>
    </div>
  );
}

function PreviewSection({
  title,
  criteria,
}: {
  title: string;
  criteria: string[];
}) {
  if (criteria.length === 0) return null;
  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
        <span className="flex gap-3 text-[10px] text-muted-foreground">
          <span>1 Strong No</span>
          <span>2 No Hire</span>
          <span>3 Hire</span>
          <span>4 Strong Yes</span>
        </span>
      </div>
      <div className="space-y-2">
        {criteria.map((c) => (
          <PreviewRatingRow key={c} criterion={c} />
        ))}
      </div>
    </div>
  );
}

function CriteriaEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setInput("");
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="e.g. System Design, Communication..."
          className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-muted text-sm font-medium hover:bg-muted/80 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((criterion, i) => (
            <li
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
            >
              {criterion}
              <button
                type="button"
                onClick={() =>
                  onChange(value.filter((_, j) => j !== i))
                }
                className="text-primary/60 hover:text-primary"
                aria-label={`Remove ${criterion}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FeedbackPreviewEditor({
  jobId,
  initialCriteria,
}: {
  jobId: string;
  initialCriteria: string[];
}) {
  const [criteria, setCriteria] = useState<string[]>(initialCriteria);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(initialCriteria);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEdit() {
    setDraft(criteria);
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError(null);
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(getApiUrl(`/api/jobs/${jobId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scoringCriteria: JSON.stringify(draft) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to save criteria");
      }
      setCriteria(draft);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const technicalCriteria = editing ? draft : criteria;

  return (
    <div className="bg-card rounded-xl border p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Feedback Form Preview
          </h2>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit criteria
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save
            </button>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-medium text-primary">
            Technical scoring criteria (job-specific)
          </p>
          <CriteriaEditor value={draft} onChange={setDraft} />
          {saveError && (
            <p className="text-xs text-destructive mt-1">{saveError}</p>
          )}
        </div>
      )}

      {/* Sections to rate checkboxes preview */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Sections to rate
        </p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm cursor-default select-none">
            <input type="checkbox" defaultChecked readOnly className="pointer-events-none" />
            Technical
          </label>
          <label className="flex items-center gap-2 text-sm cursor-default select-none">
            <input type="checkbox" defaultChecked readOnly className="pointer-events-none" />
            Cultural
          </label>
        </div>
      </div>

      {/* Technical section preview */}
      {technicalCriteria.length > 0 ? (
        <PreviewSection title="Technical" criteria={technicalCriteria} />
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No technical criteria set. Add criteria above to show them in the feedback form.
        </div>
      )}

      {/* Cultural section preview (always shown) */}
      <PreviewSection title="Cultural" criteria={CULTURAL_VALUES} />

      {/* Recommendation + notes preview */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Recommendation
          </label>
          <select
            disabled
            className="w-full px-3 py-2 rounded-lg border bg-muted text-sm text-muted-foreground cursor-default"
          >
            <option>Select...</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Notes (optional)
          </label>
          <div className="w-full min-h-[72px] px-3 py-2 rounded-lg border bg-muted text-sm text-muted-foreground italic">
            Add any comments for the hiring team...
          </div>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        This is how interviewers will see the feedback form for this job. The average score across rated criteria is computed automatically on submission.
      </p>
    </div>
  );
}
