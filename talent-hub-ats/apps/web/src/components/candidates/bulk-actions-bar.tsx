"use client";

import { useState } from "react";
import { X, Archive, Tag, Ban, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/api";

interface BulkActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onActionComplete: () => void;
}

export function BulkActionsBar({ selectedIds, onClear, onActionComplete }: BulkActionsBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  const handleArchive = async () => {
    setLoading("archive");
    try {
      await fetch(getApiUrl("/api/candidates/bulk"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds: selectedIds, action: "archive" }) });
      onActionComplete();
      onClear();
    } catch {} finally { setLoading(null); }
  };

  const handleReject = async () => {
    setLoading("reject");
    try {
      await fetch(getApiUrl("/api/candidates/bulk"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds: selectedIds, action: "archive" }) });
      onActionComplete();
      onClear();
    } catch {} finally { setLoading(null); }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-6 py-3 bg-card rounded-xl border shadow-lg">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <div className="flex items-center gap-2">
        <button onClick={handleArchive} disabled={loading !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
          {loading === "archive" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}Archive
        </button>
        <div className="relative">
          <button onClick={() => setShowTagInput(!showTagInput)} disabled={loading !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            <Tag className="w-4 h-4" />Add Tag
          </button>
          {showTagInput && (
            <div className="absolute bottom-full left-0 mb-2 p-2 bg-card border rounded-lg shadow flex gap-2">
              <input type="text" value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Tag name" className="px-2 py-1 rounded border text-sm w-32" />
              <button onClick={async () => { if (!tagName.trim()) return; setLoading("tag"); try { await fetch(getApiUrl("/api/candidates/bulk"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateIds: selectedIds, action: "archive" }) }); onActionComplete(); onClear(); } catch {} finally { setLoading(null); setShowTagInput(false); setTagName(""); } }} className="px-2 py-1 rounded bg-primary text-primary-foreground text-sm">Add</button>
            </div>
          )}
        </div>
        <button onClick={handleReject} disabled={loading !== null} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
          {loading === "reject" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}Reject
        </button>
      </div>
      <button onClick={onClear} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X className="w-4 h-4" /></button>
    </div>
  );
}
