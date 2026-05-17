"use client";

import { useState, useEffect, useRef } from "react";
import { Tag, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/api";

interface TagObj {
  id: string;
  name: string;
  color: string | null;
}

interface Props {
  candidateId: string;
  initialTags: TagObj[];
}

export function CandidateTags({ candidateId, initialTags }: Props) {
  const [tags, setTags] = useState<TagObj[]>(initialTags);
  const [allTags, setAllTags] = useState<TagObj[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showPicker && allTags.length === 0) {
      fetch(getApiUrl("/api/tags"))
        .then((r) => r.json())
        .then(setAllTags)
        .catch(() => {});
    }
  }, [showPicker, allTags.length]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function addTag(tag: TagObj) {
    if (tags.some((t) => t.id === tag.id)) return;
    setAdding(true);
    try {
      const res = await fetch(getApiUrl(`/api/candidates/${candidateId}/tags`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId: tag.id }),
      });
      if (!res.ok) throw new Error("Failed");
      setTags((prev) => [...prev, tag]);
    } catch {
      toast.error("Failed to add tag");
    } finally {
      setAdding(false);
      setShowPicker(false);
      setSearch("");
    }
  }

  async function createAndAddTag(name: string) {
    setAdding(true);
    try {
      const res = await fetch(getApiUrl(`/api/candidates/${candidateId}/tags`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const newTag: TagObj = await res.json();
      if (!res.ok) throw new Error("Failed");
      setTags((prev) => [...prev, newTag]);
      setAllTags((prev) =>
        prev.some((t) => t.id === newTag.id) ? prev : [...prev, newTag]
      );
    } catch {
      toast.error("Failed to create tag");
    } finally {
      setAdding(false);
      setShowPicker(false);
      setSearch("");
    }
  }

  async function removeTag(tagId: string) {
    try {
      const res = await fetch(
        getApiUrl(`/api/candidates/${candidateId}/tags?tagId=${tagId}`),
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed");
      setTags((prev) => prev.filter((t) => t.id !== tagId));
    } catch {
      toast.error("Failed to remove tag");
    }
  }

  const filtered = allTags.filter(
    (t) =>
      !tags.some((existing) => existing.id === t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase())
  );

  const canCreate =
    search.trim().length > 0 &&
    !allTags.some((t) => t.name.toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              backgroundColor: `${tag.color ?? "#6B7280"}20`,
              color: tag.color ?? "#6B7280",
            }}
          >
            {tag.name}
            <button
              onClick={() => removeTag(tag.id)}
              className="rounded-full hover:opacity-70 transition-opacity"
              aria-label={`Remove ${tag.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add tag
        </button>
      </div>

      {showPicker && (
        <div className="absolute top-full mt-1 left-0 z-20 w-56 rounded-lg border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or create tag…"
              className="w-full rounded-md bg-muted/50 px-2 py-1.5 text-sm focus-visible:outline-none"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map((tag) => (
              <button
                key={tag.id}
                onClick={() => addTag(tag)}
                disabled={adding}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color ?? "#6B7280" }}
                />
                {tag.name}
              </button>
            ))}
            {canCreate && (
              <button
                onClick={() => createAndAddTag(search.trim())}
                disabled={adding}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-primary"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                Create &ldquo;{search.trim()}&rdquo;
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No tags found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
