"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { SendEmailModal } from "@/components/candidates/send-email-modal";

export function InterviewSendInvite({
  candidateId,
  candidateEmail,
  candidateName,
  meetingLink,
  interviewTitle,
}: {
  candidateId: string;
  candidateEmail: string;
  candidateName: string;
  meetingLink: string | null;
  interviewTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
      >
        <Mail className="w-4 h-4" />
        Send invite email
      </button>
      {open && (
        <SendEmailModal
          candidateId={candidateId}
          candidateEmail={candidateEmail}
          candidateName={candidateName}
          onClose={() => setOpen(false)}
          initialBody={meetingLink ? `Hi ${candidateName},\n\nYou’re invited to an interview: ${interviewTitle}.\n\nJoin here: ${meetingLink}\n\nBest regards` : undefined}
          initialSubject={meetingLink ? `Interview: ${interviewTitle}` : undefined}
        />
      )}
    </>
  );
}
