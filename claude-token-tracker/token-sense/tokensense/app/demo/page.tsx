"use client";

import { useState, useRef } from "react";
import Link from "next/link";

const C = {
  bg:          "#F7F5F0",
  paper:       "#FFFFFF",
  ink:         "#1A1814",
  inkMid:      "#4A4640",
  inkLight:    "#8A8680",
  border:      "#E0DDD8",
  borderDark:  "#C8C4BE",
  gemini:      "#1A73E8",
  anthropic:   "#CC5500",
  accent:      "#2D6A4F",
  warn:        "#B5451B",
  tag:         "#F0EDE8",
  purple:      "#7c3aed",
};

interface DemoResult {
  scenario: string;
  feature: string;
  model: string;
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  latencyMs: number;
  flags: string[];
  experimentId?: string;
  environment?: string;
  error?: string;
}

interface CallEntry extends DemoResult {
  id: number;
  firedAt: string;
}

const SCENARIOS = [
  {
    id: "game_analysis",
    label: "Game Analysis",
    icon: "🏏",
    description: "Analyse an RCB vs MI match — 3 key insights with stats",
    feature: "game_analysis",
    color: C.gemini,
    tag: "Production",
    tagColor: C.accent,
  },
  {
    id: "coaching_insights",
    label: "Coaching Insights",
    icon: "🎯",
    description: "Performance coaching tips for a batsman from player stats",
    feature: "coaching_insights",
    color: C.anthropic,
    tag: "Production",
    tagColor: C.accent,
  },
  {
    id: "match_prediction",
    label: "Match Prediction",
    icon: "📊",
    description: "Predict match winner with confidence score from live state",
    feature: "match_prediction",
    color: C.accent,
    tag: "Production",
    tagColor: C.accent,
  },
  {
    id: "commentary_gen",
    label: "Commentary Gen",
    icon: "🎙️",
    description: "Live ball-by-ball commentary for an over",
    feature: "commentary_gen",
    color: C.inkMid,
    tag: "Production",
    tagColor: C.accent,
  },
];

const EXPERIMENT_SCENARIOS = [
  {
    id: "experiment_v1",
    label: "Prompt v1 — Brief",
    description: "~12 words. Minimal context.",
    color: C.purple,
  },
  {
    id: "experiment_v2",
    label: "Prompt v2 — Detailed",
    description: "~90 words. Structured context + instructions.",
    color: C.purple,
  },
];

