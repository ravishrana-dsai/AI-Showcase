"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScorecardView } from "@/components/ScoreCard";
import type { InterviewWithRelations, Scorecard } from "@/lib/types";

interface Role {
  id: string;
  name: string;
  slug: string;
}

interface AdminDashboardProps {
  interviews: InterviewWithRelations[];
  roles: Role[];
}

type Column = "pending" | "in_progress" | "completed" | "reviewed";

const COLUMNS: { key: Column; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "reviewed", label: "Reviewed" },
];

const REC_META: Record<string, { label: string; color: string; bg: string }> = {
  strong_pass: { label: "STRONG PASS", color: "#22C55E", bg: "rgba(34,197,94,0.12)" },
  pass: { label: "PASS", color: "#00C2FF", bg: "rgba(0,194,255,0.12)" },
  hold: { label: "HOLD", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  reject: { label: "REJECT", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
};

function scoreColor(score: number): string {
  if (score >= 8) return "#22C55E";
  if (score >= 6) return "#F59E0B";
  return "#EF4444";
}

function formatDate(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminDashboard({ interviews, roles }: AdminDashboardProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [filterRole, setFilterRole] = useState("");
  const [filterRec, setFilterRec] = useState("");
  const router = useRouter();

  const filtered = interviews.filter((iv) => {
    if (filterRole && iv.role.slug !== filterRole) return false;
    if (filterRec) {
      const sc = iv.scorecard as Scorecard | null;
      if (sc?.recommendation !== filterRec) return false;
    }
    return true;
  });

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <header style={styles.topbar}>
        <div style={styles.brand}>
          <span style={styles.brandDot} />
          <span style={styles.brandName}>[Company]</span>
          <span style={styles.brandSep}>/</span>
          <span style={styles.brandPage}>Hiring Dashboard</span>
        </div>
        <div style={styles.topbarRight}>
          <button
            style={styles.secondaryBtn}
            onClick={() => {
              const params = new URLSearchParams();
              if (filterRole) params.set("role", filterRole);
              if (filterRec) params.set("recommendation", filterRec);
              window.location.href = `/api/admin/interviews/export?${params.toString()}`;
            }}
          >
            Export CSV
          </button>
          <button style={styles.secondaryBtn} onClick={() => router.push("/admin/roles")}>
            Manage Roles
          </button>
          <button style={styles.primaryBtn} onClick={() => setShowNewModal(true)}>
            + New Interview
          </button>
        </div>
      </header>

      {/* Filters */}
      <div style={styles.filterBar}>
        <select
          style={styles.select}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="">All Roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.slug}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          style={styles.select}
          value={filterRec}
          onChange={(e) => setFilterRec(e.target.value)}
        >
          <option value="">All Recommendations</option>
          <option value="strong_pass">Strong Pass</option>
          <option value="pass">Pass</option>
          <option value="hold">Hold</option>
          <option value="reject">Reject</option>
        </select>
        <span style={styles.count}>{filtered.length} interviews</span>
      </div>

      {/* Kanban columns */}
      <div style={styles.kanban}>
        {COLUMNS.map(({ key, label }) => {
          const col = filtered.filter((iv) => iv.status === key);
          return (
            <div key={key} style={styles.column}>
              <div style={styles.colHeader}>
                <span style={styles.colLabel}>{label}</span>
                <span style={styles.colCount}>{col.length}</span>
              </div>
              <div style={styles.colBody}>
                {col.map((iv) => (
                  <InterviewCard
                    key={iv.id}
                    interview={iv}
                    isExpanded={expandedId === iv.id}
                    onToggle={() =>
                      setExpandedId(expandedId === iv.id ? null : iv.id)
                    }
                  />
                ))}
                {col.length === 0 && (
                  <p style={styles.empty}>No interviews</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showNewModal && (
        <NewInterviewModal
          roles={roles}
          onClose={() => setShowNewModal(false)}
          onCreated={() => {
            setShowNewModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function InterviewCard({
  interview,
  isExpanded,
  onToggle,
}: {
  interview: InterviewWithRelations;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const scorecard = interview.scorecard as Scorecard | null;
  const rec = scorecard ? REC_META[scorecard.recommendation] : null;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader} onClick={onToggle} role="button" tabIndex={0}>
        <div style={styles.cardTop}>
          <span style={styles.candidateName}>{interview.candidate.name}</span>
          {rec && (
            <span
              style={{
                ...styles.recBadge,
                color: rec.color,
                background: rec.bg,
                border: `1px solid ${rec.color}40`,
              }}
            >
              {rec.label}
            </span>
          )}
        </div>
        <span style={styles.rolePill}>{interview.role.name}</span>
        <div style={styles.cardMeta}>
          <span style={styles.dateText}>{formatDate(interview.createdAt)}</span>
          {scorecard && (
            <span
              style={{
                ...styles.scoreText,
                color: scoreColor(scorecard.overall_score),
              }}
            >
              {scorecard.overall_score}/10
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div style={styles.cardExpanded}>
          <div style={styles.divider} />
          {scorecard ? (
            <ScorecardView scorecard={scorecard} />
          ) : (
            <p style={styles.noScorecard}>
              {interview.status === "completed"
                ? "Scorecard pending..."
                : "Interview not yet completed"}
            </p>
          )}
          {interview.transcript && (
            <TranscriptPreview
              transcript={interview.transcript as Array<{ role: string; content: string }>}
            />
          )}
          <InterviewActions interview={interview} />
        </div>
      )}
    </div>
  );
}

function TranscriptPreview({
  transcript,
}: {
  transcript: Array<{ role: string; content: string }>;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        style={styles.toggleBtn}
        onClick={() => setShow((s) => !s)}
      >
        {show ? "Hide" : "Show"} Transcript ({transcript.length} turns)
      </button>
      {show && (
        <div style={styles.transcript}>
          {transcript.map((entry, i) => (
            <div key={i} style={styles.transcriptEntry}>
              <span
                style={{
                  ...styles.transcriptRole,
                  color: entry.role === "candidate" ? "#00C2FF" : "#8B93A8",
                }}
              >
                {entry.role === "candidate" ? "You" : "Aria"}
              </span>
              <p style={styles.transcriptContent}>{entry.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InterviewActions({ interview }: { interview: InterviewWithRelations }) {
  const [notes, setNotes] = useState(interview.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rescoring, setRescoring] = useState(false);
  const [rescoreError, setRescoreError] = useState<string | null>(null);
  const router = useRouter();

  const appUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  const interviewLink = `${appUrl}/interview/${interview.token}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(interviewLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveNotes = async () => {
    setSaving(true);
    await fetch(`/api/interviews/${interview.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    setSaving(false);
    router.refresh();
  };

  const markReviewed = async () => {
    await fetch(`/api/interviews/${interview.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });
    router.refresh();
  };

  const rescore = async () => {
    setRescoring(true);
    setRescoreError(null);
    try {
      const res = await fetch(`/api/interviews/${interview.id}/rescore`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Rescore failed");
      }
      router.refresh();
    } catch (err) {
      setRescoreError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setRescoring(false);
    }
  };

  return (
    <div style={styles.actions}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <button style={styles.toggleBtn} onClick={copyLink}>
          {copied ? "Copied!" : "Copy Link"}
        </button>
        {interview.status === "completed" && (
          <button style={styles.toggleBtn} onClick={markReviewed}>
            Mark Reviewed
          </button>
        )}
        {interview.transcript && (
          <button
            style={{ ...styles.toggleBtn, opacity: rescoring ? 0.6 : 1 }}
            onClick={rescore}
            disabled={rescoring}
          >
            {rescoring ? "Scoring..." : "Re-score"}
          </button>
        )}
      </div>
      {rescoreError && <p style={{ fontSize: 12, color: "#EF4444" }}>{rescoreError}</p>}
      <div style={styles.notesWrap}>
        <textarea
          style={styles.notesInput}
          placeholder="Add reviewer notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        <button style={styles.saveBtn} onClick={saveNotes} disabled={saving}>
          {saving ? "Saving..." : "Save Notes"}
        </button>
      </div>
    </div>
  );
}

function NewInterviewModal({
  roles,
  onClose,
  onCreated,
}: {
  roles: Role[];
  onClose: () => void;
  onCreated: (link: string) => void;
}) {
  const [form, setForm] = useState({
    candidateName: "",
    candidateEmail: "",
    roleSlug: roles[0]?.slug ?? "",
  });
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/interviews/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: form.candidateName,
          candidateEmail: form.candidateEmail,
          roleSlug: form.roleSlug,
        }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        throw new Error(d.error ?? "Failed to create interview");
      }
      const data = (await res.json()) as { link: string };
      setGeneratedLink(data.link);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>New Interview</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        {!generatedLink ? (
          <form onSubmit={handleSubmit} style={styles.form}>
            <label style={styles.label}>
              Candidate Name
              <input
                style={styles.input}
                required
                value={form.candidateName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, candidateName: e.target.value }))
                }
                placeholder="Alex Johnson"
              />
            </label>
            <label style={styles.label}>
              Candidate Email
              <input
                style={styles.input}
                type="email"
                required
                value={form.candidateEmail}
                onChange={(e) =>
                  setForm((f) => ({ ...f, candidateEmail: e.target.value }))
                }
                placeholder="alex@example.com"
              />
            </label>
            <label style={styles.label}>
              Role
              <select
                style={styles.select}
                value={form.roleSlug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, roleSlug: e.target.value }))
                }
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {error && <p style={styles.errorText}>{error}</p>}
            <button type="submit" style={styles.primaryBtn} disabled={loading}>
              {loading ? "Creating..." : "Generate Interview Link"}
            </button>
          </form>
        ) : (
          <div style={styles.linkResult}>
            <p style={styles.linkLabel}>Share this link with the candidate:</p>
            <div style={styles.linkBox}>
              <span style={styles.linkText}>{generatedLink}</span>
            </div>
            <div style={styles.linkActions}>
              <button style={styles.primaryBtn} onClick={copyLink}>
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button style={styles.secondaryBtn} onClick={() => onCreated(generatedLink)}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0F1117",
    color: "#F0F4FF",
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 28px",
    borderBottom: "1px solid #2A2F3D",
    background: "#181C27",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#00C2FF",
    display: "inline-block",
  },
  brandName: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#8B93A8",
  },
  brandSep: { color: "#2A2F3D", margin: "0 4px" },
  brandPage: { fontSize: 14, color: "#F0F4FF", fontWeight: 500 },
  topbarRight: { display: "flex", gap: 10 },
  primaryBtn: {
    padding: "9px 18px",
    background: "#00C2FF",
    border: "none",
    borderRadius: 8,
    color: "#000",
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  secondaryBtn: {
    padding: "9px 18px",
    background: "transparent",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontWeight: 500,
    fontSize: 13,
    cursor: "pointer",
  },
  filterBar: {
    display: "flex",
    gap: 12,
    padding: "14px 28px",
    alignItems: "center",
    borderBottom: "1px solid #2A2F3D",
  },
  select: {
    padding: "8px 12px",
    background: "#181C27",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontSize: 13,
    cursor: "pointer",
  },
  count: {
    marginLeft: "auto",
    fontSize: 13,
    color: "#4A5168",
  },
  kanban: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    padding: "20px 28px",
    flex: 1,
    alignItems: "flex-start",
    overflowX: "auto",
  },
  column: {
    minWidth: 260,
    background: "#181C27",
    borderRadius: 12,
    border: "1px solid #2A2F3D",
    overflow: "hidden",
  },
  colHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 16px",
    borderBottom: "1px solid #2A2F3D",
  },
  colLabel: { fontSize: 13, fontWeight: 600, color: "#8B93A8", letterSpacing: "0.04em" },
  colCount: {
    fontSize: 12,
    fontWeight: 700,
    color: "#4A5168",
    background: "#1F2433",
    padding: "2px 8px",
    borderRadius: 20,
  },
  colBody: {
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    minHeight: 80,
  },
  empty: { fontSize: 12, color: "#4A5168", textAlign: "center", padding: "16px 0" },
  card: {
    background: "#1F2433",
    border: "1px solid #2A2F3D",
    borderRadius: 10,
    overflow: "hidden",
  },
  cardHeader: {
    padding: "12px 14px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  candidateName: { fontSize: 14, fontWeight: 600, color: "#F0F4FF" },
  recBadge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.08em",
    padding: "2px 7px",
    borderRadius: 5,
    whiteSpace: "nowrap" as const,
  },
  rolePill: {
    fontSize: 11,
    color: "#8B93A8",
    background: "#2A2F3D",
    borderRadius: 4,
    padding: "2px 7px",
    alignSelf: "flex-start",
  },
  cardMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: { fontSize: 11, color: "#4A5168" },
  scoreText: { fontSize: 14, fontWeight: 700, fontFamily: "monospace" },
  cardExpanded: { padding: "0 14px 14px" },
  divider: { height: 1, background: "#2A2F3D", margin: "12px 0" },
  noScorecard: { fontSize: 13, color: "#4A5168", fontStyle: "italic" },
  transcript: {
    marginTop: 12,
    maxHeight: 240,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "10px 12px",
    background: "#181C27",
    borderRadius: 8,
    border: "1px solid #2A2F3D",
  },
  transcriptEntry: { display: "flex", flexDirection: "column", gap: 2 },
  transcriptRole: { fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" },
  transcriptContent: { fontSize: 13, color: "#8B93A8", lineHeight: 1.5 },
  toggleBtn: {
    padding: "6px 12px",
    background: "transparent",
    border: "1px solid #2A2F3D",
    borderRadius: 6,
    color: "#8B93A8",
    fontSize: 12,
    cursor: "pointer",
    marginRight: 8,
  },
  actions: { display: "flex", flexDirection: "column", gap: 10, marginTop: 14 },
  notesWrap: { display: "flex", flexDirection: "column", gap: 6 },
  notesInput: {
    padding: "8px 10px",
    background: "#181C27",
    border: "1px solid #2A2F3D",
    borderRadius: 6,
    color: "#F0F4FF",
    fontSize: 13,
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  saveBtn: {
    padding: "7px 14px",
    background: "#2A2F3D",
    border: "none",
    borderRadius: 6,
    color: "#F0F4FF",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  modalOverlay: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0,0,0,0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  modal: {
    width: "90%",
    maxWidth: 440,
    background: "#181C27",
    border: "1px solid #2A2F3D",
    borderRadius: 16,
    padding: "28px 28px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: "#F0F4FF" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#8B93A8",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    color: "#8B93A8",
    fontWeight: 500,
  },
  input: {
    padding: "10px 12px",
    background: "#1F2433",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontSize: 14,
    outline: "none",
  },
  errorText: { fontSize: 13, color: "#EF4444" },
  linkResult: { display: "flex", flexDirection: "column", gap: 12 },
  linkLabel: { fontSize: 14, color: "#8B93A8" },
  linkBox: {
    padding: "10px 12px",
    background: "#1F2433",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    overflow: "hidden",
  },
  linkText: {
    fontSize: 12,
    color: "#00C2FF",
    wordBreak: "break-all" as const,
    fontFamily: "monospace",
  },
  linkActions: { display: "flex", gap: 10 },
};
