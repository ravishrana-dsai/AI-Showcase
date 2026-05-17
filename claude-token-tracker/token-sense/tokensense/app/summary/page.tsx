"use client";

import { useState } from "react";
import Link from "next/link";

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
  accent: "#2D6A4F",
  tag: "#F0EDE8",
  warn: "#B5451B",
};

const MVP_FEATURES = [
  {
    done: true,
    title: "Live ingestion API",
    detail: "POST /api/ingest accepts batched TSCall payloads, enriches with computed cost and optimization flags, writes to SQLite.",
  },
  {
    done: true,
    title: "Cost dashboard",
    detail: "Real-time overview: total spend, cost by feature, cost by provider, models in use, and flagged calls — auto-refreshes every 30s.",
  },
  {
    done: true,
    title: "Gemini 2.0 Flash AI Employee",
    detail: "Streaming chat with live project data injected into every prompt. Knows your actual spend, top features, and flags.",
  },
  {
    done: true,
    title: "Pricing engine",
    detail: "16-model pricing table covering Anthropic, OpenAI, Gemini, and Cohere. Computes cost per call from token counts.",
  },
  {
    done: true,
    title: "Flag detection",
    detail: "Rule-based flags on every call: static_prompt_not_cached, overmodeled, should_batch, use_flash_instead.",
  },
  {
    done: true,
    title: "Seed data",
    detail: "One-click seed populates 200 realistic calls across 5 features and 5 models so the dashboard is never empty.",
  },
  {
    done: false,
    title: "TokenSense SDK (npm + pip)",
    detail: "2-line wrapper around any LLM client. Fire-and-forget telemetry emitter. Phase 1 of the full roadmap.",
  },
  {
    done: false,
    title: "Anthropic AI Employee toggle",
    detail: "Claude Sonnet as a second AI Employee backend. Switch mid-session to compare reasoning quality vs. cost.",
  },
  {
    done: false,
    title: "ClickHouse migration",
    detail: "Swap SQLite for ClickHouse Cloud when scale demands sub-second aggregations over billions of rows.",
  },
];

const STACK = [
  { label: "Framework",  value: "Next.js 16 (App Router)",       color: C.ink     },
  { label: "Database",   value: "SQLite via better-sqlite3",      color: C.inkMid  },
  { label: "Agent",      value: "Gemini 2.0 Flash (streaming)",   color: C.gemini  },
  { label: "Styling",    value: "Inline CSS + DM Sans / DM Mono", color: C.accent  },
  { label: "Deploy",     value: "Vercel + Turso (swap path)",     color: C.anthropic },
  { label: "Language",   value: "TypeScript throughout",          color: C.inkLight },
];

const FLOW = [
  { label: "Your App",       sub: "Any language",        color: C.inkLight  },
  { label: "LLM API",        sub: "Anthropic / Gemini",  color: C.anthropic },
  { label: "POST /api/ingest", sub: "manual fetch call", color: C.accent    },
  { label: "SQLite",         sub: "tokensense.db",       color: C.inkMid    },
  { label: "Dashboard",      sub: "localhost:1010",      color: C.gemini    },
];

const PHASES = [
  { num: "01", title: "Universal SDK",    detail: "npm + pip wrapper. 2-line integration.",           duration: "Week 1–2",  color: C.ink,      done: false },
  { num: "02", title: "Ingestion API",    detail: "POST endpoint, ClickHouse, aggregation queries.",  duration: "Week 2–3",  color: C.inkMid,   done: true  },
  { num: "03", title: "Dual-Model AI Employee", detail: "Anthropic + Gemini backends, provider toggle.",    duration: "Week 3–4",  color: C.anthropic,done: true  },
  { num: "04", title: "Dashboard",        detail: "Live data, provider breakdown, $/match tracking.", duration: "Week 4–5",  color: C.accent,   done: true  },
  { num: "05", title: "Productize",       detail: "npm publish, self-serve onboarding, pricing.",     duration: "Month 2–3", color: C.gemini,   done: false },
];

