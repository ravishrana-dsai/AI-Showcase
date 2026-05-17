"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Mail, ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { OFFER_STATUS_LABELS } from "@talent-hub/shared";

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "DRAFT", label: "Draft" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "APPROVED", label: "Approved" },
  { value: "SENT", label: "Sent" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
  { value: "VOIDED", label: "Voided" },
  { value: "EXPIRED", label: "Expired" },
];
import { OfferActions } from "./offer-actions";
import { SendEmailModal } from "@/components/candidates/send-email-modal";
import { format } from "date-fns";

type StageHistoryEntry = {
  id: string;
  stageId: string;
  enteredAt: string;
  exitedAt: string | null;
  stage: { name: string };
};

type Offer = {
  id: string;
  status: string;
  title: string;
  createdAt: string;
  application: {
    candidate: { id: string; firstName: string; lastName: string; email: string };
    job: { title: string };
    stageHistory: StageHistoryEntry[];
  };
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  PENDING_APPROVAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SENT: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ACCEPTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  DECLINED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  VOIDED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  EXPIRED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function PipelineHistory({ stageHistory }: { stageHistory: StageHistoryEntry[] }) {
  if (stageHistory.length === 0) {
    return <p className="text-xs text-muted-foreground">No stage history recorded.</p>;
  }

  const ordered = [...stageHistory].sort(
    (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime()
  );

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3">
      {ordered.map((sh, idx) => (
        <div key={sh.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-0.5">
            <span
              className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium",
                sh.exitedAt == null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {sh.stage.name}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(sh.enteredAt), "MMM d")}
            </span>
          </div>
          {idx < ordered.length - 1 && (
            <div className="w-6 h-px bg-border" />
          )}
        </div>
      ))}
    </div>
  );
}

export function OffersList({ offers }: { offers: Offer[] }) {
  const router = useRouter();
  const [emailOffer, setEmailOffer] = useState<Offer | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  function togglePipeline(offerId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(offerId)) {
        next.delete(offerId);
      } else {
        next.add(offerId);
      }
      return next;
    });
  }

  const filtered = offers.filter((o) => {
    const name = `${o.application.candidate.firstName} ${o.application.candidate.lastName}`.toLowerCase();
    const matchesSearch = !search || name.includes(search.toLowerCase()) || o.application.job.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search by candidate or job..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl border p-12 text-center">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium">{offers.length === 0 ? "No offers yet" : "No matching offers"}</h3>
          <p className="text-muted-foreground mt-1">
            {offers.length === 0
              ? "Offers are created from candidate profiles."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (

      <div className="bg-card rounded-xl border divide-y">
      {filtered.map((offer) => {
        const isExpanded = expandedIds.has(offer.id);
        return (
          <div key={offer.id} className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium shrink-0">
                  {offer.application.candidate.firstName[0]}{offer.application.candidate.lastName[0]}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {offer.application.candidate.firstName} {offer.application.candidate.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {offer.title} · {offer.application.job.title}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => togglePipeline(offer.id)}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Toggle pipeline history"
                >
                  {isExpanded ? (
                    <>Hide pipeline <ChevronUp className="w-3.5 h-3.5" /></>
                  ) : (
                    <>View pipeline <ChevronDown className="w-3.5 h-3.5" /></>
                  )}
                </button>
                <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium", STATUS_COLORS[offer.status] || "bg-gray-100")}>
                  {OFFER_STATUS_LABELS[offer.status] || offer.status}
                </span>
                <button
                  type="button"
                  onClick={() => setEmailOffer(offer)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Send email"
                >
                  <Mail className="w-4 h-4" />
                </button>
                <OfferActions offerId={offer.id} currentStatus={offer.status} onStatusChange={() => router.refresh()} />
              </div>
            </div>
            {isExpanded && (
              <div className="mt-3 border-t pt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Pipeline History</p>
                <PipelineHistory stageHistory={offer.application.stageHistory} />
              </div>
            )}
          </div>
        );
      })}
    </div>
      )}

      {emailOffer && (
        <SendEmailModal
          candidateId={emailOffer.application.candidate.id}
          candidateEmail={emailOffer.application.candidate.email}
          candidateName={`${emailOffer.application.candidate.firstName} ${emailOffer.application.candidate.lastName}`}
          onClose={() => setEmailOffer(null)}
        />
      )}
    </>
  );
}
