"use client";

import { useState, useEffect, useCallback } from "react";
import Dashboard from "@/components/Dashboard";
import AgentChat from "@/components/AgentChat";
import type { ProjectStats } from "@/lib/db";

export type ProjectMode = "live" | "seed" | "compare";

const LIVE_PROJECT = "dream-play";
const SEED_PROJECT = "dream-play-seed";

const EMPTY_STATS: ProjectStats = {
  totalCost: 0,
  callCount: 0,
  avgLatency: 0,
  byFeature: [],
  byProvider: [],
  byModel: [],
  recentCalls: [],
  flaggedCount: 0,
};

export default function Home() {
  const [liveStats, setLiveStats] = useState<ProjectStats>(EMPTY_STATS);
  const [seedStats, setSeedStats] = useState<ProjectStats>(EMPTY_STATS);
  const [range, setRange]               = useState("24h");
  const [projectMode, setProjectMode]   = useState<ProjectMode>("live");
  const [loading, setLoading]           = useState(false);
  const [seeding, setSeeding]           = useState(false);
  const [clearing, setClearing]         = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const [liveRes, seedRes] = await Promise.all([
        fetch(`/api/calls?project=${LIVE_PROJECT}&range=${range}`),
        fetch(`/api/calls?project=${SEED_PROJECT}&range=${range}`),
      ]);
      if (liveRes.ok) setLiveStats(await liveRes.json());
      if (seedRes.ok) setSeedStats(await seedRes.json());
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  async function handleClearLive() {
    setClearing(true);
    try {
      await fetch(`/api/clear?project=${LIVE_PROJECT}`, { method: "DELETE" });
      await fetchStats();
      setProjectMode("live");
    } finally {
      setClearing(false);
    }
  }

  async function handleSeed() {
    setSeeding(true);
    try {
      // Always seeds into dream-play-seed
      await fetch(`/api/seed?project=${SEED_PROJECT}&count=200`, { method: "POST" });
      await fetchStats();
      // Switch to seed view so the user immediately sees the seeded data
      setProjectMode("seed");
    } finally {
      setSeeding(false);
    }
  }

  const hasNoData = liveStats.callCount === 0 && seedStats.callCount === 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: #C8C4BE; border-radius: 2px; }
      `}</style>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'DM Sans', system-ui" }}>
        {loading && hasNoData ? (
          <div style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            background: "#F7F5F0", color: "#8A8680", fontSize: 14, fontFamily: "DM Sans, system-ui",
          }}>
            Loading…
          </div>
        ) : (
          <Dashboard
            liveStats={liveStats}
            seedStats={seedStats}
            projectMode={projectMode}
            onProjectModeChange={setProjectMode}
            range={range}
            onRangeChange={(r) => setRange(r)}
            onSeed={handleSeed}
            seeding={seeding}
            onClearLive={handleClearLive}
            clearing={clearing}
          />
        )}
        <AgentChat project={LIVE_PROJECT} />
      </div>
    </>
  );
}
