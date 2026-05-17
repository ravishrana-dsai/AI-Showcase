const fs   = require('fs');
const path = require('path');
const os   = require('os');
const { calcCost } = require('./pricing');

const CLAUDE_DIR          = path.join(os.homedir(), '.claude');
const PROJECTS_DIR        = path.join(CLAUDE_DIR, 'projects');
const COWORK_SESSIONS_DIR = path.join(os.homedir(), 'Library/Application Support/Claude/local-agent-mode-sessions');
const DESKTOP_TOKENS_FILE = path.join(os.homedir(), 'Library/Application Support/Claude/buddy-tokens.json');

function getProjectDirs() {
  try {
    return fs.readdirSync(PROJECTS_DIR)
      .map(name => path.join(PROJECTS_DIR, name))
      .filter(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } });
  } catch {
    return [];
  }
}

function getJsonlFiles(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

function getJsonlFilesRecursive(root) {
  const results = [];
  function walk(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl') && full.includes('/.claude/projects/')) results.push(full);
      }
    } catch { /* skip unreadable dirs */ }
  }
  walk(root);
  return results;
}

function parseJsonlFile(filePath, product = 'Claude Code') {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return []; }

  const seen  = new Set();
  const calls = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }

    if (obj.type !== 'assistant' || !obj.message?.usage) continue;

    const { model, usage } = obj.message;
    const inputTokens      = usage.input_tokens                || 0;
    const cacheWrite5m     = usage.cache_creation?.ephemeral_5m_input_tokens || 0;
    const cacheWrite1h     = usage.cache_creation?.ephemeral_1h_input_tokens || 0;
    const cacheWriteTokens = usage.cache_creation_input_tokens || cacheWrite5m + cacheWrite1h;
    const cacheReadTokens  = usage.cache_read_input_tokens     || 0;
    const outputTokens     = usage.output_tokens               || 0;
    const ts               = obj.timestamp || new Date().toISOString();

    const key = `${ts}|${model}|${outputTokens}|${inputTokens}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Collect tool names used in this turn
    const tools = (obj.message.content || [])
      .filter(c => c.type === 'tool_use')
      .map(c => c.name);

    calls.push({
      ts, product, model: model || 'unknown',
      inputTokens, cacheWrite5m, cacheWrite1h, cacheWriteTokens, cacheReadTokens, outputTokens,
      totalTokens: inputTokens + cacheWriteTokens + cacheReadTokens + outputTokens,
      cost: calcCost({ model, inputTokens, cacheWriteTokens, cacheReadTokens, outputTokens }),
      tools,
    });
  }
  return calls;
}

function readAllCalls() {
  const all = [];
  for (const dir of getProjectDirs()) {
    for (const file of getJsonlFiles(dir)) {
      all.push(...parseJsonlFile(file, 'Claude Code'));
    }
  }
  for (const file of getJsonlFilesRecursive(COWORK_SESSIONS_DIR)) {
    all.push(...parseJsonlFile(file, 'Cowork'));
  }
  return all.sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

function readDesktopTokens() {
  try {
    const raw = JSON.parse(fs.readFileSync(DESKTOP_TOKENS_FILE, 'utf8'));
    const t   = raw['tokens-today'];
    if (!t || t.date !== new Date().toISOString().slice(0, 10)) return null;
    const half = Math.round(t.tokens * 0.5);
    return {
      ts:               new Date().toISOString(),
      product:          'Chat',
      model:            'claude-opus-4-6',
      inputTokens:      half,
      outputTokens:     half,
      cacheWriteTokens: 0,
      cacheWrite5m:     0,
      cacheWrite1h:     0,
      cacheReadTokens:  0,
      totalTokens:      t.tokens,
      cost:             calcCost({ model: 'claude-opus-4-6', inputTokens: half, outputTokens: half }),
      tools:            [],
    };
  } catch { return null; }
}

// Decode the Claude Code project dir name back to a readable path label.
// Claude Code encodes the project path by stripping the leading slash and
// replacing all slashes with hyphens, e.g. /Users/foo/bar → -Users-foo-bar.
function dirToProjectLabel(dirName) {
  const parts = dirName.replace(/^-/, '').split('-');
  return parts.slice(-2).join('/') || dirName;
}

// Extract the Cowork task description from the first enqueue entry in a session file.
// Falls back to null if not found (e.g. subagent files).
function extractCoworkTitle(filePath) {
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); } catch { return null; }
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type === 'queue-operation' && obj.operation === 'enqueue') {
      const raw = obj.content || '';
      const text = typeof raw === 'string' ? raw
        : (raw || []).map(c => c.text || '').join(' ');
      const trimmed = text.replace(/\s+/g, ' ').trim();
      // Skip system/XML messages — they start with < or are URL-encoded
      if (trimmed.startsWith('<') || trimmed.startsWith('%')) continue;
      const title = trimmed.slice(0, 60);
      return title || null;
    }
  }
  return null;
}

// For Claude Code: show the last meaningful directory segment (the project folder name).
function codeProjectLabel(dirName) {
  const parts = dirName.replace(/^-/, '').split('-').filter(Boolean);
  // Last segment is the project folder name; prepend its parent for context
  return parts.slice(-2).join('/') || dirName;
}

function readAllSessions() {
  const sessions = [];

  function processFile(file, projectLabel, product) {
    const calls = parseJsonlFile(file, product);
    if (!calls.length) return;

    const sorted           = [...calls].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    const inputTokens      = calls.reduce((s, c) => s + c.inputTokens,      0);
    const cacheWrite5m     = calls.reduce((s, c) => s + c.cacheWrite5m,     0);
    const cacheWrite1h     = calls.reduce((s, c) => s + c.cacheWrite1h,     0);
    const cacheWriteTokens = calls.reduce((s, c) => s + c.cacheWriteTokens, 0);
    const cacheReadTokens  = calls.reduce((s, c) => s + c.cacheReadTokens,  0);
    const outputTokens     = calls.reduce((s, c) => s + c.outputTokens,     0);
    const cost             = calls.reduce((s, c) => s + c.cost,             0);

    const toolCounts = calls.reduce((acc, c) => {
      (c.tools || []).forEach(t => { acc[t] = (acc[t] || 0) + 1; });
      return acc;
    }, {});

    sessions.push({
      sessionId:  path.basename(file, '.jsonl'),
      project:    projectLabel,
      product,
      model:      sorted[sorted.length - 1].model,
      firstTs:    sorted[0].ts,
      lastTs:     sorted[sorted.length - 1].ts,
      calls:      calls.length,
      inputTokens, cacheWrite5m, cacheWrite1h, cacheWriteTokens, cacheReadTokens, outputTokens,
      totalTokens: inputTokens + cacheWriteTokens + cacheReadTokens + outputTokens,
      cost,
      toolCounts,
    });
  }

  for (const dir of getProjectDirs()) {
    const projectLabel = dirToProjectLabel(path.basename(dir));
    for (const file of getJsonlFiles(dir)) {
      processFile(file, projectLabel, 'Claude Code');
    }
  }

  for (const file of getJsonlFilesRecursive(COWORK_SESSIONS_DIR)) {
    const isSubagent = file.includes('/subagents/');
    const taskTitle  = isSubagent ? null : extractCoworkTitle(file);
    const dirLabel   = dirToProjectLabel(path.basename(path.dirname(file)));
    const label      = taskTitle ? taskTitle : (isSubagent ? 'subagent' : dirLabel);
    processFile(file, label, 'Cowork');
  }

  return sessions.sort((a, b) => new Date(b.lastTs) - new Date(a.lastTs));
}

function buildDailyStats(calls) {
  return calls.reduce((acc, c) => {
    const day = c.ts.slice(0, 10);
    if (!acc[day]) acc[day] = { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, calls: 0, cost: 0 };
    acc[day].inputTokens      += c.inputTokens;
    acc[day].cacheWriteTokens += c.cacheWriteTokens;
    acc[day].cacheReadTokens  += c.cacheReadTokens;
    acc[day].outputTokens     += c.outputTokens;
    acc[day].calls            += 1;
    acc[day].cost             += c.cost;
    return acc;
  }, {});
}

function getLast7Days(dailyStats) {
  const empty = { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, calls: 0, cost: 0 };
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, ...(dailyStats[key] || empty) };
  });
}

module.exports = {
  readAllCalls, readAllSessions, buildDailyStats, getLast7Days,
  readDesktopTokens,
  PROJECTS_DIR, COWORK_SESSIONS_DIR, DESKTOP_TOKENS_FILE,
};
