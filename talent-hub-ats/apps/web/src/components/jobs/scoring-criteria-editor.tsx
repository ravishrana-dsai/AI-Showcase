"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

export function ScoringCriteriaEditor({
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

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="flex-1 px-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="e.g. System Design, Communication..."
        />
        <button
          type="button"
          onClick={add}
          disabled={!input.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-muted text-sm font-medium hover:bg-muted/80 disabled:opacity-40"
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
                onClick={() => remove(i)}
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
