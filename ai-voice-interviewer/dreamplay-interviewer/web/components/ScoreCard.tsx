"use client";

import type { Scorecard } from "@/lib/types";

interface ScorecardProps {
  scorecard: Scorecard;
}

const RECOMMENDATION_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
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

export function ScorecardView({ scorecard }: ScorecardProps) {
  const rec = RECOMMENDATION_META[scorecard.recommendation] ?? {
    label: scorecard.recommendation.toUpperCase(),
    color: "#8B93A8",
    bg: "rgba(139,147,168,0.1)",
  };

  const dimensions = [
    { key: "communication", label: "Communication", data: scorecard.dimensions.communication },
    { key: "role_fit", label: "Role Fit", data: scorecard.dimensions.role_fit },
    { key: "motivation", label: "Motivation", data: scorecard.dimensions.motivation },
    { key: "culture_fit", label: "Culture Fit", data: scorecard.dimensions.culture_fit },
    { key: "problem_solving", label: "Problem Solving", data: scorecard.dimensions.problem_solving },
  ];

  return (
    <div style={styles.root}>
      {/* Header row */}
      <div style={styles.header}>
        <div style={styles.overallScore}>
          <span
            style={{ ...styles.scoreBig, color: scoreColor(scorecard.overall_score) }}
          >
            {scorecard.overall_score}
          </span>
          <span style={styles.scoreMax}>/10</span>
        </div>
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
      </div>

      {/* Summary */}
      <p style={styles.summary}>{scorecard.summary}</p>

      {/* Dimensions */}
      <div style={styles.dimensionGrid}>
        {dimensions.map(({ key, label, data }) => (
          <div key={key} style={styles.dimensionRow}>
            <div style={styles.dimLeft}>
              <span style={styles.dimLabel}>{label}</span>
              <span style={{ ...styles.dimScore, color: scoreColor(data.score) }}>
                {data.score}/10
              </span>
            </div>
            <div style={styles.progressBg}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${data.score * 10}%`,
                  background: scoreColor(data.score),
                }}
              />
            </div>
            {data.notes && <p style={styles.dimNotes}>{data.notes}</p>}
          </div>
        ))}
      </div>

      {/* Strengths */}
      {scorecard.strengths.length > 0 && (
        <div style={styles.listSection}>
          <p style={styles.listTitle}>Strengths</p>
          <ul style={styles.list}>
            {scorecard.strengths.map((s, i) => (
              <li key={i} style={{ ...styles.listItem, color: "#22C55E" }}>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Concerns */}
      {scorecard.concerns.length > 0 && (
        <div style={styles.listSection}>
          <p style={styles.listTitle}>Concerns</p>
          <ul style={styles.list}>
            {scorecard.concerns.map((c, i) => (
              <li key={i} style={{ ...styles.listItem, color: "#EF4444" }}>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Follow-up questions */}
      {scorecard.suggested_followup_questions.length > 0 && (
        <div style={styles.listSection}>
          <p style={styles.listTitle}>Suggested Follow-up Questions</p>
          <ol style={{ ...styles.list, paddingLeft: 18 }}>
            {scorecard.suggested_followup_questions.map((q, i) => (
              <li key={i} style={{ ...styles.listItem, color: "#8B93A8" }}>
                {q}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },
  overallScore: {
    display: "flex",
    alignItems: "baseline",
    gap: 2,
  },
  scoreBig: {
    fontSize: 42,
    fontWeight: 800,
    lineHeight: 1,
  },
  scoreMax: {
    fontSize: 18,
    color: "#4A5168",
    fontWeight: 500,
  },
  recBadge: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "4px 10px",
    borderRadius: 6,
  },
  summary: {
    fontSize: 14,
    color: "#8B93A8",
    lineHeight: 1.7,
    padding: "12px 16px",
    background: "#181C27",
    borderRadius: 8,
    border: "1px solid #2A2F3D",
  },
  dimensionGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  dimensionRow: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
  },
  dimLeft: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dimLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: "#F0F4FF",
  },
  dimScore: {
    fontSize: 13,
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
  },
  progressBg: {
    height: 5,
    background: "#2A2F3D",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
    transition: "width 0.4s ease",
  },
  dimNotes: {
    fontSize: 12,
    color: "#4A5168",
    lineHeight: 1.5,
    marginTop: 2,
  },
  listSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#4A5168",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    listStyle: "disc",
    paddingLeft: 16,
  },
  listItem: {
    fontSize: 13,
    lineHeight: 1.5,
  },
};
