"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectStats, CallRow } from "@/lib/db";

// ─── Design tokens (matches Plan.jsx) ────────────────────────────────────────
const C = {
  bg: "#F7F5F0",
  paper: "#FFFFFF",
  ink: "#1A1814",
  inkMid: "#4A4640",
  inkLight: "#8A8680",
  border: "#E0DDD8",
  borderDark: "#C8C4BE",
  anthropic: "#CC5500",
  gemini: "#1A73E8",
  openai: "#10A37F",
  cohere: "#9B5DE5",
  accent: "#2D6A4F",
  tag: "#F0EDE8",
  warn: "#B5451B",
};

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: C.anthropic,
  gemini:    C.gemini,
  openai:    C.openai,
  cohere:    C.cohere,
};

function fmt(n: number, digits = 4) {
  return n < 0.0001 && n > 0 ? "<$0.0001" : `$${n.toFixed(digits)}`;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = C.ink }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ fontSize: 11, fontFamily: "DM Sans, system-ui", color: C.inkLight, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "DM Mono, monospace", letterSpacing: "-1px" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.inkLight, fontFamily: "DM Sans, system-ui", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Feature bar chart ────────────────────────────────────────────────────────
function FeatureChart({ data }: { data: ProjectStats["byFeature"] }) {
  const max = data[0]?.total_cost ?? 1;
  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "20px 22px" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "DM Sans, system-ui", marginBottom: 16, color: C.ink }}>Cost by Feature</h3>
      {data.length === 0 && <div style={{ color: C.inkLight, fontSize: 13, fontFamily: "DM Sans, system-ui" }}>No data yet — seed or send calls.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((f) => (
          <div key={f.feature}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontFamily: "DM Sans, system-ui", color: C.inkMid }}>{f.feature}</span>
              <span style={{ fontSize: 12, fontFamily: "DM Mono, monospace", color: C.ink }}>{fmt(Number(f.total_cost))}</span>
            </div>
            <div style={{ height: 6, background: C.tag, borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.max(4, (Number(f.total_cost) / max) * 100)}%`,
                background: C.accent,
                borderRadius: 3,
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans, system-ui", marginTop: 2 }}>
              {f.call_count} calls · avg {fmt(Number(f.avg_cost), 5)}/call
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Provider breakdown ───────────────────────────────────────────────────────
function ProviderBreakdown({ data }: { data: ProjectStats["byProvider"] }) {
  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "20px 22px" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "DM Sans, system-ui", marginBottom: 16, color: C.ink }}>Provider Breakdown</h3>
      {data.length === 0 && <div style={{ color: C.inkLight, fontSize: 13, fontFamily: "DM Sans, system-ui" }}>No data yet.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {data.map((p) => {
          const color = PROVIDER_COLOR[p.provider] ?? C.inkMid;
          return (
            <div key={p.provider}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontFamily: "DM Sans, system-ui", color, fontWeight: 600, textTransform: "capitalize" }}>{p.provider}</span>
                <span style={{ fontSize: 12, fontFamily: "DM Mono, monospace", color: C.ink }}>
                  {fmt(Number(p.total_cost))} · {p.pct}%
                </span>
              </div>
              <div style={{ height: 6, background: C.tag, borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${Math.max(2, p.pct)}%`,
                  background: color,
                  borderRadius: 3,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans, system-ui", marginTop: 2 }}>
                {p.call_count} calls
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Model table ──────────────────────────────────────────────────────────────
function ModelTable({ data }: { data: ProjectStats["byModel"] }) {
  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "20px 22px" }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "DM Sans, system-ui", marginBottom: 14, color: C.ink }}>Models in Use</h3>
      {data.length === 0 && <div style={{ color: C.inkLight, fontSize: 13, fontFamily: "DM Sans, system-ui" }}>No data yet.</div>}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {["Model", "Provider", "Cost", "Calls"].map((h) => (
              <th key={h} style={{ textAlign: "left", fontSize: 11, fontFamily: "DM Sans, system-ui", color: C.inkLight, fontWeight: 600, paddingBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((m, i) => {
            const color = PROVIDER_COLOR[m.provider] ?? C.inkMid;
            return (
              <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: "8px 0", fontSize: 12, fontFamily: "DM Mono, monospace", color: C.ink }}>{m.model}</td>
                <td style={{ padding: "8px 0" }}>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: `${color}15`, color, fontFamily: "DM Sans, system-ui", fontWeight: 600, textTransform: "capitalize" }}>{m.provider}</span>
                </td>
                <td style={{ padding: "8px 0", fontSize: 12, fontFamily: "DM Mono, monospace", color: C.ink }}>{fmt(Number(m.total_cost))}</td>
                <td style={{ padding: "8px 0", fontSize: 12, fontFamily: "DM Sans, system-ui", color: C.inkMid }}>{m.call_count}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Recent calls table ───────────────────────────────────────────────────────
function RecentCalls({ calls }: { calls: CallRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? calls : calls.slice(0, 10);

  return (
    <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, fontFamily: "DM Sans, system-ui", color: C.ink }}>Recent Calls</h3>
        <span style={{ fontSize: 12, color: C.inkLight, fontFamily: "DM Sans, system-ui" }}>{calls.length} total</span>
      </div>
      {calls.length === 0 && <div style={{ color: C.inkLight, fontSize: 13, fontFamily: "DM Sans, system-ui" }}>No calls yet.</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {["Time", "Feature", "Model", "In", "Out", "Cost", "Flags"].map((h) => (
                <th key={h} style={{ textAlign: "left", fontSize: 11, fontFamily: "DM Sans, system-ui", color: C.inkLight, fontWeight: 600, paddingBottom: 8, letterSpacing: "0.06em", textTransform: "uppercase", paddingRight: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const flags: string[] = (() => { try { return JSON.parse(c.flags); } catch { return []; } })();
              const color = PROVIDER_COLOR[c.provider] ?? C.inkMid;
              return (
                <tr key={c.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "7px 12px 7px 0", fontSize: 11, fontFamily: "DM Mono, monospace", color: C.inkLight, whiteSpace: "nowrap" }}>
                    {new Date(c.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "7px 12px 7px 0", fontSize: 12, fontFamily: "DM Sans, system-ui", color: C.inkMid }}>{c.feature}</td>
                  <td style={{ padding: "7px 12px 7px 0" }}>
                    <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 20, background: `${color}12`, color, fontFamily: "DM Sans, system-ui", fontWeight: 600 }}>{c.model.split("-").slice(0, 3).join("-")}</span>
                  </td>
                  <td style={{ padding: "7px 12px 7px 0", fontSize: 12, fontFamily: "DM Mono, monospace", color: C.inkMid }}>{c.input_tokens.toLocaleString()}</td>
                  <td style={{ padding: "7px 12px 7px 0", fontSize: 12, fontFamily: "DM Mono, monospace", color: C.inkMid }}>{c.output_tokens.toLocaleString()}</td>
                  <td style={{ padding: "7px 12px 7px 0", fontSize: 12, fontFamily: "DM Mono, monospace", color: C.ink }}>{fmt(c.cost_usd, 5)}</td>
                  <td style={{ padding: "7px 0" }}>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {flags.map((f) => (
                        <span key={f} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 10, background: `${C.warn}15`, color: C.warn, fontFamily: "DM Sans, system-ui", fontWeight: 600 }}>{f}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {calls.length > 10 && (
        <button onClick={() => setExpanded(!expanded)} style={{
          marginTop: 12, background: "none", border: `1px solid ${C.border}`, borderRadius: 6,
          padding: "5px 14px", fontSize: 12, color: C.inkMid, cursor: "pointer", fontFamily: "DM Sans, system-ui",
        }}>
          {expanded ? "Show less" : `Show all ${calls.length} calls`}
        </button>
      )}
    </div>
  );
}

// ─── Compare panel ────────────────────────────────────────────────────────────
function ComparePanel({ liveStats, seedStats, range }: { liveStats: ProjectStats; seedStats: ProjectStats; range: string }) {
  const cols = [
    { label: "Live demo", project: "dream-play", stats: liveStats, accent: C.gemini },
    { label: "Seed data", project: "dream-play-seed", stats: seedStats, accent: C.accent },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
      {cols.map((col) => (
        <div key={col.project}>
          {/* Column header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.accent }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>{col.label}</span>
            <span style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Mono, monospace" }}>{col.project}</span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.inkLight }}>last {range}</span>
          </div>
          {/* 4 stat cards */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Total Cost",    value: fmt(col.stats.totalCost),            color: col.accent },
              { label: "Total Calls",   value: col.stats.callCount.toLocaleString(), color: C.ink     },
              { label: "Avg Latency",   value: `${col.stats.avgLatency}ms`,          color: C.ink     },
              { label: "Flagged",       value: col.stats.flaggedCount.toString(),    color: col.stats.flaggedCount > 0 ? C.warn : C.inkLight },
            ].map((s) => (
              <div key={s.label} style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 10, color: C.inkLight, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4, fontFamily: "DM Sans, system-ui" }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: "DM Mono, monospace", letterSpacing: "-0.5px" }}>{s.value}</div>
              </div>
            ))}
          </div>
          {/* Feature bars */}
          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: "DM Sans, system-ui", marginBottom: 10 }}>By Feature</div>
            {col.stats.byFeature.length === 0
              ? <div style={{ fontSize: 12, color: C.inkLight, fontFamily: "DM Sans, system-ui" }}>No data in this range.</div>
              : col.stats.byFeature.map((f) => {
                  const max = col.stats.byFeature[0]?.total_cost ?? 1;
                  return (
                    <div key={f.feature} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color: C.inkMid, fontFamily: "DM Sans, system-ui" }}>{f.feature}</span>
                        <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: C.ink }}>{fmt(Number(f.total_cost))}</span>
                      </div>
                      <div style={{ height: 5, background: C.tag, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(4, (Number(f.total_cost) / Number(max)) * 100)}%`, background: col.accent, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })
            }
          </div>
          {/* Provider breakdown */}
          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.ink, fontFamily: "DM Sans, system-ui", marginBottom: 10 }}>By Provider</div>
            {col.stats.byProvider.length === 0
              ? <div style={{ fontSize: 12, color: C.inkLight, fontFamily: "DM Sans, system-ui" }}>No data.</div>
              : col.stats.byProvider.map((p) => {
                  const color = PROVIDER_COLOR[p.provider] ?? C.inkMid;
                  return (
                    <div key={p.provider} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 12, color, fontWeight: 600, textTransform: "capitalize", fontFamily: "DM Sans, system-ui" }}>{p.provider}</span>
                        <span style={{ fontSize: 11, fontFamily: "DM Mono, monospace", color: C.ink }}>{fmt(Number(p.total_cost))} · {p.pct}%</span>
                      </div>
                      <div style={{ height: 5, background: C.tag, borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.max(2, p.pct)}%`, background: color, borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
import type { ProjectMode } from "@/app/page";

interface DashboardProps {
  liveStats: ProjectStats;
  seedStats: ProjectStats;
  projectMode: ProjectMode;
  onProjectModeChange: (m: ProjectMode) => void;
  range: string;
  onRangeChange: (r: string) => void;
  onSeed: () => void;
  seeding: boolean;
  onClearLive: () => void;
  clearing: boolean;
}

const RANGES = [
  { label: "1h",  value: "1h"  },
  { label: "6h",  value: "6h"  },
  { label: "24h", value: "24h" },
  { label: "7d",  value: "7d"  },
  { label: "30d", value: "30d" },
];

export default function Dashboard({ liveStats, seedStats, projectMode, onProjectModeChange, range, onRangeChange, onSeed, seeding, onClearLive, clearing }: DashboardProps) {
  // Which stats to show in single-project views
  const stats = projectMode === "seed" ? seedStats : liveStats;
  const project = projectMode === "seed" ? "dream-play-seed" : "dream-play";

  const MODE_TABS: { value: ProjectMode; label: string }[] = [
    { value: "live",    label: "Live" },
    { value: "seed",    label: "Seed" },
    { value: "compare", label: "↔ Compare" },
  ];

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: C.bg, minWidth: 0 }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "DM Sans, system-ui", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>
              TokenSense · {projectMode === "compare" ? "dream-play vs dream-play-seed" : project}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", color: C.ink, lineHeight: 1.2 }}>
              Cost Intelligence Dashboard
            </h1>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {/* Project mode tabs */}
            <div style={{ display: "flex", background: C.paper, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
              {MODE_TABS.map((t) => (
                <button key={t.value} onClick={() => onProjectModeChange(t.value)} style={{
                  background: projectMode === t.value ? C.ink : "transparent",
                  color: projectMode === t.value ? "#fff" : C.inkMid,
                  border: "none", borderRadius: 5, padding: "4px 12px", fontSize: 12,
                  cursor: "pointer", fontFamily: "DM Sans, system-ui", fontWeight: projectMode === t.value ? 600 : 500,
                  transition: "all 0.15s",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Range selector */}
            <div style={{ display: "flex", gap: 4, background: C.paper, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3 }}>
              {RANGES.map((r) => (
                <button key={r.value} onClick={() => onRangeChange(r.value)} style={{
                  background: range === r.value ? C.ink : "transparent",
                  color: range === r.value ? "#fff" : C.inkMid,
                  border: "none", borderRadius: 5, padding: "4px 10px", fontSize: 12,
                  cursor: "pointer", fontFamily: "DM Sans, system-ui", fontWeight: 500,
                }}>{r.label}</button>
              ))}
            </div>

            {/* Reset live data — only shown on Live tab */}
            {projectMode === "live" && liveStats.callCount > 0 && (
              <button onClick={onClearLive} disabled={clearing} style={{
                background: "transparent", color: clearing ? C.inkLight : C.warn,
                border: `1px solid ${clearing ? C.border : C.warn + "50"}`,
                borderRadius: 7, padding: "7px 14px", fontSize: 12,
                cursor: clearing ? "not-allowed" : "pointer", fontFamily: "DM Sans, system-ui", fontWeight: 500,
              }}>
                {clearing ? "Clearing…" : "↺ Reset live"}
              </button>
            )}

            {/* Seed button — always seeds into dream-play-seed */}
            <button onClick={onSeed} disabled={seeding} style={{
              background: seeding ? C.tag : C.accent, color: seeding ? C.inkLight : "#fff",
              border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12,
              cursor: seeding ? "not-allowed" : "pointer", fontFamily: "DM Sans, system-ui", fontWeight: 500,
            }}>
              {seeding ? "Seeding…" : "Seed data"}
            </button>

            {/* Demo link */}
            <Link href="/demo" style={{
              background: C.ink, color: "#fff", border: `1px solid ${C.ink}`,
              borderRadius: 7, padding: "7px 14px", fontSize: 12, textDecoration: "none",
              fontFamily: "DM Sans, system-ui", fontWeight: 600,
            }}>
              ▶ Live demo
            </Link>

            {/* Summary link */}
            <Link href="/summary" style={{
              background: C.paper, color: C.inkMid, border: `1px solid ${C.border}`,
              borderRadius: 7, padding: "7px 14px", fontSize: 12, textDecoration: "none",
              fontFamily: "DM Sans, system-ui", fontWeight: 500,
            }}>
              Summary ↗
            </Link>
          </div>
        </div>

        {/* Live / Seed badge */}
        {projectMode !== "compare" && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{
              fontSize: 11, padding: "2px 10px", borderRadius: 20, fontWeight: 600,
              background: projectMode === "live" ? `${C.gemini}15` : `${C.accent}15`,
              color: projectMode === "live" ? C.gemini : C.accent,
              border: `1px solid ${projectMode === "live" ? C.gemini + "30" : C.accent + "30"}`,
            }}>
              {projectMode === "live" ? "● Live demo calls — dream-play" : "● Seed data — dream-play-seed"}
            </span>
            {projectMode === "live" && liveStats.callCount === 0 && (
              <span style={{ fontSize: 12, color: C.inkLight }}>No live calls yet — click <strong>▶ Live demo</strong> to fire some.</span>
            )}
            {projectMode === "seed" && seedStats.callCount === 0 && (
              <span style={{ fontSize: 12, color: C.inkLight }}>No seed data yet — click <strong>Seed data</strong> to populate.</span>
            )}
          </div>
        )}
      </div>

      {/* ─── Compare view ─────────────────────────────────────────────────── */}
      {projectMode === "compare" ? (
        <ComparePanel liveStats={liveStats} seedStats={seedStats} range={range} />
      ) : (
        <>
          {/* Overview cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Total Cost"    value={fmt(stats.totalCost)}               sub={`Last ${range}`} color={C.ink} />
            <StatCard label="Total Calls"   value={stats.callCount.toLocaleString()}   sub="API requests" />
            <StatCard label="Avg Latency"   value={`${stats.avgLatency}ms`}            sub="per call" />
            <StatCard label="Flagged Calls" value={stats.flaggedCount.toString()}       sub="optimization issues" color={stats.flaggedCount > 0 ? C.warn : C.accent} />
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <FeatureChart data={stats.byFeature} />
            <ProviderBreakdown data={stats.byProvider} />
          </div>

          {/* Model table */}
          <div style={{ marginBottom: 14 }}>
            <ModelTable data={stats.byModel} />
          </div>

          {/* Recent calls */}
          <RecentCalls calls={stats.recentCalls} />
        </>
      )}
    </div>
  );
}