export default function Summary() {
  const [howItWorksView, setHowItWorksView] = useState<"mvp" | "full">("mvp");
  const [pageTab, setPageTab] = useState<"product" | "landscape">("product");

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", color: C.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.borderDark}; border-radius: 2px; }
      `}</style>

      {/* Top nav */}
      <div style={{ background: C.paper, borderBottom: `1px solid ${C.border}`, padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: C.ink, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>TS</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: "'Libre Baskerville', Georgia, serif" }}>TokenSense</span>
          </div>
          {/* Page tab switcher */}
          <div style={{ display: "flex", background: C.tag, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 2 }}>
            {([["product", "Product Summary"], ["landscape", "Competitive Landscape"]] as const).map(([val, label]) => (
              <button key={val} onClick={() => setPageTab(val)} style={{
                background: pageTab === val ? C.ink : "transparent",
                color: pageTab === val ? "#fff" : C.inkMid,
                border: "none", borderRadius: 5, padding: "5px 14px", fontSize: 12,
                cursor: "pointer", fontFamily: "'DM Sans', system-ui", fontWeight: pageTab === val ? 600 : 500,
                transition: "all 0.15s",
              }}>{label}</button>
            ))}
          </div>
        </div>
        <Link href="/" style={{ fontSize: 13, color: C.inkMid, textDecoration: "none", background: C.tag, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 14px", fontWeight: 500 }}>
          ← Dashboard
        </Link>
      </div>

      <div style={{ maxWidth: pageTab === "landscape" ? 1000 : 860, margin: "0 auto", padding: "48px 40px 80px" }}>

        {pageTab === "landscape" ? (
          <CompetitiveLandscape />
        ) : (<>

        {/* Hero */}
        <div style={{ marginBottom: 56, borderBottom: `1px solid ${C.border}`, paddingBottom: 48, display: "flex", gap: 48, alignItems: "flex-start" }}>

          {/* Left — text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.inkLight, textTransform: "uppercase", marginBottom: 20, fontFamily: "'DM Sans', system-ui" }}>
              TokenSense v1.0 · MVP Summary
            </div>
            <h1 style={{ fontSize: 48, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", lineHeight: 1.1, letterSpacing: "-1.5px", marginBottom: 24, color: C.ink }}>
              The Universal AI Cost<br />Intelligence Layer
            </h1>
            <p style={{ fontSize: 17, color: C.inkMid, lineHeight: 1.8, fontStyle: "italic", marginBottom: 32 }}>
              TokenSense intercepts LLM API calls across any provider — in production, during feature development, and across ML experiments. It measures cost and latency per feature, compares prompt and model iterations, flags inefficiencies, and gives you an AI Employee to act on all of it — in under 2 lines of code.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[
                { label: "Next.js 16",        color: C.ink      },
                { label: "Gemini 2.0 Flash",  color: C.gemini   },
                { label: "SQLite",            color: C.inkMid   },
                { label: "TypeScript",        color: C.accent   },
                { label: "provider-agnostic", color: C.anthropic },
              ].map((t) => (
                <span key={t.label} style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: `1px solid ${t.color}35`, color: t.color, background: `${t.color}0D`, fontFamily: "'DM Sans', system-ui", fontWeight: 500 }}>{t.label}</span>
              ))}
            </div>
          </div>

          {/* Right — key highlights panel */}
          <div style={{ width: 240, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.inkLight, fontFamily: "'DM Sans', system-ui", marginBottom: 4 }}>What's inside</div>

            {/* Dual agent */}
            <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, fontFamily: "'DM Sans', system-ui", marginBottom: 8 }}>Dual AI Agent</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.gemini, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.inkMid, fontFamily: "'DM Sans', system-ui" }}>Gemini 2.0 Flash</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.accent, background: `${C.accent}15`, padding: "1px 6px", borderRadius: 4, fontWeight: 600, fontFamily: "'DM Sans', system-ui" }}>Live</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.anthropic, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: C.inkMid, fontFamily: "'DM Sans', system-ui" }}>Claude Sonnet</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, color: C.inkLight, background: C.tag, padding: "1px 6px", borderRadius: 4, fontWeight: 600, fontFamily: "'DM Sans', system-ui" }}>Roadmap</span>
                </div>
              </div>
            </div>

            {/* Provider stats */}
            <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.ink, fontFamily: "'DM Sans', system-ui", marginBottom: 10 }}>Provider Coverage</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[
                  { label: "API providers",     value: "4+",  color: C.ink      },
                  { label: "Models in pricing", value: "16",  color: C.accent   },
                  { label: "Auto-updated",      value: "Yes", color: C.gemini   },
                ].map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: C.inkMid, fontFamily: "'DM Sans', system-ui" }}>{s.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 0 }}>
              {[
                { value: "5",      label: "phases"    },
                { value: "2",      label: "lines"     },
                { value: "∞",      label: "providers" },
              ].map((s, i, arr) => (
                <div key={s.label} style={{ flex: 1, textAlign: "center", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none", padding: "0 4px" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: C.ink, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: C.inkLight, fontFamily: "'DM Sans', system-ui", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* The problem */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 16 }}>The Problem</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
            {[
              { title: "No visibility", body: "LLM API bills are a single number. You can't see which feature, model, or call is driving spend." },
              { title: "No attribution", body: "When costs spike, there's no way to trace it to a specific product feature or team." },
              { title: "No action", body: "Even when you find a problem, there's no tool to tell you exactly how to fix it with a code snippet ready to copy." },
              { title: "No dev-time feedback", body: "Engineers experiment with prompts and models blind — no way to compare actual cost between iterations before shipping to production." },
            ].map((c) => (
              <div key={c.title} style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 10, padding: "18px 20px" }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: C.warn }}>{c.title}</div>
                <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7 }}>{c.body}</div>
              </div>
            ))}
          </div>
        </section>

        {/* AI Employee hero feature */}
        <div style={{ marginBottom: 52, background: C.ink, borderRadius: 14, padding: "32px 36px", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(26,115,232,0.12)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, left: -20, width: 160, height: 160, borderRadius: "50%", background: "rgba(45,106,79,0.15)", pointerEvents: "none" }} />

          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1A73E8", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontFamily: "'DM Sans', system-ui", fontWeight: 700, flexShrink: 0 }}>TS</div>
              <span style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', system-ui" }}>Hero Feature</span>
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", lineHeight: 1.2, marginBottom: 12 }}>
              Meet your AI Employee.
            </h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", lineHeight: 1.75, maxWidth: 560, marginBottom: 24 }}>
              Not a chatbot. Not a report. An AI that works across your entire stack — production monitoring, feature development, and ML experimentation. It reads your live spend data, flags every inefficiency, and delivers concrete recommendations to cut cost and improve latency — with copy-paste code. Instantly when you ask. Automatically on a schedule. And proactively the moment something goes wrong.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
              {[
                { icon: "⚡", title: "Instant recommendations", body: "Ask anything and get a specific, actionable fix — lower latency, reduced cost, better caching — backed by your real call data, not generic advice." },
                { icon: "🗓️", title: "Scheduled recommendations", body: "Every morning a digest surfaces new inefficiencies found overnight: which features regressed, which models to swap, and the estimated savings for each fix." },
                { icon: "🧪", title: "Experiment compare", body: "Ask 'which prompt version was cheapest?' or 'compare model A vs B for this feature' — backed by real run data, not estimates." },
                { icon: "🔔", title: "Threshold alerts", body: "Costs or latency spiking in prod or in a dev run? The AI Employee detects it, explains the root cause, and pushes a fix before you notice." },
              ].map((f) => (
                <div key={f.title} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 18px", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: 20, marginBottom: 10 }}>{f.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 7, fontFamily: "'DM Sans', system-ui" }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.62)", lineHeight: 1.7, fontFamily: "'DM Sans', system-ui" }}>{f.body}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "'DM Sans', system-ui" }}>Powered by</span>
              {[
                { label: "Gemini 2.0 Flash", color: "#1A73E8", note: "live in MVP" },
                { label: "Claude Sonnet",    color: "#CC5500", note: "roadmap"     },
              ].map((m) => (
                <span key={m.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: `${m.color}25`, color: m.color, border: `1px solid ${m.color}40`, fontFamily: "'DM Sans', system-ui", fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', system-ui" }}>{m.note}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* What TokenSense tracks */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 8 }}>What TokenSense Tracks</h2>
          <p style={{ fontSize: 14, color: C.inkLight, marginBottom: 20 }}>Tag any call with a feature, unit, or workflow ID. TokenSense aggregates cost across every dimension you care about.</p>

          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>

            {/* Tracking dimensions */}
            {[
              {
                category: "By feature",
                color: C.accent,
                example: "feature: 'game_analysis'",
                desc: "Which product feature is costing the most? See spend, call count, avg cost/call, and flags per feature — across all providers and models.",
                tags: ["game_analysis", "coaching_insights", "match_prediction", "commentary_gen"],
              },
              {
                category: "By unit  ($/match, $/user, $/report)",
                color: C.anthropic,
                example: "unitId: matchId",
                desc: "Tag calls with a business unit — a match ID, user ID, or job ID. TokenSense computes the total AI cost per unit so you know your exact unit economics.",
                tags: ["match_4821 → $0.0043", "match_3309 → $0.0061", "user_9912 → $0.12/mo"],
              },
              {
                category: "By workflow / agent chain",
                color: C.gemini,
                example: "feature: 'onboarding_flow'",
                desc: "Multi-step agent workflows span many calls. Tag each step with the same workflow ID to see the total cost of the full chain — not just individual calls.",
                tags: ["onboarding_flow", "data_pipeline", "nightly_digest", "match_recap"],
              },
              {
                category: "By app / team",
                color: C.inkMid,
                example: "projectId: 'dream-play'",
                desc: "Multiple apps or teams share one dashboard. Each project gets its own view, its own API key, and its own agent context. Compare spend across products.",
                tags: ["dream-play", "dream11", "fancode", "internal-tools"],
              },
              {
                category: "By model & provider",
                color: C.ink,
                example: "provider: 'gemini', model: 'gemini-2.0-flash'",
                desc: "See exactly how much each model costs you across all features. Identify where you're over-modelling (using Opus for tasks that only need Flash).",
                tags: ["gemini-2.0-flash", "claude-sonnet-4", "gpt-4o-mini", "gemini-1.5-pro"],
              },
              {
                category: "Dev & ML experiments",
                color: "#7c3aed",
                example: "environment: 'experiment', experimentId: 'prompt_v3_vs_v4'",
                desc: "Not just for production. Tag calls with an experiment ID while building new features, tuning prompts, or evaluating models. Compare the real cost of each iteration — before it ships.",
                tags: ["prompt_v3_vs_v4", "model_eval_q1", "company_new_feature", "ml_pipeline_test"],
              },
            ].map((row, i, arr) => (
              <div key={row.category} style={{ padding: "20px 24px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: row.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{row.category}</span>
                    </div>
                    <p style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7, marginBottom: 10 }}>{row.desc}</p>
                    <code style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", background: C.tag, padding: "3px 8px", borderRadius: 4, color: row.color }}>{row.example}</code>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "flex-start", paddingTop: 2 }}>
                    {row.tags.map((t) => (
                      <span key={t} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: `${row.color}10`, color: row.color, border: `1px solid ${row.color}25`, fontFamily: "'DM Sans', system-ui", fontWeight: 500, whiteSpace: "nowrap" }}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — togglable MVP / Full Product */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif" }}>How It Works</h2>
            {/* Toggle */}
            <div style={{ display: "flex", background: C.paper, border: `1px solid ${C.border}`, borderRadius: 8, padding: 3, gap: 3 }}>
              {(["mvp", "full"] as const).map((v) => (
                <button key={v} onClick={() => setHowItWorksView(v)} style={{
                  background: howItWorksView === v ? C.ink : "transparent",
                  color: howItWorksView === v ? "#fff" : C.inkMid,
                  border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 12,
                  cursor: "pointer", fontFamily: "'DM Sans', system-ui", fontWeight: 500,
                  transition: "all 0.15s",
                }}>
                  {v === "mvp" ? "MVP (today)" : "Full product"}
                </button>
              ))}
            </div>
          </div>

          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "28px 24px" }}>

            {howItWorksView === "mvp" ? (
              <>
                {/* MVP flow */}
                <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "'DM Mono', monospace", marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase" }}>Data flow · MVP</div>
                <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 8 }}>
                  {FLOW.map((node, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ padding: "12px 16px", background: `${node.color}10`, border: `1.5px solid ${node.color}30`, borderRadius: 8, textAlign: "center" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: node.color }}>{node.label}</div>
                        <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2 }}>{node.sub}</div>
                      </div>
                      {i < FLOW.length - 1 && <div style={{ fontSize: 16, color: C.inkLight, margin: "0 8px" }}>→</div>}
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                { step: "1", title: "Make your LLM call", body: "Your app calls Anthropic or Gemini as normal. No SDK, no wrapper — nothing changes in how you talk to the API." },
                { step: "2", title: "Fire a manual fetch", body: "After each call, post a lightweight payload to POST /api/ingest with the model, tokens, feature tag, and unit ID. Fire-and-forget — one line, no await." },
                { step: "3", title: "Visualise + act", body: "Cost by feature, by provider, and by match appears in the dashboard instantly. Ask the AI Employee to audit, explain a flag, or generate a fix." },

                  ].map((s) => (
                    <div key={s.step} style={{ padding: "14px 16px", background: C.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.inkLight, marginBottom: 6 }}>Step {s.step}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 7 }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7 }}>{s.body}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Full product flow — two-row diagram */}
                <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "'DM Mono', monospace", marginBottom: 16, letterSpacing: "0.06em", textTransform: "uppercase" }}>Data flow · Full product</div>

                {/* Row 1: ingestion path */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: C.inkLight, fontFamily: "'DM Sans', system-ui", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>Ingestion path</div>
                  <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 4 }}>
                    {[
                      { label: "Your App",        sub: "Any language",           color: C.inkLight  },
                      { label: "TokenSense SDK",  sub: "npm / pip · 2 lines",    color: C.ink       },
                      { label: "Anthropic API",   sub: "Claude",                 color: C.anthropic },
                      { label: "Gemini API",      sub: "Flash / Pro",            color: C.gemini    },
                      { label: "OpenAI API",      sub: "GPT-4o",                 color: C.openai    },
                      { label: "Ingest API",      sub: "async · non-blocking",   color: C.accent    },
                      { label: "ClickHouse",      sub: "time-series · billions", color: C.inkMid    },
                    ].map((node, i, arr) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {i === 2 && <div style={{ fontSize: 13, color: C.inkLight, margin: "0 6px" }}>⎡</div>}
                        <div style={{ padding: "10px 14px", background: `${node.color}10`, border: `1.5px solid ${node.color}30`, borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: node.color }}>{node.label}</div>
                          <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2 }}>{node.sub}</div>
                        </div>
                        {i === 4 && <div style={{ fontSize: 13, color: C.inkLight, margin: "0 6px" }}>⎦</div>}
                        {i !== 1 && i !== 3 && i < arr.length - 1 && <div style={{ fontSize: 15, color: C.inkLight, margin: "0 6px" }}>→</div>}
                        {i === 1 && <div style={{ fontSize: 15, color: C.inkLight, margin: "0 6px" }}>→</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Row 2: intelligence path */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, color: C.inkLight, fontFamily: "'DM Sans', system-ui", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>Intelligence path</div>
                  <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 4 }}>
                    {[
                      { label: "ClickHouse",        sub: "aggregation queries",    color: C.inkMid    },
                      { label: "Dashboard API",     sub: "GET /api/calls",         color: C.accent    },
                      { label: "Dashboard",         sub: "cost · flags · $/match", color: C.gemini    },
                      { label: "Agent (Gemini)",    sub: "2.0 Flash · streaming",  color: C.gemini    },
                      { label: "Agent (Claude)",    sub: "Sonnet · deep reasoning", color: C.anthropic },
                      { label: "Alerts",            sub: "Slack · threshold · cron", color: C.warn    },
                    ].map((node, i, arr) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                        {i === 3 && <div style={{ fontSize: 13, color: C.inkLight, margin: "0 6px" }}>⎡</div>}
                        <div style={{ padding: "10px 14px", background: `${node.color}10`, border: `1.5px solid ${node.color}30`, borderRadius: 8, textAlign: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: node.color }}>{node.label}</div>
                          <div style={{ fontSize: 10, color: C.inkLight, marginTop: 2 }}>{node.sub}</div>
                        </div>
                        {i === 4 && <div style={{ fontSize: 13, color: C.inkLight, margin: "0 6px" }}>⎦</div>}
                        {i !== 4 && i < arr.length - 1 && <div style={{ fontSize: 15, color: C.inkLight, margin: "0 6px" }}>→</div>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3-column summary */}
                <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  {[
                    { title: "Any provider", body: "The SDK wraps Anthropic, Gemini, OpenAI, and Cohere through a single unified interface. Switching providers doesn't change your tracking setup." },
                    { title: "Zero latency impact", body: "Telemetry is always fire-and-forget — batched in memory, flushed async every 2s. ClickHouse handles the storage scale so your app never slows down." },
                    { title: "Dual-model AI Employee", body: "Gemini Flash for instant recommendations, Claude Sonnet for deeper analysis. Both deliver cost + latency fixes — on demand, on a daily schedule, or triggered by anomalies." },
                  ].map((s) => (
                    <div key={s.title} style={{ padding: "14px 16px", background: C.bg, borderRadius: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 7 }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: C.inkMid, lineHeight: 1.7 }}>{s.body}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* MVP feature list */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 8 }}>MVP Scope</h2>
          <p style={{ fontSize: 14, color: C.inkLight, marginBottom: 20 }}>What is built and running today vs. what comes next.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MVP_FEATURES.map((f) => (
              <div key={f.title} style={{ background: C.paper, border: `1.5px solid ${f.done ? C.border : C.border}`, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start", opacity: f.done ? 1 : 0.65 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: f.done ? C.accent : C.tag, border: `1.5px solid ${f.done ? C.accent : C.borderDark}`, color: f.done ? "#fff" : C.inkLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, marginTop: 1 }}>
                  {f.done ? "✓" : "·"}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: f.done ? C.ink : C.inkMid }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.65 }}>{f.detail}</div>
                </div>
                <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: f.done ? `${C.accent}15` : C.tag, color: f.done ? C.accent : C.inkLight, fontWeight: 600 }}>
                    {f.done ? "Live" : "Roadmap"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 20 }}>Tech Stack</h2>
          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            {STACK.map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", padding: "14px 20px", borderBottom: i < STACK.length - 1 ? `1px solid ${C.border}` : "none", gap: 16 }}>
                <div style={{ width: 110, fontSize: 12, fontWeight: 600, color: C.inkLight, textTransform: "uppercase", letterSpacing: "0.07em", flexShrink: 0 }}>{s.label}</div>
                <div style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", color: s.color, fontWeight: 500 }}>{s.value}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Roadmap phases */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 20 }}>5-Phase Roadmap</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PHASES.map((p) => (
              <div key={p.num} style={{ background: C.paper, border: `1.5px solid ${p.done ? p.color + "40" : C.border}`, borderRadius: 10, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: p.color, fontWeight: 500, width: 28, flexShrink: 0 }}>{p.num}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: C.inkLight }}>{p.detail}</div>
                </div>
                <div style={{ fontSize: 11, color: C.inkLight, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{p.duration}</div>
                <div style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20, background: p.done ? `${p.color}15` : C.tag, color: p.done ? p.color : C.inkLight, fontWeight: 600, border: `1px solid ${p.done ? p.color + "30" : C.border}` }}>
                    {p.done ? "Built" : "Upcoming"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Integration snippet */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 16 }}>Integration</h2>
          <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "24px" }}>
            <div style={{ fontSize: 13, color: C.inkLight, marginBottom: 12 }}>Today: one manual fetch after each LLM call. After SDK ships: 2 lines total, fully automatic.</div>
            <pre style={{ background: C.tag, borderRadius: 8, padding: "16px 18px", fontSize: 12, fontFamily: "'DM Mono', monospace", color: C.inkMid, lineHeight: 1.8, overflowX: "auto" }}>{`// TODAY (MVP) — add after any LLM call, fire and forget
const start = Date.now();
const response = await gemini.generateContent({ ... });

fetch("http://localhost:1010/api/ingest", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ calls: [{
    projectId: "dream-play",
    feature:   "game_analysis",
    provider:  "gemini",
    model:     "gemini-2.0-flash",
    inputTokens:  response.usageMetadata.promptTokenCount,
    outputTokens: response.usageMetadata.candidatesTokenCount,
    latencyMs: Date.now() - start,
    unitId:    matchId,
  }]}),
}).catch(() => {}); // never blocks your app

