"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

type Props = {
  initial: {
    name: string;
    slug: string;
    website: string;
    industry: string;
    size: string;
  };
};

export function OrganizationForm({ initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [website, setWebsite] = useState(initial.website);
  const [industry, setIndustry] = useState(initial.industry);
  const [size, setSize] = useState(initial.size);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const nameChanged = name.trim() !== initial.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch(getApiUrl("/api/settings/organization"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || null,
          industry: industry.trim() || null,
          size: size.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      // Update slug display with server response
      if (data.slug) {
        setSlug(data.slug);
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-card rounded-xl border p-5 space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 text-sm">
          Organization updated.
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1.5">Organization name *</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Acme Inc."
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">URL slug</label>
        <input
          type="text"
          value={slug}
          disabled
          className="w-full px-3 py-2 rounded-lg border bg-muted text-sm text-muted-foreground cursor-not-allowed"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {nameChanged
            ? "Slug will be auto-regenerated when you save the new name."
            : "Auto-generated from organization name. Changes when you rename the organization."}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Website</label>
        <input
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="https://example.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Industry</label>
        <input
          type="text"
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. Technology, Sports"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Company size</label>
        <input
          type="text"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. 1-10, 11-50, 51-200"
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel
        </Link>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save changes
        </button>
      </div>
    </form>
  );
}
