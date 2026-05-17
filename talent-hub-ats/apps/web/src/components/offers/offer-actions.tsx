"use client";

import { useState } from "react";
import { Loader2, Send, Check, X, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiUrl } from "@/lib/api";

interface OfferActionsProps {
  offerId: string;
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
}

const STATUS_ACTIONS: Record<string, { label: string; status: string; variant: "default" | "destructive"; icon: typeof Send }[]> = {
  DRAFT: [{ label: "Submit for Approval", status: "PENDING_APPROVAL", variant: "default", icon: Send }],
  PENDING_APPROVAL: [{ label: "Approve", status: "APPROVED", variant: "default", icon: ThumbsUp }, { label: "Reject", status: "VOIDED", variant: "destructive", icon: ThumbsDown }],
  APPROVED: [{ label: "Send to Candidate", status: "SENT", variant: "default", icon: Send }],
  SENT: [{ label: "Mark Accepted", status: "ACCEPTED", variant: "default", icon: Check }, { label: "Mark Declined", status: "DECLINED", variant: "destructive", icon: X }],
};

export function OfferActions({ offerId, currentStatus, onStatusChange }: OfferActionsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const actions = STATUS_ACTIONS[currentStatus] ?? [];

  const handleAction = async (status: string) => {
    setLoading(status);
    try {
      const res = await fetch(getApiUrl(`/api/offers/${offerId}/status`), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error("Failed");
      onStatusChange(status);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button key={action.status} onClick={() => handleAction(action.status)} disabled={loading !== null} className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50", action.variant === "destructive" ? "bg-destructive/10 text-destructive hover:bg-destructive/20" : "bg-primary/10 text-primary hover:bg-primary/20")}>
            {loading === action.status ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
