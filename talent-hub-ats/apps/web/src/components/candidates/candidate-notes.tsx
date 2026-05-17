"use client";

import { useState } from "react";
import { getInitials, formatRelativeTime } from "@/lib/utils";
import { AddNote } from "./add-note";

export interface NoteItem {
  id: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  author: { name: string | null; avatar: string | null };
}

interface CandidateNotesProps {
  candidateId: string;
  initialNotes: NoteItem[];
}

export function CandidateNotes({ candidateId, initialNotes }: CandidateNotesProps) {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div className="bg-card rounded-xl border">
      <div className="p-5 border-b">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Notes</h2>
      </div>
      <div className="p-5 space-y-4">
        <AddNote candidateId={candidateId} onNoteAdded={(note) => setNotes((prev) => [note, ...prev])} />
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground pt-2">No notes yet.</p>
        ) : (
          <div className="divide-y pt-2">
            {notes.map((note) => (
              <div key={note.id} className="py-4 first:pt-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">{getInitials(note.author.name)}</div>
                  <span className="text-sm font-medium">{note.author.name ?? "Unknown"}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(note.createdAt)}</span>
                  {note.isPrivate && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">Private</span>}
                </div>
                <p className="text-sm leading-relaxed pl-8">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