export default function DemoPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, DemoResult>>({});
  const [log, setLog] = useState<CallEntry[]>([]);
  const counter = useRef(0);

  async function fire(scenarioId: string) {
    setRunning(scenarioId);
    try {
      const res = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: scenarioId }),
      });
      const data: DemoResult = await res.json();
      setResults((prev) => ({ ...prev, [scenarioId]: data }));
      if (!data.error) {
        counter.current += 1;
        setLog((prev) => [
          {
            ...data,
            id: counter.current,
            firedAt: new Date().toLocaleTimeString(),
          },
          ...prev,
        ].slice(0, 20));
      }
    } catch (e) {
      setResults((prev) => ({
        ...prev,
        [scenarioId]: { scenario: scenarioId, error: String(e) } as DemoResult,
      }));
    } finally {
      setRunning(null);
    }
  }

  const totalCost = log.reduce((s, c) => s + (c.costUSD ?? 0), 0);
  const totalCalls = log.length;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* Nav */}
      <div style={{ background: C.paper, borderBottom: `1px solid ${C.border}`, padding: "13px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>TS</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: "'Libre Baskerville', Georgia, serif" }}>TokenSense</span>
          <span style={{ fontSize: 12, color: C.inkLight, marginLeft: 2 }}>· Live Demo</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {totalCalls > 0 && (
            <div style={{ display: "flex", gap: 12, marginRight: 8, padding: "5px 14px", background: C.tag, borderRadius: 7, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 12, color: C.inkMid }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.ink }}>{totalCalls}</span> calls fired
              </span>
              <span style={{ fontSize: 12, color: C.inkMid }}>
                <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.accent }}>${totalCost.toFixed(6)}</span> spent
              </span>
            </div>
          )}
          <Link href="/" style={{ fontSize: 13, color: C.inkMid, textDecoration: "none", background: C.tag, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", fontWeight: 500 }}>Dashboard →</Link>
          <Link href="/summary" style={{ fontSize: 13, color: C.inkMid, textDecoration: "none", background: C.tag, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", fontWeight: 500 }}>Summary →</Link>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 32px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.inkLight, textTransform: "uppercase", marginBottom: 12, fontFamily: "'DM Sans', system-ui" }}>
            Clickable Integration Test
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", lineHeight: 1.15, marginBottom: 14, letterSpacing: "-0.5px" }}>
            Live Demo Playground
          </h1>
          <p style={{ fontSize: 15, color: C.inkMid, lineHeight: 1.75, maxWidth: 620 }}>
            Each button fires a <strong>real Gemini API call</strong> with a realistic [Company] prompt, records the actual tokens and cost, and writes to the dashboard — all in one click. Open the{" "}
            <Link href="/" style={{ color: C.gemini, textDecoration: "none", fontWeight: 600 }}>dashboard</Link>{" "}
            in another tab to watch it update live.
          </p>
        </div>

        {/* Production scenarios */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Production scenarios</h2>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: `${C.accent}15`, color: C.accent, fontWeight: 600, border: `1px solid ${C.accent}30` }}>gemini-2.0-flash</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {SCENARIOS.map((sc) => {
              const r = results[sc.id];
              const isRunning = running === sc.id;
              return (
                <div key={sc.id} style={{ background: C.paper, border: `1.5px solid ${r && !r.error ? sc.color + "40" : C.border}`, borderRadius: 12, padding: "20px 22px", transition: "border-color 0.2s" }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 22 }}>{sc.icon}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>{sc.label}</div>
                        <div style={{ fontSize: 12, color: C.inkLight, marginTop: 2 }}>{sc.description}</div>
                      </div>
                    </div>
                  </div>

                  {/* Result metrics */}
                  {r && !r.error && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      {[
                        { label: "in",      value: r.inputTokens.toLocaleString(),  color: C.inkMid },
                        { label: "out",     value: r.outputTokens.toLocaleString(), color: C.inkMid },
                        { label: "cost",    value: `$${r.costUSD.toFixed(6)}`,      color: C.accent },
                        { label: "latency", value: `${r.latencyMs}ms`,              color: r.latencyMs > 3000 ? C.warn : C.inkMid },
                      ].map((m) => (
                        <div key={m.label} style={{ padding: "4px 10px", background: C.tag, borderRadius: 6, border: `1px solid ${C.border}` }}>
                          <span style={{ fontSize: 10, color: C.inkLight, fontFamily: "'DM Sans', system-ui", textTransform: "uppercase", letterSpacing: "0.07em" }}>{m.label} </span>
                          <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: m.color }}>{m.value}</span>
                        </div>
                      ))}
                      {r.flags.length > 0 && r.flags.map((f) => (
                        <div key={f} style={{ padding: "4px 10px", background: `${C.warn}10`, borderRadius: 6, border: `1px solid ${C.warn}30` }}>
                          <span style={{ fontSize: 11, color: C.warn, fontFamily: "'DM Mono', monospace" }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Error */}
                  {r?.error && (
                    <div style={{ fontSize: 12, color: C.warn, background: `${C.warn}10`, border: `1px solid ${C.warn}25`, borderRadius: 6, padding: "8px 10px", marginBottom: 12 }}>
                      {r.error}
                    </div>
                  )}

                  {/* Response text */}
                  {r?.text && (
                    <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7, background: C.tag, borderRadius: 8, padding: "12px 14px", marginBottom: 14, maxHeight: 160, overflowY: "auto", fontFamily: "'DM Sans', system-ui" }}>
                      {r.text}
                    </div>
                  )}

                  {/* Fire button */}
                  <button
                    onClick={() => fire(sc.id)}
                    disabled={isRunning || running !== null}
                    style={{
                      width: "100%",
                      padding: "9px 0",
                      background: isRunning ? C.tag : C.ink,
                      color: isRunning ? C.inkMid : "#fff",
                      border: `1.5px solid ${isRunning ? C.border : C.ink}`,
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: isRunning || running !== null ? "not-allowed" : "pointer",
                      fontFamily: "'DM Sans', system-ui",
                      transition: "all 0.15s",
                      opacity: running !== null && !isRunning ? 0.5 : 1,
                    }}
                  >
                    {isRunning ? "⏳ Calling Gemini…" : r && !r.error ? "↺ Run again" : "▶ Fire real call"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Experiment section */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Prompt experiment</h2>
            <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: `${C.purple}15`, color: C.purple, fontWeight: 600, border: `1px solid ${C.purple}30` }}>Dev &amp; ML</span>
          </div>
          <p style={{ fontSize: 13, color: C.inkLight, marginBottom: 16 }}>
            Same task. Two prompt styles. Fire both, then compare real token counts and cost — this is the dev/ML use case.
          </p>
          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "22px 24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {EXPERIMENT_SCENARIOS.map((sc) => {
                const r = results[sc.id];
                const isRunning = running === sc.id;
                return (
                  <div key={sc.id} style={{ background: C.bg, borderRadius: 10, padding: "16px 18px", border: `1.5px solid ${r && !r.error ? C.purple + "40" : C.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 4 }}>{sc.label}</div>
                    <div style={{ fontSize: 12, color: C.inkLight, marginBottom: 12 }}>{sc.description}</div>

                    {r && !r.error && (
                      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
                        {[
                          { label: "tokens", value: (r.inputTokens + r.outputTokens).toLocaleString(), color: C.inkMid },
                          { label: "cost",   value: `$${r.costUSD.toFixed(6)}`,                       color: C.accent },
                          { label: "ms",     value: `${r.latencyMs}`,                                  color: C.inkMid },
                        ].map((m) => (
                          <div key={m.label} style={{ padding: "3px 8px", background: C.paper, borderRadius: 5, border: `1px solid ${C.border}` }}>
                            <span style={{ fontSize: 10, color: C.inkLight }}>{m.label} </span>
                            <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: m.color }}>{m.value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {r?.text && (
                      <div style={{ fontSize: 12, color: C.inkMid, lineHeight: 1.65, background: C.paper, borderRadius: 7, padding: "10px 12px", marginBottom: 12, maxHeight: 120, overflowY: "auto" }}>
                        {r.text}
                      </div>
                    )}

                    <button
                      onClick={() => fire(sc.id)}
                      disabled={isRunning || running !== null}
                      style={{
                        width: "100%",
                        padding: "8px 0",
                        background: isRunning ? C.tag : C.purple,
                        color: isRunning ? C.inkMid : "#fff",
                        border: `1.5px solid ${isRunning ? C.border : C.purple}`,
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isRunning || running !== null ? "not-allowed" : "pointer",
                        fontFamily: "'DM Sans', system-ui",
                        opacity: running !== null && !isRunning ? 0.5 : 1,
                      }}
                    >
                      {isRunning ? "⏳ Running…" : r && !r.error ? "↺ Re-run" : "▶ Run variant"}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Comparison row — appears once both have run */}
            {results.experiment_v1 && !results.experiment_v1.error && results.experiment_v2 && !results.experiment_v2.error && (
              <div style={{ marginTop: 18, padding: "14px 16px", background: `${C.purple}08`, border: `1.5px solid ${C.purple}25`, borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.purple, marginBottom: 10 }}>Comparison</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
                  {[
                    {
                      label: "Token delta",
                      v1: results.experiment_v1.inputTokens + results.experiment_v1.outputTokens,
                      v2: results.experiment_v2.inputTokens + results.experiment_v2.outputTokens,
                      fmt: (n: number) => n.toLocaleString(),
                      unit: "tok",
                    },
                    {
                      label: "Cost delta",
                      v1: results.experiment_v1.costUSD,
                      v2: results.experiment_v2.costUSD,
                      fmt: (n: number) => `$${n.toFixed(6)}`,
                      unit: "",
                    },
                    {
                      label: "Latency delta",
                      v1: results.experiment_v1.latencyMs,
                      v2: results.experiment_v2.latencyMs,
                      fmt: (n: number) => `${n}ms`,
                      unit: "",
                    },
                    {
                      label: "Cost × 10k calls/day",
                      v1: results.experiment_v1.costUSD * 10000,
                      v2: results.experiment_v2.costUSD * 10000,
                      fmt: (n: number) => `$${n.toFixed(2)}`,
                      unit: "/day",
                    },
                  ].map((row) => {
                    const cheaper = row.v1 <= row.v2 ? "v1" : "v2";
                    const diff = Math.abs(row.v2 - row.v1);
                    const pct  = row.v1 > 0 ? Math.round((diff / row.v1) * 100) : 0;
                    return (
                      <div key={row.label} style={{ background: C.paper, borderRadius: 8, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: 11, color: C.inkLight, marginBottom: 6, fontWeight: 600 }}>{row.label}</div>
                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.inkMid, marginBottom: 3 }}>
                          v1: <span style={{ color: cheaper === "v1" ? C.accent : C.ink }}>{row.fmt(row.v1)}</span>
                        </div>
                        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.inkMid, marginBottom: 6 }}>
                          v2: <span style={{ color: cheaper === "v2" ? C.accent : C.ink }}>{row.fmt(row.v2)}</span>
                        </div>
                        <div style={{ fontSize: 11, padding: "2px 7px", borderRadius: 4, background: `${C.accent}12`, color: C.accent, display: "inline-block", fontWeight: 700 }}>
                          {cheaper === "v1" ? "v1 cheaper" : "v2 cheaper"} {pct > 0 ? `(${pct}%)` : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Call log */}
        {log.length > 0 && (
          <section>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>Call log — this session</h2>
              <span style={{ fontSize: 12, color: C.inkLight }}>{log.length} call{log.length !== 1 ? "s" : ""} · ${totalCost.toFixed(6)} total</span>
            </div>
            <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              {log.map((entry, i) => (
                <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: i < log.length - 1 ? `1px solid ${C.border}` : "none", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: C.inkLight, fontFamily: "'DM Mono', monospace", width: 56, flexShrink: 0 }}>{entry.firedAt}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.ink, width: 140, flexShrink: 0 }}>{entry.feature}</span>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: C.gemini }}>{entry.model}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.inkMid }}>{entry.inputTokens}→{entry.outputTokens} tok</span>
                  <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: C.accent, width: 90, textAlign: "right" }}>${entry.costUSD.toFixed(6)}</span>
                  <span style={{ fontSize: 11, color: entry.latencyMs > 3000 ? C.warn : C.inkLight, fontFamily: "'DM Mono', monospace", width: 60, textAlign: "right" }}>{entry.latencyMs}ms</span>
                  {entry.flags?.length > 0 && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${C.warn}12`, color: C.warn, border: `1px solid ${C.warn}25`, fontFamily: "'DM Mono', monospace" }}>
                      {entry.flags[0]}
                    </span>
                  )}
                  {entry.environment === "experiment" && (
                    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, background: `${C.purple}12`, color: C.purple, border: `1px solid ${C.purple}25` }}>
                      exp
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, padding: "12px 16px", background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: C.inkMid }}>All calls above are written to the dashboard in real-time.</span>
              <Link href="/" style={{ fontSize: 13, fontWeight: 700, color: C.gemini, textDecoration: "none" }}>View on Dashboard →</Link>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
