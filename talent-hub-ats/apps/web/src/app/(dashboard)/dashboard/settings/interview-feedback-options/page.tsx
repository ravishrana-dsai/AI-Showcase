"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

type Option = { value: string; label: string };

export default function InterviewFeedbackOptionsPage() {
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/settings/interview-feedback-options"))
      .then((r) => r.json())
      .then((d) => setOptions(Array.isArray(d.options) ? d.options : []))
      .catch(() => setError("Failed to load options"))
      .finally(() => setLoading(false));
  }, []);

  const addOption = () => {
    setOptions((prev) => [...prev, { value: "", label: "" }]);
  };

  const updateOption = (index: number, field: "value" | "label", value: string) => {
    setOptions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeOption = (index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = options
      .map((o) => ({ value: o.value.trim(), label: o.label.trim() }))
      .filter((o) => o.value && o.label);
    if (valid.length === 0) {
      setError("Add at least one option with both value and label.");
      return;
    }
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/interview-feedback-options"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ options: valid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setOptions(data.options ?? valid);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Interview Feedback Options</h1>
        <p className="text-muted-foreground mt-1">
          Options shown to interviewers when submitting feedback (e.g. &quot;Proceed to next stage&quot;, &quot;Reject&quot;). These appear in the feedback panel for panelists.
        </p>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        {saved && (
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm">
            Options saved.
          </div>
        )}
        <div className="bg-card rounded-xl border p-5 space-y-4">
          {options.map((opt, index) => (
            <div key={index} className="flex gap-2 items-center">
              <input
                type="text"
                value={opt.value}
                onChange={(e) => updateOption(index, "value", e.target.value)}
                placeholder="Value (e.g. PROCEED)"
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                type="text"
                value={opt.label}
                onChange={(e) => updateOption(index, "label", e.target.value)}
                placeholder="Label (e.g. Proceed to next stage)"
                className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => removeOption(index)}
                className="p-2 rounded-lg border text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Remove option"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="w-4 h-4" /> Add option
          </button>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save options
        </button>
      </form>
    </div>
  );
}
