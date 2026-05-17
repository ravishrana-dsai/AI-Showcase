import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "tokensense.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  _db.exec(schema);
  return _db;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TSCall {
  provider: "anthropic" | "openai" | "gemini" | "cohere";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUSD?: number;
  latencyMs: number;
  feature?: string;
  unitId?: string;
  projectId: string;
  timestamp?: string;
  flags?: string[];
}

export interface CallRow {
  id: number;
  project_id: string;
  feature: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  flags: string;
  unit_id: string;
  ts: string;
}

export interface FeatureStat {
  feature: string;
  total_cost: number;
  call_count: number;
  avg_cost: number;
  avg_latency: number;
}

export interface ProviderStat {
  provider: string;
  total_cost: number;
  call_count: number;
  pct: number;
}

export interface ModelStat {
  model: string;
  provider: string;
  total_cost: number;
  call_count: number;
}

export interface ProjectStats {
  totalCost: number;
  callCount: number;
  avgLatency: number;
  byFeature: FeatureStat[];
  byProvider: ProviderStat[];
  byModel: ModelStat[];
  recentCalls: CallRow[];
  flaggedCount: number;
}

// ─── Insert ───────────────────────────────────────────────────────────────────

export type EnrichedCall = TSCall & { costUSD: number; flags: string[] };

export function insertCalls(calls: EnrichedCall[]) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO api_calls
      (project_id, feature, provider, model, input_tokens, output_tokens,
       cost_usd, latency_ms, flags, unit_id, ts)
    VALUES
      (@project_id, @feature, @provider, @model, @input_tokens, @output_tokens,
       @cost_usd, @latency_ms, @flags, @unit_id, @ts)
  `);

  const insertMany = db.transaction((rows: EnrichedCall[]) => {
    for (const c of rows) {
      stmt.run({
        project_id: c.projectId,
        feature: c.feature ?? "unknown",
        provider: c.provider,
        model: c.model,
        input_tokens: c.inputTokens,
        output_tokens: c.outputTokens,
        cost_usd: c.costUSD,
        latency_ms: c.latencyMs,
        flags: JSON.stringify(c.flags),
        unit_id: c.unitId ?? "",
        ts: c.timestamp ?? new Date().toISOString(),
      });
    }
  });

  insertMany(calls);
}

// ─── Range helper ─────────────────────────────────────────────────────────────

function rangeToInterval(range: string): string {
  const map: Record<string, string> = {
    "1h":  "datetime('now', '-1 hour')",
    "6h":  "datetime('now', '-6 hours')",
    "24h": "datetime('now', '-1 day')",
    "7d":  "datetime('now', '-7 days')",
    "30d": "datetime('now', '-30 days')",
  };
  return map[range] ?? map["24h"];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getProjectStats(projectId: string, range = "24h"): ProjectStats {
  const db = getDb();
  const since = rangeToInterval(range);

  const totalRow = db.prepare(`
    SELECT
      COALESCE(SUM(cost_usd), 0)   AS total_cost,
      COUNT(*)                      AS call_count,
      COALESCE(AVG(latency_ms), 0) AS avg_latency
    FROM api_calls
    WHERE project_id = ? AND ts >= ${since}
  `).get(projectId) as { total_cost: number; call_count: number; avg_latency: number };

  const byFeature = db.prepare(`
    SELECT
      feature,
      SUM(cost_usd)  AS total_cost,
      COUNT(*)       AS call_count,
      AVG(cost_usd)  AS avg_cost,
      AVG(latency_ms) AS avg_latency
    FROM api_calls
    WHERE project_id = ? AND ts >= ${since}
    GROUP BY feature
    ORDER BY total_cost DESC
  `).all(projectId) as FeatureStat[];

  const byProviderRaw = db.prepare(`
    SELECT
      provider,
      SUM(cost_usd) AS total_cost,
      COUNT(*)      AS call_count
    FROM api_calls
    WHERE project_id = ? AND ts >= ${since}
    GROUP BY provider
    ORDER BY total_cost DESC
  `).all(projectId) as Omit<ProviderStat, "pct">[];

  const totalForPct = byProviderRaw.reduce((s, r) => s + r.total_cost, 0) || 1;
  const byProvider: ProviderStat[] = byProviderRaw.map((r) => ({
    ...r,
    pct: Math.round((r.total_cost / totalForPct) * 1000) / 10,
  }));

  const byModel = db.prepare(`
    SELECT
      model,
      provider,
      SUM(cost_usd) AS total_cost,
      COUNT(*)      AS call_count
    FROM api_calls
    WHERE project_id = ? AND ts >= ${since}
    GROUP BY model, provider
    ORDER BY total_cost DESC
    LIMIT 10
  `).all(projectId) as ModelStat[];

  const recentCalls = db.prepare(`
    SELECT * FROM api_calls
    WHERE project_id = ?
    ORDER BY ts DESC
    LIMIT 50
  `).all(projectId) as CallRow[];

  const flaggedCount = db.prepare(`
    SELECT COUNT(*) AS cnt FROM api_calls
    WHERE project_id = ? AND ts >= ${since} AND flags != '[]'
  `).get(projectId) as { cnt: number };

  return {
    totalCost: totalRow.total_cost,
    callCount: totalRow.call_count,
    avgLatency: Math.round(totalRow.avg_latency),
    byFeature,
    byProvider,
    byModel,
    recentCalls,
    flaggedCount: flaggedCount.cnt,
  };
}

export function getAgentContext(projectId: string): {
  dailySpend: string;
  features: FeatureStat[];
  topFeature: string;
  topCost: string;
  models: string[];
  flags: { feature: string; issue: string }[];
} {
  const stats = getProjectStats(projectId, "24h");

  const flags: { feature: string; issue: string }[] = [];
  const db = getDb();
  const flaggedRows = db.prepare(`
    SELECT feature, flags FROM api_calls
    WHERE project_id = ? AND flags != '[]'
    ORDER BY ts DESC LIMIT 20
  `).all(projectId) as { feature: string; flags: string }[];

  const seen = new Set<string>();
  for (const row of flaggedRows) {
    try {
      const arr: string[] = JSON.parse(row.flags);
      for (const f of arr) {
        const key = `${row.feature}:${f}`;
        if (!seen.has(key)) {
          seen.add(key);
          flags.push({ feature: row.feature, issue: f });
        }
      }
    } catch {}
  }

  const models = [...new Set(stats.byModel.map((m) => m.model))];

  return {
    dailySpend: stats.totalCost.toFixed(4),
    features: stats.byFeature,
    topFeature: stats.byFeature[0]?.feature ?? "none",
    topCost: (stats.byFeature[0]?.total_cost ?? 0).toFixed(4),
    models,
    flags: flags.slice(0, 10),
  };
}
