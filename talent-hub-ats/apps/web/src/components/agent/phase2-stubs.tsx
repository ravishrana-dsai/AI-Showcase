"use client";

import { Mail, RefreshCw, CalendarClock } from "lucide-react";

interface StubCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  eta: string;
}

const STUBS: StubCard[] = [
  {
    icon: <Mail className="h-5 w-5" />,
    title: "Email Inbox",
    description: "Read candidate replies from your connected inbox. Automatically update application status and surface hot leads.",
    eta: "Phase 2",
  },
  {
    icon: <RefreshCw className="h-5 w-5" />,
    title: "Autonomous Pipeline",
    description: "Move candidates through pipeline stages based on recruiter-defined rules and AI confidence scores.",
    eta: "Phase 3",
  },
  {
    icon: <CalendarClock className="h-5 w-5" />,
    title: "Daily Digest",
    description: "Get a morning briefing of pipeline updates, pending actions, and AI-recommended next steps across all open roles.",
    eta: "Phase 3",
  },
];

export function Phase2Stubs() {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
        Coming next
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {STUBS.map((stub) => (
          <div
            key={stub.title}
            className="rounded-xl border border-dashed bg-muted/20 px-4 py-4 opacity-70"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-muted-foreground">{stub.icon}</span>
              <span className="text-sm font-medium">{stub.title}</span>
              <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {stub.eta}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {stub.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
