"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

export default function JobDescriptionTemplatePage() {
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(getApiUrl("/api/settings/job-description-template"))
      .then((r) => r.json())
      .then((d) => setTemplate(d.template ?? ""))
      .catch(() => setError("Failed to load template"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/job-description-template"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
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
      <div className="max-w-3xl mx-auto space-y-6">
        <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Back to Settings
        </Link>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/settings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Job Description Template</h1>
        <p className="text-muted-foreground mt-1">
          This text will be used to prefill the job description when creating a new job. You can use plain text or HTML (e.g. &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;).
        </p>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}
        {saved && (
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm">
            Template saved.
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1.5">Template content</label>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={14}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder="e.g. <h2>About the role</h2><p>...</p>"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save template
        </button>
      </form>
    </div>
  );
}
