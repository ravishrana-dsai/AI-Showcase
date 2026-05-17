import { MODEL, HRBP_SYSTEM } from './constants';

const API_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

export async function callClaude(userMsg, systemOverride) {
  if (!API_KEY) throw new Error('Missing REACT_APP_ANTHROPIC_API_KEY');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2200,
      system: systemOverride || HRBP_SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data && data.error && data.error.message) ? data.error.message : 'Anthropic API error');
  if (data.error) throw new Error(data.error.message || 'Anthropic API error');
  return data.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

function extractLastJsonFence(text) {
  if (!text || typeof text !== 'string') return null;
  const re = /```json\s*([\s\S]*?)\s*```/g;
  let m;
  let last = null;
  while ((m = re.exec(text)) !== null) last = m[1];
  return last ? last.trim() : null;
}

export function extractMetaJson(text) {
  const raw = extractLastJsonFence(text);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : null;
  } catch {
    return null;
  }
}

export function stripMetaJson(text) {
  if (!text || typeof text !== 'string') return text;
  const idx = text.lastIndexOf('### META_JSON');
  if (idx === -1) return text;
  return text.slice(0, idx).trim();
}

export function parseMeta(text) {
  const metaObj = extractMetaJson(text);
  if (metaObj) {
    return {
      sentiment: metaObj.sentiment || null,
      concern: metaObj.concern || null,
    };
  }
  const sentiment = ['Positive', 'Neutral', 'Mixed', 'Negative'].find((s) =>
    new RegExp(`\\*\\*2\\. Sentiment\\*\\*[\\s\\S]{0,20}${s}`, 'i').test(text)
  );
  const concern = ['High', 'Medium', 'Watch', 'Low'].find((c) =>
    new RegExp(`\\*\\*3\\. Concern Level\\*\\*[\\s\\S]{0,20}${c}`, 'i').test(text)
  );
  return { sentiment: sentiment || null, concern: concern || null };
}

export async function analyseEmployeeSessions(empName, sessions) {
  const updatedSessions = [...sessions];
  for (let i = 0; i < updatedSessions.length; i++) {
    const session = updatedSessions[i];
    const prior = updatedSessions.slice(0, i).filter((s) => s.result);
    const priorCtx = prior.length > 0
      ? '\n\nPRIOR SESSIONS:\n' + prior.map((s, j) =>
          `Session ${j + 1} (${s.date}):\n${s.notes}\n\nPrevious Analysis:\n${s.result}`
        ).join('\n---\n')
      : '';
    const msg = `Employee: ${empName}\nDate: ${session.date || 'Unknown'}\nTeam: ${session.team || 'Unknown'}\nManager: ${session.manager || 'Unknown'}\n\nNOTES:\n${session.notes}` + priorCtx;
    try {
      const raw = await callClaude(msg);
      const analysis = extractMetaJson(raw);
      const result = stripMetaJson(raw);
      const meta = parseMeta(raw);
      updatedSessions[i] = { ...session, result, meta, analysis: analysis || null };
    } catch (e) {
      updatedSessions[i] = { ...session, result: 'Error: ' + e.message, meta: {}, analysis: null };
    }
  }
  return updatedSessions;
}

export async function generateManagerCoaching({ empName, sessions, tone = 'empathetic' }) {
  const latest = [...sessions].reverse().find((s) => s && s.result) || null;
  const notes = latest ? latest.notes : (sessions && sessions[0] ? sessions[0].notes : '');
  const ctx = latest
    ? `LATEST ANALYSIS:\n${latest.result}\n\nMETA_JSON:\n${latest.analysis ? JSON.stringify(latest.analysis) : 'null'}`
    : 'No prior analysis available.';

  const system = `You are an HRBP assistant writing manager-ready coaching guidance.\n\nTone: ${tone}.\n\nOutput format:\n- **Coaching Summary** (3-5 bullets)\n- **What to Say (sample message)** (one short message)\n- **What to Do Next** (3 bullets)\n- **What to Avoid** (2 bullets)\n\nRules:\n- Be practical and specific.\n- Do not reveal sensitive HR-only framing.\n- Refer to evidence only as behaviors/quotes from notes if present.\n`;

  const msg = `Employee: ${empName}\n\nNOTES:\n${notes}\n\n${ctx}`;
  return await callClaude(msg, system);
}

export async function simulateScenario({ empName, sessions, scenario }) {
  const latest = [...sessions].reverse().find((s) => s && s.result) || null;
  const system = `You are an HRBP scenario simulator.\n\nGiven an employee context and a scenario change, predict likely impact and propose small experiments.\n\nOutput format:\n**Impact Forecast** (short paragraph)\n**Risks** (bullets)\n**Suggested Experiments** (3 bullets with owner + 1 metric each)\n**What to Watch For** (3 bullets)\n\nRules:\n- Make assumptions explicit.\n- Keep it actionable.\n`;
  const msg = `Employee: ${empName}\nScenario: ${scenario}\n\nLATEST ANALYSIS:\n${latest ? latest.result : 'None'}\n\nNOTES (most recent first):\n${[...sessions].slice(-3).reverse().map((s) => `(${s.date || 'No date'}) ${s.notes}`).join('\n---\n')}`;
  return await callClaude(msg, system);
}
