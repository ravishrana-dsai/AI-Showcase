"use client";

import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface AddNoteProps {
  candidateId: string;
  onNoteAdded: (note: { id: string; content: string; isPrivate: boolean; createdAt: string; author: { name: string | null; avatar: string | null } }) => void;
}

export function AddNote({ candidateId, onNoteAdded }: AddNoteProps) {
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(getApiUrl("/api/notes"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId, content: content.trim(), isPrivate }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add note");
      onNoteAdded({ id: data.id, content: data.content, isPrivate: data.isPrivate, createdAt: data.createdAt, author: { name: data.author?.name ?? null, avatar: data.author?.avatar ?? null } });
      setContent("");
      setIsPrivate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="p-2 rounded-lg bg-destructive/10 text-destructive text-xs">{error}</div>}
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Add a note..." rows={3} disabled={loading} className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50" />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} disabled={loading} className="rounded border-input" />
          <Lock className="w-3.5 h-3.5" />
          Private note
        </label>
        <button type="submit" disabled={loading || !content.trim()} className={cn("px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1.5")}>
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Adding...</> : "Add Note"}
        </button>
      </div>
    </form>
  );
}
