"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, GripVertical, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface CandidateQuestion {
  id?: string;
  question: string;
  type: string;
  options: string[] | null;
  isRequired: boolean;
  order: number;
  showToCandidate: true;
}

const QUESTION_TYPES = [
  { value: "TEXT", label: "Short Text" },
  { value: "TEXTAREA", label: "Long Text" },
  { value: "YES_NO", label: "Yes / No" },
  { value: "SINGLE_SELECT", label: "Single Select" },
  { value: "MULTI_SELECT", label: "Multi Select" },
  { value: "NUMBER", label: "Number" },
];

export function CandidateQuestionsEditor({ jobId }: { jobId: string }) {
  const [questions, setQuestions] = useState<CandidateQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(getApiUrl(`/api/jobs/${jobId}/screening-questions?showToCandidate=true`))
      .then((r) => r.json())
      .then((d) => {
        const qs = (d.questions ?? []).map((q: Record<string, unknown>) => ({
          ...q,
          options: q.options ? JSON.parse(q.options as string) : null,
          showToCandidate: true as const,
        }));
        setQuestions(qs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { question: "", type: "TEXT", options: null, isRequired: false, order: prev.length, showToCandidate: true },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<CandidateQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...updates } : q)));
  };

  const removeQuestion = async (index: number) => {
    const q = questions[index];
    if (q.id) {
      await fetch(getApiUrl(`/api/jobs/${jobId}/screening-questions?questionId=${q.id}`), { method: "DELETE" });
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index).map((q, i) => ({ ...q, order: i })));
  };

  const saveAll = async () => {
    setSaving(true);
    setError(null);
    try {
      const existingQs = questions.filter((q) => q.id);
      const newQs = questions.filter((q) => !q.id);

      if (existingQs.length > 0) {
        const putRes = await fetch(getApiUrl(`/api/jobs/${jobId}/screening-questions`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions: existingQs }),
        });
        if (!putRes.ok) {
          const d = await putRes.json().catch(() => ({}));
          throw new Error(d.error ?? `PUT failed: ${putRes.status}`);
        }
      }

      for (const q of newQs) {
        const res = await fetch(getApiUrl(`/api/jobs/${jobId}/screening-questions`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...q, showToCandidate: true }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `POST failed: ${res.status}`);
        if (data.question) {
          setQuestions((prev) =>
            prev.map((pq) => (pq === q ? { ...pq, id: data.question.id } : pq))
          );
        }
      }
      toast.success("Questions saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-sm text-muted-foreground">Loading questions...</div>;

  return (
    <div className="bg-card rounded-xl border">
      <div className="p-5 border-b flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Application Questions
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Candidates will answer these when applying
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={addQuestion}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />Add Question
          </button>
          <button
            onClick={saveAll}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            )}
          >
            {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</> : "Save All"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      <div className="p-5 space-y-4">
        {questions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No application questions yet. Add questions candidates must answer when applying.
          </p>
        ) : (
          questions.map((q, idx) => (
            <div key={q.id || idx} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-muted-foreground mt-2.5 shrink-0 cursor-grab" />
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    value={q.question}
                    onChange={(e) => updateQuestion(idx, { question: e.target.value })}
                    placeholder="Enter your question..."
                    className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={q.type}
                      onChange={(e) =>
                        updateQuestion(idx, {
                          type: e.target.value,
                          options: ["SINGLE_SELECT", "MULTI_SELECT"].includes(e.target.value) ? ["Option 1"] : null,
                        })
                      }
                      className="px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {QUESTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={q.isRequired}
                        onChange={(e) => updateQuestion(idx, { isRequired: e.target.checked })}
                        className="rounded"
                      />
                      Required
                    </label>
                  </div>

                  {["SINGLE_SELECT", "MULTI_SELECT"].includes(q.type) && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Options</p>
                      {(q.options || []).map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...(q.options || [])];
                              newOpts[optIdx] = e.target.value;
                              updateQuestion(idx, { options: newOpts });
                            }}
                            className="flex-1 px-2 py-1 rounded border bg-background text-sm"
                          />
                          <button
                            onClick={() => updateQuestion(idx, { options: (q.options || []).filter((_, i) => i !== optIdx) })}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          updateQuestion(idx, {
                            options: [...(q.options || []), `Option ${(q.options?.length || 0) + 1}`],
                          })
                        }
                        className="text-xs text-primary hover:underline"
                      >
                        + Add option
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeQuestion(idx)}
                  className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