// AFTER SDK SHIPS — replaces everything above
import { TokenSense } from "tokensense";
const gemini = TokenSense.wrap(new GoogleGenerativeAI(key), {
  apiKey: "ts_live_...", project: "dream-play"
});`}</pre>
            <div style={{ marginTop: 16, display: "flex", gap: 20, flexWrap: "wrap" }}>
              {[
                { label: "Today (MVP)", body: "One manual fetch after each LLM call. Paste it once per call site, fire-and-forget. Data appears in the dashboard within seconds." },
                { label: "After SDK", body: "npm install tokensense → wrap client → every call tracked automatically. The manual fetch code above is deleted entirely." },
              ].map((c) => (
                <div key={c.label} style={{ flex: 1, minWidth: 200, padding: "12px 14px", background: C.bg, borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.inkMid, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>{c.label}</div>
                  <div style={{ fontSize: 13, color: C.inkLight, lineHeight: 1.65 }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works — full product, future perspective */}
        <section>
          <h2 style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 8 }}>How It Works — Full Product</h2>
          <p style={{ fontSize: 14, color: C.inkLight, marginBottom: 24 }}>When all five phases are live, this is the complete end-to-end experience.</p>

          {/* Timeline steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              {
                num: "01",
                actor: "Developer",
                title: "Install the SDK and wrap your client",
                color: C.ink,
                body: "One npm install and two lines of code. The SDK wraps your existing Anthropic, Gemini, or OpenAI client using a JavaScript Proxy — your app code changes nothing else. Every subsequent call is intercepted automatically.",
                code: `import { TokenSense } from "tokensense";\nconst client = TokenSense.wrap(new Anthropic(), { apiKey: "ts_live_...", project: "dream-play" });`,
              },
              {
                num: "02",
                actor: "SDK",
                title: "Intercept, measure, and emit — non-blocking",
                color: C.inkMid,
                body: "The wrapper captures input/output token counts, model, latency, and your custom feature and unit tags. It forwards the original call to the provider at full speed, then queues a lightweight telemetry payload in memory and flushes it to the ingestion API every 2 seconds in the background. Your app never waits for this.",
                code: `// Zero latency added to your critical path\ntelemetryQueue.push(payload);\nif (queue.length >= 50) flushQueue(); // fire-and-forget`,
              },
              {
                num: "03",
                actor: "Ingestion API",
                title: "Receive, enrich, and store every call",
                color: C.accent,
                body: "The ingestion endpoint receives batched payloads, runs rule-based flag detection (static_prompt_not_cached, overmodeled, should_batch), computes exact cost from the pricing table, and writes to ClickHouse — a columnar database that handles billions of rows with sub-second aggregation queries.",
                code: `POST /v1/batch → validate → detectFlags() → computeCost() → ClickHouse.insert()`,
              },
              {
                num: "04",
                actor: "Dashboard",
                title: "See cost by feature, provider, and match — live",
                color: C.gemini,
                body: "The dashboard auto-refreshes every 30 seconds. You see total spend, a breakdown by feature (game_analysis vs coaching_insights vs match_prediction), which provider each dollar went to, and — uniquely for [Company] — cost per match. Every flagged call is surfaced in the calls table with the specific issue.",
                code: `// $/match — the metric that tracks unit economics as you scale\nSELECT unit_id, sum(cost_usd) FROM api_calls GROUP BY unit_id;`,
              },
              {
                num: "05",
                actor: "Agent",
                title: "Ask the agent to audit, explain, and fix",
                color: C.anthropic,
                body: "The optimization agent (Gemini 2.0 Flash, or Claude Sonnet when toggled) receives your live project data — actual spend numbers, top cost drivers, all active flags — injected into its system prompt. Ask it to audit your costs and it returns the top 3 savings opportunities with exact dollar estimates. Ask for a fix and it returns copy-paste-ready code.",
                code: `You: "Audit my costs"\nAgent: "1. game_analysis: enable prompt caching → saves ~$0.20/day (60%)\n        2. match_prediction: switch gemini-1.5-pro → flash → saves ~$0.14/day\n        3. coaching_insights: batch requests → saves ~$0.04/day"`,
              },
              {
                num: "06",
                actor: "Alerts",
                title: "Threshold alerts and scheduled digests fire automatically",
                color: C.warn,
                body: "Once the scheduled agent modes are live, you stop needing to check the dashboard manually. A 9am daily digest surfaces new issues. A threshold trigger fires when cost-per-match crosses your set limit — the agent auto-generates an explanation and a recommended fix, delivered to Slack.",
                code: `// Fires when avg $/match > threshold\nif (avgCostPerMatch > LIMIT) {\n  await agent.audit(project); // → Slack digest\n}`,
              },
            ].map((step, i, arr) => (
              <div key={step.num} style={{ display: "flex", gap: 0 }}>
                {/* Timeline spine */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 20, flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: step.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontFamily: "'DM Mono', monospace", fontWeight: 700, flexShrink: 0 }}>{step.num}</div>
                  {i < arr.length - 1 && <div style={{ width: 1, flex: 1, background: C.border, margin: "6px 0" }} />}
                </div>
                {/* Content */}
                <div style={{ flex: 1, paddingBottom: i < arr.length - 1 ? 32 : 0 }}>
                  <div style={{ fontSize: 12, color: step.color, fontFamily: "'DM Sans', system-ui", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{step.actor}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 10, color: C.ink }}>{step.title}</div>
                  <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.75, marginBottom: 12 }}>{step.body}</p>
                  <pre style={{ background: C.tag, border: `1px solid ${C.border}`, borderRadius: 7, padding: "11px 14px", fontSize: 11.5, fontFamily: "'DM Mono', monospace", color: C.inkMid, lineHeight: 1.7, overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{step.code}</pre>
                </div>
              </div>
            ))}
          </div>

          {/* Footer CTA */}
          <div style={{ marginTop: 40, padding: "22px 24px", background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>Steps 03–05 are live in this MVP.</div>
              <div style={{ fontSize: 14, color: C.inkLight }}>SDK (01–02) and alerts (06) are Phase 1 and Phase 5 of the roadmap.</div>
            </div>
            <Link href="/" style={{ background: C.ink, color: "#fff", borderRadius: 8, padding: "10px 22px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Open Dashboard →
            </Link>
          </div>
        </section>

        </>)}
      </div>
    </div>
  );
}

