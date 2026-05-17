"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Check } from "lucide-react";

export interface DraftEmail {
  candidateId: string;
  candidateName: string;
  to: string;
  subject: string;
  body: string;
}

interface EmailPreviewProps {
  emails: DraftEmail[];
  onChange: (updated: DraftEmail[]) => void;
}

export function EmailPreview({ emails, onChange }: EmailPreviewProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set([emails[0]?.candidateId]));
  const [editing, setEditing] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function updateEmail(id: string, field: keyof DraftEmail, value: string) {
    onChange(
      emails.map((e) => (e.candidateId === id ? { ...e, [field]: value } : e))
    );
  }

  if (emails.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Approve the candidate shortlist first to generate email drafts.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">
        Review and edit each email before sending. Click the pencil to edit inline.
      </p>
      {emails.map((email) => {
        const isOpen = expanded.has(email.candidateId);
        const isEditing = editing === email.candidateId;

        return (
          <div key={email.candidateId} className="rounded-lg border overflow-hidden">
            <button
              onClick={() => toggleExpand(email.candidateId)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div>
                <span className="font-medium text-sm">{email.candidateName}</span>
                <span className="text-xs text-muted-foreground ml-2">{email.to}</span>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="border-t px-4 py-3 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-medium">Subject:</span>
                      {isEditing ? (
                        <input
                          className="flex-1 rounded border bg-background px-2 py-0.5 text-sm font-medium text-foreground"
                          value={email.subject}
                          onChange={(e) =>
                            updateEmail(email.candidateId, "subject", e.target.value)
                          }
                        />
                      ) : (
                        <span className="text-foreground font-medium text-sm">{email.subject}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setEditing(isEditing ? null : email.candidateId)}
                    className="ml-3 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title={isEditing ? "Done editing" : "Edit email"}
                  >
                    {isEditing ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                </div>

                {isEditing ? (
                  <textarea
                    className="w-full rounded border bg-background px-3 py-2 text-sm leading-relaxed text-foreground resize-y min-h-[140px]"
                    value={email.body}
                    onChange={(e) => updateEmail(email.candidateId, "body", e.target.value)}
                  />
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {email.body}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