// ─── Competitive Landscape ────────────────────────────────────────────────────
function CompetitiveLandscape() {
  const COMPETITORS = [
    {
      name: "Helicone",
      tier: "Observability",
      tagline: "Best analytics & semantic caching",
      pricing: "$20/mo (50K req free)",
      setup: "Proxy — change base URL",
      costByFeature: true,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: false,
      devMLExperiments: false,
      scheduledRecs: false,
      selfHost: true,
      color: "#FF6B6B",
    },
    {
      name: "Langfuse",
      tier: "Observability",
      tagline: "Open-source, self-hosted",
      pricing: "Free (self-hosted) / $29/mo",
      setup: "SDK — manual instrumentation",
      costByFeature: true,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: true,
      devMLExperiments: true,
      scheduledRecs: false,
      selfHost: true,
      color: "#4ECDC4",
    },
    {
      name: "LangSmith",
      tier: "Observability",
      tagline: "LangChain-native tracing",
      pricing: "$39/mo",
      setup: "LangChain only (auto) or manual",
      costByFeature: true,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: true,
      devMLExperiments: true,
      scheduledRecs: false,
      selfHost: false,
      color: "#A8DADC",
    },
    {
      name: "Portkey",
      tier: "Gateway",
      tagline: "AI gateway, 250+ models",
      pricing: "$49/mo",
      setup: "Proxy — route all traffic",
      costByFeature: true,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: false,
      devMLExperiments: false,
      scheduledRecs: false,
      selfHost: true,
      color: "#FFB347",
    },
    {
      name: "Tokenr",
      tier: "Cost tracking",
      tagline: "Attribution by feature/team",
      pricing: "Freemium",
      setup: "SDK — auto-patch",
      costByFeature: true,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: true,
      devMLExperiments: false,
      scheduledRecs: false,
      selfHost: false,
      color: "#C3B1E1",
    },
    {
      name: "Costrace",
      tier: "Cost tracking",
      tagline: "2-line setup, real-time cost",
      pricing: "Free / $19/mo",
      setup: "SDK — 2 lines",
      costByFeature: false,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: true,
      devMLExperiments: false,
      scheduledRecs: false,
      selfHost: false,
      color: "#B5EAD7",
    },
    {
      name: "OpenMeter",
      tier: "Billing infra",
      tagline: "Meter usage to bill your customers",
      pricing: "Free / usage-based (now Kong)",
      setup: "CloudEvents SDK + Kafka pipeline",
      costByFeature: false,
      unitEconomics: false,
      aiAgent: false,
      codeRecommendations: false,
      noProxy: true,
      devMLExperiments: false,
      scheduledRecs: false,
      selfHost: true,
      color: "#6C8EBF",
      note: "Outward-facing: bills your customers for their AI usage. Not inward-facing cost intelligence.",
    },
    {
      name: "TokenSense",
      tier: "Intelligence",
      tagline: "Observe + act, not just watch",
      pricing: "Free (MVP) / $49/mo (Pro)",
      setup: "Fire-and-forget fetch, no proxy",
      costByFeature: true,
      unitEconomics: true,
      aiAgent: true,
      codeRecommendations: true,
      noProxy: true,
      devMLExperiments: true,
      scheduledRecs: true,
      selfHost: true,
      color: C.ink,
      isUs: true,
    },
  ];

  const FEATURES: { key: keyof typeof COMPETITORS[0]; label: string; description: string }[] = [
    { key: "costByFeature",       label: "Cost by feature",              description: "Break down spend by product feature" },
    { key: "unitEconomics",       label: "Unit economics ($/match)",      description: "Total AI cost per business unit — match, user, report" },
    { key: "noProxy",             label: "No proxy required",             description: "Traffic stays in your infra, no re-routing" },
    { key: "aiAgent",             label: "AI agent on your data",         description: "Conversational AI that reads your live spend" },
    { key: "codeRecommendations", label: "Code fix recommendations",      description: "Returns copy-paste code to act on issues" },
    { key: "scheduledRecs",       label: "Scheduled daily digest",        description: "Auto-surfaces issues every morning without prompting" },
    { key: "devMLExperiments",    label: "Dev & ML experiment tracking",  description: "Compare real cost of prompt/model iterations pre-ship" },
    { key: "selfHost",            label: "Self-hostable",                  description: "Run on your own infra (not unique — many offer this)" },
  ];

  const DIFFERENTIATORS = [
    {
      title: "Everyone shows a dashboard. Nobody acts on it.",
      icon: "🤖",
      color: C.ink,
      body: "Every existing tool — Helicone, Langfuse, LangSmith, Portkey — shows you charts. The insight stops there. TokenSense goes further: an AI Employee reads your live data, audits it, and returns specific fixes with copy-paste code. The jump from observation to action is what none of them make.",
      competitors: ["Helicone", "Langfuse", "LangSmith", "Portkey", "Tokenr", "Costrace"],
      competitorNote: "All show dashboards",
      tsNote: "AI Employee returns actionable code",
    },
    {
      title: "Unit economics is a completely missing concept.",
      icon: "📐",
      color: C.anthropic,
      body: "Every tool tracks cost per API key, per user, or per feature. None of them track the cost per business unit — what does one match cost us in AI? What does one report generation cost? For products like [Company] where the core product unit is a match, this metric is the only one that matters for pricing decisions. TokenSense built it in from day one.",
      competitors: ["Helicone", "Langfuse", "LangSmith", "Portkey", "Tokenr", "Costrace"],
      competitorNote: "No $/unit concept",
      tsNote: "First-class $/match, $/user, $/report tracking",
    },
    {
      title: "Default integration is a proxy sitting between you and your provider.",
      icon: "🔌",
      color: C.gemini,
      body: "Helicone and Portkey's primary integration routes all LLM traffic through their proxy servers. Both offer self-hosting to mitigate this, but the core architecture still intercepts your calls. TokenSense uses a fundamentally different model: your app calls Gemini or Anthropic directly at full speed, and telemetry is queued and flushed in the background. No interception, no latency added to the critical path.",
      competitors: ["Helicone", "Portkey"],
      competitorNote: "Proxy-first architecture (self-host available)",
      tsNote: "Direct provider calls, async fire-and-forget telemetry",
    },
    {
      title: "Recommendations that ship on a schedule, not just when you ask.",
      icon: "🗓️",
      color: C.accent,
      body: "Every tool is reactive — you open a dashboard when something feels expensive. TokenSense is the only platform with a scheduled intelligence loop: a daily 9am digest that surfaces new regressions and savings opportunities you didn't think to look for. Plus threshold alerts that fire the moment cost-per-match crosses your limit — no monitoring required.",
      competitors: ["Helicone", "Langfuse", "LangSmith", "Portkey", "Tokenr", "Costrace"],
      competitorNote: "Manual dashboard review only",
      tsNote: "Scheduled digest + threshold triggers",
    },
    {
      title: "Experiment cost comparison exists — but only in the expensive tiers.",
      icon: "🧪",
      color: C.purple,
      body: "Langfuse and LangSmith both support prompt versioning and can show cost per experiment run — credit where it's due. But this is buried in their evaluation workflows and requires their full tracing SDK. Helicone, Portkey, Tokenr, and Costrace have no experiment comparison at all. TokenSense makes it a first-class concept: tag any call with experimentId, compare real cost and latency of v1 vs v2 in the dashboard, and project the difference at 10K calls/day — without needing a full tracing pipeline.",
      competitors: ["Langfuse", "LangSmith"],
      competitorNote: "Have prompt versioning + cost per run (via eval workflows)",
      tsNote: "First-class experimentId tag + projected cost at scale",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 40, borderBottom: `1px solid ${C.border}`, paddingBottom: 36 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.15em", color: C.inkLight, textTransform: "uppercase", marginBottom: 16, fontFamily: "'DM Sans', system-ui" }}>
          Competitive Analysis · March 2026
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", lineHeight: 1.1, letterSpacing: "-1px", marginBottom: 20, color: C.ink }}>
          The landscape is full of dashboards.<br />TokenSense is the one that acts.
        </h1>
        <p style={{ fontSize: 16, color: C.inkMid, lineHeight: 1.8, maxWidth: 680 }}>
          Six tools cover LLM observability in 2026. They all show you what happened. TokenSense is the only one that tells you what to do about it — with an AI that reads your live data, returns copy-paste code, and checks in every morning without being asked.
        </p>
      </div>

      {/* Feature comparison table */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 6 }}>Feature matrix</h2>
        <p style={{ fontSize: 14, color: C.inkLight, marginBottom: 20 }}>Based on publicly documented capabilities as of March 2026.</p>

        <div style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, overflow: "hidden", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: C.tag, borderBottom: `1.5px solid ${C.border}` }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.inkLight, letterSpacing: "0.08em", textTransform: "uppercase", width: 140 }}>Tool</th>
                {FEATURES.map((f) => (
                  <th key={f.key} style={{ padding: "12px 10px", textAlign: "center", fontSize: 11, fontWeight: 700, color: C.inkLight, letterSpacing: "0.06em", textTransform: "uppercase", minWidth: 100 }}>
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((c, i) => (
                <tr key={c.name} style={{
                  borderBottom: i < COMPETITORS.length - 1 ? `1px solid ${C.border}` : "none",
                  background: c.isUs ? `${C.ink}06` : "transparent",
                }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: c.isUs ? 700 : 600, color: c.isUs ? C.ink : C.inkMid }}>
                          {c.name} {c.isUs && <span style={{ fontSize: 10, color: C.accent, fontWeight: 700, background: `${C.accent}15`, padding: "1px 5px", borderRadius: 4, marginLeft: 4 }}>us</span>}
                        </div>
                        <div style={{ fontSize: 11, color: C.inkLight, marginTop: 1 }}>{c.tier}</div>
                      </div>
                    </div>
                  </td>
                  {FEATURES.map((f) => {
                    const val = c[f.key as keyof typeof c] as boolean;
                    return (
                      <td key={f.key} style={{ padding: "12px 10px", textAlign: "center" }}>
                        {val
                          ? <span style={{ fontSize: 16, color: c.isUs ? C.accent : C.inkMid }}>✓</span>
                          : <span style={{ fontSize: 14, color: C.border }}>—</span>
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Quick profiles */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 20 }}>Competitor profiles</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {COMPETITORS.filter((c) => !c.isUs).map((c) => (
            <div key={c.name} style={{ background: C.paper, border: `1.5px solid ${"note" in c ? C.gemini + "30" : C.border}`, borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color }} />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{c.name}</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: C.inkLight, background: C.tag, padding: "1px 7px", borderRadius: 4, fontWeight: 500 }}>{c.tier}</span>
              </div>
              <div style={{ fontSize: 13, color: C.inkMid, fontStyle: "italic", marginBottom: 10 }}>{c.tagline}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.inkLight, width: 44, flexShrink: 0 }}>Price</span>
                  <span style={{ fontSize: 12, color: C.inkMid, fontFamily: "'DM Mono', monospace" }}>{c.pricing}</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.inkLight, width: 44, flexShrink: 0 }}>Setup</span>
                  <span style={{ fontSize: 12, color: C.inkMid }}>{c.setup}</span>
                </div>
                {"note" in c && c.note && (
                  <div style={{ marginTop: 6, fontSize: 12, color: C.gemini, background: `${C.gemini}08`, border: `1px solid ${C.gemini}20`, borderRadius: 6, padding: "6px 8px", lineHeight: 1.5 }}>
                    {c.note as string}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Where we differ — deep dives */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 6 }}>Where we differ</h2>
        <p style={{ fontSize: 14, color: C.inkLight, marginBottom: 24 }}>Five gaps in the existing market that TokenSense specifically addresses.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {DIFFERENTIATORS.map((d, i) => (
            <div key={i} style={{ background: C.paper, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "22px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{d.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", marginBottom: 10, color: C.ink }}>{d.title}</div>
                  <p style={{ fontSize: 14, color: C.inkMid, lineHeight: 1.75, marginBottom: 14 }}>{d.body}</p>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {/* Competitors */}
                    <div style={{ padding: "10px 14px", background: `${C.warn}08`, border: `1px solid ${C.warn}20`, borderRadius: 8, flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.warn, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                        {d.competitors.join(", ")}
                      </div>
                      <div style={{ fontSize: 13, color: C.inkMid }}>{d.competitorNote}</div>
                    </div>
                    {/* TokenSense */}
                    <div style={{ padding: "10px 14px", background: `${C.accent}08`, border: `1px solid ${C.accent}25`, borderRadius: 8, flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                        TokenSense
                      </div>
                      <div style={{ fontSize: 13, color: C.inkMid }}>{d.tsNote}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Positioning statement */}
      <section>
        <div style={{ background: C.ink, borderRadius: 14, padding: "32px 36px", color: "#fff" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.45)", marginBottom: 16 }}>Positioning</div>
          <h2 style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Libre Baskerville', Georgia, serif", lineHeight: 1.3, marginBottom: 16 }}>
            The existing category is observability.<br />TokenSense is optimization intelligence.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", lineHeight: 1.8, maxWidth: 640, marginBottom: 24 }}>
            Observability tools answer "what happened?" TokenSense answers "what do you do about it?" — with an AI that audits your spend, returns code, tracks your unit economics per business unit, and checks in automatically every morning. The existing tools are monitors. TokenSense is an employee.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            {[
              { label: "Competitors", value: "7 tools", sub: "Helicone, Langfuse, LangSmith,\nPortkey, Tokenr, Costrace, OpenMeter" },
              { label: "Features none of them have", value: "4 unique", sub: "AI agent with code, unit economics,\nscheduled recs, cost projection at scale" },
              { label: "Closest to us", value: "Helicone", sub: "Best analytics of the group, but\nstill dashboard-only, proxy-based" },
            ].map((s) => (
              <div key={s.label} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5, whiteSpace: "pre-line" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
