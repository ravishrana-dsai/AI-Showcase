import React, { useEffect, useRef, useState } from 'react';
import { Badge, HRBPReport } from './components/HRBPReport';
import { analyseEmployeeSessions, generateManagerCoaching, simulateScenario } from './api';

const API_BASE = process.env.PUBLIC_URL || '';

const LEGACY_SESSIONS_KEY = 'hrbp-copilot:sessions:v1';
const DB_STORAGE_KEY = 'hrbp-copilot:db:v2';
const FILE_DB_ENABLED_KEY = 'hrbp-copilot:filedb:enabled';

async function tryFetchJson(url, opts = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs || 900);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (e) {
    return { ok: false, data: { error: e && e.message ? e.message : 'fetch_failed' } };
  } finally {
    clearTimeout(t);
  }
}

const SEED_SESSIONS = [
  {
    employee: 'Bhuvan Malik', date: '2026-03-17', team: 'Engineering', manager: 'Yash Awasthi',
    notes: 'Overall happy with the ownership and responsibility that is provided to him. Multiple shifts in management have made him feel that his performance is not being monitored correctly and consistently which may impact his appraisal and growth cycles. He feels there is uncertainty in the company and doesnt know the future. He wants more clarity on what the plans are for the product and long term vision. He did not signal that he is looking out for changes or unhappy so far. Only area of concern was the multiple manager changes and pod changes.',
    createdAt: 1773816653.937849 * 1000,
  },
  {
    employee: 'Bhanvi Kumar', date: '2026-03-17', team: 'TA', manager: 'Amit',
    notes: 'Feeling stretched, flagged burnout concerns...',
    createdAt: 1773753923.830499 * 1000,
  },
  {
    employee: 'Jane Doe', date: '2024-12-10', team: 'Product', manager: 'Arjun',
    notes: 'Feeling stretched, flagged burnout concerns...',
    createdAt: 1773753861.969119 * 1000,
  },
];

function safeDateKey(s) {
  const dk = s && s.date ? Date.parse(s.date) : NaN;
  if (Number.isFinite(dk)) return dk;
  const createdAt = s && typeof s.createdAt === 'number' ? s.createdAt : NaN;
  if (Number.isFinite(createdAt)) return createdAt;
  return 0;
}

function buildDbFromSessions(sessions) {
  const db = {};
  const emps = [];
  (sessions || []).forEach((s) => {
    if (!s || !s.employee) return;
    if (!db[s.employee]) { db[s.employee] = { sessions: [], tasks: [], coaching: {}, scenarios: {} }; emps.push(s.employee); }
    db[s.employee].sessions.push({ ...s, result: s.result || null, meta: s.meta || {}, analysis: s.analysis || null });
  });

  emps.forEach((name) => {
    db[name].sessions.sort((a, b) => safeDateKey(a) - safeDateKey(b));
  });

  return { db, employees: emps.sort((a, b) => a.localeCompare(b)) };
}

function flattenDb(db) {
  if (!db) return [];
  return Object.values(db).flatMap((v) => (v && Array.isArray(v.sessions) ? v.sessions : []));
}

function addSessionToDb(existingDb, existingEmployees, session) {
  const emp = session.employee;
  const nextDb = { ...existingDb };
  const empEntry = nextDb[emp] ? { ...nextDb[emp] } : { sessions: [], tasks: [], coaching: {}, scenarios: {} };
  const nextSessions = [...(empEntry.sessions || []), session].sort((a, b) => safeDateKey(a) - safeDateKey(b));
  empEntry.sessions = nextSessions;
  nextDb[emp] = empEntry;

  const nextEmployees = existingEmployees.includes(emp)
    ? [...existingEmployees].sort((a, b) => a.localeCompare(b))
    : [...existingEmployees, emp].sort((a, b) => a.localeCompare(b));

  return { db: nextDb, employees: nextEmployees };
}

function normalizeDbShape(maybe) {
  if (!maybe || typeof maybe !== 'object') return null;
  const employees = Array.isArray(maybe.employees) ? maybe.employees : null;
  const db = maybe.db && typeof maybe.db === 'object' ? maybe.db : null;
  if (!employees || !db) return null;
  const nextDb = {};
  for (const name of employees) {
    const entry = db[name] && typeof db[name] === 'object' ? db[name] : {};
    nextDb[name] = {
      sessions: Array.isArray(entry.sessions) ? entry.sessions : [],
      tasks: Array.isArray(entry.tasks) ? entry.tasks : [],
      coaching: entry.coaching && typeof entry.coaching === 'object' ? entry.coaching : {},
      scenarios: entry.scenarios && typeof entry.scenarios === 'object' ? entry.scenarios : {},
    };
  }
  return { employees, db: nextDb };
}

function loadDbFromStorage() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const v2Raw = window.localStorage.getItem(DB_STORAGE_KEY);
    if (v2Raw) {
      const parsed = JSON.parse(v2Raw);
      const normalized = normalizeDbShape(parsed);
      if (normalized) return normalized;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_SESSIONS_KEY);
    if (!legacyRaw) return null;
    const legacyParsed = JSON.parse(legacyRaw);
    if (!legacyParsed || !Array.isArray(legacyParsed.sessions)) return null;
    const built = buildDbFromSessions(legacyParsed.sessions);
    const migrated = { version: 2, savedAt: Date.now(), employees: built.employees, db: built.db };
    window.localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(migrated));
    return normalizeDbShape(migrated);
  } catch {
    return null;
  }
}

function saveDbToStorage({ db, employees }) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      DB_STORAGE_KEY,
      JSON.stringify({ version: 2, savedAt: Date.now(), employees: employees || [], db: db || {} })
    );
  } catch {
    // ignore write errors (private mode, quota, etc.)
  }
}

export default function App() {
  const [authStatus, setAuthStatus] = useState('checking'); // checking | authed | guest | offline
  const [authUserId, setAuthUserId] = useState('');
  const [loginUserId, setLoginUserId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [db, setDb] = useState(() => {
    const stored = loadDbFromStorage();
    return stored ? stored.db : buildDbFromSessions(SEED_SESSIONS).db;
  });
  const [employees, setEmployees] = useState(() => {
    const stored = loadDbFromStorage();
    return stored ? stored.employees : buildDbFromSessions(SEED_SESSIONS).employees;
  });
  const [fileDbStatus, setFileDbStatus] = useState('unknown'); // unknown | available | unavailable
  const [fileDbEnabled, setFileDbEnabled] = useState(() => {
    try {
      const v = window.localStorage.getItem(FILE_DB_ENABLED_KEY);
      return v === 'true';
    } catch {
      return true;
    }
  });
  const saveTimerRef = useRef(null);
  const firstLoadRef = useRef(true);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('notes');
  const [sidebarTab, setSidebarTab] = useState('employees');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyseResult, setAnalyseResult] = useState(null);
  const [statusMsg, setStatusMsg] = useState('');
  const sel = selected ? db[selected] : null;

  const totalSessionsLoaded = employees.reduce((sum, name) => sum + (db[name] ? db[name].sessions.length : 0), 0);

  // Auth bootstrap
  useEffect(() => {
    let alive = true;
    (async () => {
      const me = await tryFetchJson(`${API_BASE}/api/auth/me`, { timeoutMs: 900 });
      if (!alive) return;
      if (!me.ok || !me.data || me.data.ok !== true) {
        setAuthStatus('offline');
        return;
      }
      if (me.data.authed) {
        setAuthStatus('authed');
        setAuthUserId(me.data.userId || '');
      } else {
        setAuthStatus('guest');
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    saveDbToStorage({ db, employees });
  }, [db, employees]);

  // Load from local file DB if server is running
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!fileDbEnabled) return;
      if (authStatus !== 'authed') return;
      const health = await tryFetchJson(`${API_BASE}/api/health`, { timeoutMs: 800 });
      if (!alive) return;
      if (!health.ok || !health.data || health.data.ok !== true) {
        setFileDbStatus('unavailable');
        return;
      }
      setFileDbStatus('available');
      const resp = await tryFetchJson(`${API_BASE}/api/localdb`, { timeoutMs: 900 });
      if (!alive) return;
      if (!resp.ok || !resp.data || resp.data.ok !== true) return;
      const remote = resp.data.data;
      const normalized = normalizeDbShape(remote);
      if (normalized) {
        setDb(normalized.db);
        setEmployees(normalized.employees);
      }
    })();
    return () => { alive = false; };
  }, [fileDbEnabled, authStatus]);

  // Persist to local file DB (debounced) when enabled + available
  useEffect(() => {
    if (!fileDbEnabled) return;
    if (authStatus !== 'authed') return;
    if (fileDbStatus !== 'available') return;
    if (firstLoadRef.current) { firstLoadRef.current = false; return; }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await tryFetchJson(`${API_BASE}/api/localdb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 2, savedAt: Date.now(), employees, db }),
        timeoutMs: 1500,
      });
    }, 650);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [db, employees, fileDbEnabled, fileDbStatus, authStatus]);

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return {
      employee: '',
      date: `${yyyy}-${mm}-${dd}`,
      team: '',
      manager: '',
      notes: '',
    };
  });
  const [useGuidedTemplate, setUseGuidedTemplate] = useState(true);
  const [template, setTemplate] = useState({
    wins: '',
    blockers: '',
    energy: '3',
    workload: '3',
    managerSupport: '3',
    growth: '',
    other: '',
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [coachTone, setCoachTone] = useState('empathetic');
  const [coachingBusy, setCoachingBusy] = useState(false);
  const [scenarioText, setScenarioText] = useState('Improve role clarity and alignment with manager expectations over the next 4 weeks.');
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [revealInsightsNames, setRevealInsightsNames] = useState(false);

  if (authStatus !== 'authed') {
    return (
      <div style={{ fontFamily: "'Inter',system-ui,sans-serif", minHeight: '100vh', background: '#0b1220', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ width: 'min(520px, 96vw)', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 18, boxShadow: '0 18px 40px rgba(0,0,0,0.35)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ color: '#e2e8f0', fontWeight: 900, fontSize: 16 }}>HRBP AI 1:1 Copilot</div>
            <span style={{ fontSize: 11, color: authStatus === 'offline' ? '#fbbf24' : '#94a3b8', background: '#0b1220', border: '1px solid #334155', padding: '3px 9px', borderRadius: 999, fontWeight: 900 }}>
              {authStatus === 'checking' ? 'connecting…' : authStatus === 'offline' ? 'server offline' : 'login required'}
            </span>
          </div>

          <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>
            {authStatus === 'offline'
              ? <>Start the app with <strong>npm run dev</strong> (it runs the auth + file DB server), then refresh.</>
              : <>Please sign in to access your HRBP workspace.</>}
          </div>

          {authStatus !== 'offline' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setLoginBusy(true);
                setLoginError('');
                const userId = loginUserId.trim();
                const password = loginPassword;
                const resp = await tryFetchJson(`${API_BASE}/api/auth/login`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, password }),
                  timeoutMs: 1500,
                });
                if (resp.ok && resp.data && resp.data.ok) {
                  setAuthStatus('authed');
                  setAuthUserId(resp.data.userId || userId);
                  setLoginPassword('');
                } else {
                  setAuthStatus('guest');
                  setLoginError((resp.data && resp.data.error) ? resp.data.error : 'Login failed');
                }
                setLoginBusy(false);
              }}
              style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1, marginBottom: 6 }}>USER ID</div>
                <input
                  value={loginUserId}
                  onChange={(e) => setLoginUserId(e.target.value)}
                  placeholder="Enter your user ID"
                  autoComplete="username"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0', fontSize: 13 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1, marginBottom: 6 }}>PASSWORD</div>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #334155', background: '#0b1220', color: '#e2e8f0', fontSize: 13 }}
                />
              </div>
              {loginError && (
                <div style={{ background: '#7f1d1d', border: '1px solid #991b1b', color: '#fee2e2', padding: '8px 10px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loginBusy}
                style={{ marginTop: 4, background: loginBusy ? '#334155' : '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 12px', fontWeight: 900, cursor: loginBusy ? 'not-allowed' : 'pointer' }}
              >
                {loginBusy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <div style={{ marginTop: 12, color: '#475569', fontSize: 12, lineHeight: 1.6 }}>
            Auth is local to your machine (session cookie). No external identity provider is used.
          </div>
        </div>
      </div>
    );
  }

  function openAddModal(prefillEmployee) {
    setDraft((d) => ({ ...d, employee: prefillEmployee || d.employee }));
    setAdding(true);
    setStatusMsg('');
  }

  function closeAddModal() {
    setAdding(false);
  }

  function handleCreateSession() {
    const employee = (draft.employee || '').trim();
    const rawNotes = (draft.notes || '').trim();
    if (!employee) { setStatusMsg('Error: Employee name is required.'); return; }
    if (!rawNotes && !useGuidedTemplate) { setStatusMsg('Error: Notes are required.'); return; }

    const guidedNotes = useGuidedTemplate
      ? [
          'Guided 1:1 Capture',
          '',
          `Wins:\n${(template.wins || '').trim() || '- (not provided)'}`,
          '',
          `Blockers:\n${(template.blockers || '').trim() || '- (not provided)'}`,
          '',
          `Energy (1-5): ${template.energy || '3'}`,
          `Workload (1-5): ${template.workload || '3'}`,
          `Manager Support (1-5): ${template.managerSupport || '3'}`,
          '',
          `Growth / Career:\n${(template.growth || '').trim() || '- (not discussed)'}`,
          '',
          `Other:\n${(template.other || '').trim() || '- (none)'}`,
          '',
          'Raw Notes:',
          rawNotes || '(none)',
        ].join('\n')
      : rawNotes;

    const notes = guidedNotes.trim();
    if (!notes) { setStatusMsg('Error: Notes are required.'); return; }

    const createdAt = Date.now();
    const session = {
      id: `manual-${createdAt}`,
      source: 'manual',
      employee,
      date: (draft.date || '').trim() || null,
      team: (draft.team || '').trim() || null,
      manager: (draft.manager || '').trim() || null,
      notes,
      structured: useGuidedTemplate ? { ...template } : null,
      createdAt,
      result: null,
      meta: {},
      analysis: null,
    };

    const merged = addSessionToDb(db, employees, session);
    setDb(merged.db);
    setEmployees(merged.employees);
    setSelected(employee);
    setView('notes');
    setAnalyseResult(null);

    setDraft((d) => ({ ...d, notes: '' }));
    setTemplate({ wins: '', blockers: '', energy: '3', workload: '3', managerSupport: '3', growth: '', other: '' });
    setAdding(false);
    setStatusMsg('Saved new 1:1 note for ' + employee + '.');
  }

  async function handleAnalyse(empName) {
    setAnalyzing(true); setAnalyseResult(null); setView('analysis');
    setStatusMsg('Running analysis for ' + empName + '...');
    try {
      const updated = await analyseEmployeeSessions(empName, db[empName].sessions);
      setDb((prev) => ({ ...prev, [empName]: { ...prev[empName], sessions: updated } }));
      setAnalyseResult({ empName, sessions: updated, latest: updated[updated.length - 1] });
      setStatusMsg('Analysis complete for ' + empName + '.');
    } catch (e) { setStatusMsg('Error: ' + e.message); }
    setAnalyzing(false);
  }

  function getEmployeeTasks(empName) {
    const entry = db[empName];
    return entry && Array.isArray(entry.tasks) ? entry.tasks : [];
  }

  function addTask(empName, task) {
    updateEmployee(empName, (entry) => {
      const tasks = Array.isArray(entry.tasks) ? [...entry.tasks] : [];
      tasks.unshift(task);
      return { ...entry, tasks };
    });
  }

  function updateTask(empName, taskId, patch) {
    updateEmployee(empName, (entry) => {
      const tasks = Array.isArray(entry.tasks) ? entry.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) : [];
      return { ...entry, tasks };
    });
  }

  function deleteTask(empName, taskId) {
    updateEmployee(empName, (entry) => {
      const tasks = Array.isArray(entry.tasks) ? entry.tasks.filter((t) => t.id !== taskId) : [];
      return { ...entry, tasks };
    });
  }

  function importSuggestedActionsAsTasks(empName) {
    const entry = db[empName];
    if (!entry) return;
    const latest = getLatestAnalysedSession(entry.sessions);
    const suggested = latest && latest.analysis && Array.isArray(latest.analysis.suggested_actions) ? latest.analysis.suggested_actions : [];
    if (!latest || suggested.length === 0) return;

    updateEmployee(empName, (e) => {
      const existing = Array.isArray(e.tasks) ? e.tasks : [];
      const existingKeys = new Set(existing.map((t) => t.sourceKey).filter(Boolean));
      const next = [...existing];

      suggested.forEach((a, idx) => {
        const title = (a && a.title) ? String(a.title).trim() : '';
        if (!title) return;
        const sourceKey = `suggested:${latest.id || latest.createdAt || ''}:${idx}:${title}`;
        if (existingKeys.has(sourceKey)) return;

        const dueInDays = a && typeof a.due_in_days === 'number' ? a.due_in_days : 7;
        next.unshift({
          id: `task-${Date.now()}-${idx}`,
          title,
          owner: (a && a.owner_suggestion) ? a.owner_suggestion : 'HRBP',
          status: 'Open',
          dueDate: addDaysToDate(latest.date, dueInDays),
          successMetric: (a && a.success_metric) ? a.success_metric : null,
          outcome: '',
          createdAt: Date.now(),
          source: 'analysis',
          sourceKey,
          sourceSessionId: latest.id || null,
          evidence: a && Array.isArray(a.evidence) ? a.evidence : [],
        });
      });

      return { ...e, tasks: next };
    });
  }

  const sBg = statusMsg.startsWith('Error') ? '#fef2f2' : statusMsg.startsWith('Running') ? '#fffbeb' : '#f0fdf4';
  const sColor = statusMsg.startsWith('Error') ? '#b91c1c' : statusMsg.startsWith('Running') ? '#92400e' : '#15803d';
  const sBorder = statusMsg.startsWith('Error') ? '#fecaca' : statusMsg.startsWith('Running') ? '#fde68a' : '#bbf7d0';

  const concernRank = { Low: 0, Watch: 1, Medium: 2, High: 3 };
  const sentimentRank = { Negative: 0, Mixed: 1, Neutral: 2, Positive: 3 };

  function getLatestAnalysedSession(sessions) {
    return [...(sessions || [])].reverse().find((s) => s && s.result && !String(s.result).startsWith('Error')) || null;
  }

  function getPrevAnalysedSession(sessions) {
    const analysed = [...(sessions || [])].filter((s) => s && s.result && !String(s.result).startsWith('Error'));
    return analysed.length >= 2 ? analysed[analysed.length - 2] : null;
  }

  function uniq(arr) {
    const out = [];
    const seen = new Set();
    (arr || []).forEach((x) => {
      const k = String(x || '');
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(x);
    });
    return out;
  }

  function collectEvidence(analysis) {
    if (!analysis) return [];
    const items = [];
    const pushEv = (label, evArr) => {
      (evArr || []).forEach((ev) => {
        if (!ev || !ev.quote) return;
        items.push({ label, date: ev.date || null, quote: ev.quote });
      });
    };
    (analysis.themes || []).forEach((t) => pushEv(`Theme: ${t.label}`, t.evidence));
    (analysis.risk_flags || []).forEach((r) => pushEv(`Risk: ${r.label}`, r.evidence));
    (analysis.suggested_actions || []).forEach((a) => pushEv(`Action: ${a.title}`, a.evidence));
    return items.slice(0, 24);
  }

  function computeRiskRadar(sessions) {
    const latest = getLatestAnalysedSession(sessions);
    const prev = getPrevAnalysedSession(sessions);
    if (!latest) return null;
    const latestConcern = latest.meta ? latest.meta.concern : null;
    const prevConcern = prev && prev.meta ? prev.meta.concern : null;
    const latestSent = latest.meta ? latest.meta.sentiment : null;
    const prevSent = prev && prev.meta ? prev.meta.sentiment : null;

    const concernDelta = (latestConcern && prevConcern) ? (concernRank[latestConcern] - concernRank[prevConcern]) : null;
    const sentimentDelta = (latestSent && prevSent) ? (sentimentRank[latestSent] - sentimentRank[prevSent]) : null;

    const latestThemes = uniq(((latest.analysis && latest.analysis.themes) ? latest.analysis.themes.map((t) => t.label) : []));
    const prevThemes = uniq(((prev && prev.analysis && prev.analysis.themes) ? prev.analysis.themes.map((t) => t.label) : []));
    const newThemes = latestThemes.filter((t) => !prevThemes.includes(t)).slice(0, 5);

    const latestRisks = uniq(((latest.analysis && latest.analysis.risk_flags) ? latest.analysis.risk_flags.map((r) => r.label) : []));
    const prevRisks = uniq(((prev && prev.analysis && prev.analysis.risk_flags) ? prev.analysis.risk_flags.map((r) => r.label) : []));
    const newRisks = latestRisks.filter((r) => !prevRisks.includes(r)).slice(0, 5);

    const confidence = (latest.analysis && typeof latest.analysis.confidence === 'number') ? latest.analysis.confidence : 0.55;
    const evidence = collectEvidence(latest.analysis);

    return {
      latest,
      prev,
      concernDelta,
      sentimentDelta,
      newThemes,
      newRisks,
      confidence,
      evidence,
    };
  }

  function updateEmployee(empName, updater) {
    setDb((prev) => {
      const entry = prev[empName] ? { ...prev[empName] } : { sessions: [], tasks: [], coaching: {}, scenarios: {} };
      const next = updater(entry);
      return { ...prev, [empName]: next };
    });
  }

  function addDaysToDate(dateStr, days) {
    const base = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? new Date(dateStr + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + (Number(days) || 0));
    const yyyy = base.getFullYear();
    const mm = String(base.getMonth() + 1).padStart(2, '0');
    const dd = String(base.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function downloadText(filename, text, mime = 'text/plain') {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const recentConversations = employees
    .map((name) => {
      const sessions = (db[name] && db[name].sessions) ? db[name].sessions : [];
      const last = sessions[sessions.length - 1] || null;
      const lastAnalysed = [...sessions].reverse().find((s) => s.result) || null;
      const dateKey = last && last.date ? Date.parse(last.date) : 0;
      return { name, sessions, last, lastAnalysed, dateKey };
    })
    .sort((a, b) => (b.dateKey || 0) - (a.dateKey || 0));

  const latestByEmployee = employees.map((name) => {
    const sessions = (db[name] && db[name].sessions) ? db[name].sessions : [];
    const lastAnalysed = [...sessions].reverse().find((s) => s.result) || null;
    const meta = lastAnalysed ? (lastAnalysed.meta || {}) : {};
    return { name, lastAnalysed, meta };
  });

  const concernOrder = ['High', 'Medium', 'Watch', 'Low'];
  const insightBuckets = concernOrder.map((lvl) => ({
    lvl,
    items: latestByEmployee.filter((e) => e.meta && e.meta.concern === lvl),
  }));

  function SidebarTabButton({ id, label }) {
    const active = sidebarTab === id;
    return (
      <button
        onClick={() => setSidebarTab(id)}
        style={{
          flex: 1,
          width: '100%',
          border: '1px solid ' + (active ? '#1d4ed8' : '#334155'),
          background: active ? '#0b1220' : '#0f172a',
          color: active ? '#dbeafe' : '#94a3b8',
          padding: '7px 8px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", minHeight: '100vh', background: '#f1f5f9', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#0f172a', padding: '13px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 16 }}>HRBP AI 1:1 Copilot</span>
          <span style={{ marginLeft: 10, fontSize: 11, color: '#64748b', background: '#1e293b', padding: '2px 9px', borderRadius: 20 }}>Local notes</span>
        </div>
        <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 800, background: '#0b1220', border: '1px solid #334155', padding: '5px 10px', borderRadius: 999 }}>
          {authUserId || 'signed in'}
        </div>
        <button
          onClick={async () => {
            await tryFetchJson(`${API_BASE}/api/auth/logout`, { method: 'POST', timeoutMs: 900 });
            setAuthStatus('guest');
            setAuthUserId('');
          }}
          style={{ fontSize: 12, color: '#fecaca', background: '#7f1d1d', border: '1px solid #991b1b', padding: '6px 10px', borderRadius: 10, fontWeight: 900, cursor: 'pointer' }}
        >
          Logout
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#94a3b8', fontWeight: 800, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={fileDbEnabled}
              onChange={(e) => {
                const v = e.target.checked;
                setFileDbEnabled(v);
                try { window.localStorage.setItem(FILE_DB_ENABLED_KEY, v ? 'true' : 'false'); } catch {}
              }}
            />
            Save to project folder
          </label>
          <span style={{ fontSize: 11, color: fileDbStatus === 'available' ? '#4ade80' : fileDbStatus === 'unavailable' ? '#fbbf24' : '#94a3b8', background: '#1e293b', padding: '2px 9px', borderRadius: 999, fontWeight: 900 }}>
            {fileDbEnabled ? (fileDbStatus === 'available' ? 'file DB: connected' : fileDbStatus === 'unavailable' ? 'file DB: offline' : 'file DB: checking…') : 'file DB: off'}
          </span>
        </div>
        <button
          onClick={() => openAddModal(selected)}
          style={{
            fontSize: 12,
            color: '#dbeafe',
            background: '#0b1220',
            border: '1px solid #1d4ed8',
            padding: '6px 12px',
            borderRadius: 10,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          + Add 1:1 Note
        </button>
        <div style={{ fontSize: 12, color: '#4ade80', background: '#14532d', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>
          ✓ {totalSessionsLoaded} sessions loaded
        </div>
      </div>
      {adding && (
        <div
          onClick={closeAddModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2,6,23,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 50,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 96vw)',
              background: '#fff',
              borderRadius: 14,
              overflow: 'hidden',
              boxShadow: '0 18px 40px rgba(0,0,0,0.30)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ background: '#0f172a', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontWeight: 900, color: '#f1f5f9', fontSize: 13 }}>Add 1:1 Note</div>
              <div style={{ flex: 1 }} />
              <button
                onClick={closeAddModal}
                style={{ background: 'transparent', border: '1px solid #334155', color: '#cbd5e1', borderRadius: 10, padding: '6px 10px', cursor: 'pointer', fontWeight: 800, fontSize: 12 }}
              >
                Close
              </button>
            </div>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>EMPLOYEE</div>
                  <input
                    value={draft.employee}
                    onChange={(e) => setDraft((d) => ({ ...d, employee: e.target.value }))}
                    placeholder="e.g. Jane Doe"
                    list="employee-list"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                  <datalist id="employee-list">
                    {employees.map((n) => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>DATE</div>
                  <input
                    type="date"
                    value={draft.date || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>TEAM (OPTIONAL)</div>
                  <input
                    value={draft.team}
                    onChange={(e) => setDraft((d) => ({ ...d, team: e.target.value }))}
                    placeholder="e.g. Engineering"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>MANAGER (OPTIONAL)</div>
                  <input
                    value={draft.manager}
                    onChange={(e) => setDraft((d) => ({ ...d, manager: e.target.value }))}
                    placeholder="e.g. Arjun"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                  />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>MEETING NOTES</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', fontWeight: 800, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useGuidedTemplate}
                      onChange={(e) => setUseGuidedTemplate(e.target.checked)}
                    />
                    Guided capture
                  </label>
                </div>

                {useGuidedTemplate && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>WINS</div>
                        <textarea
                          value={template.wins}
                          onChange={(e) => setTemplate((t) => ({ ...t, wins: e.target.value }))}
                          placeholder="- win 1\n- win 2"
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.5, resize: 'vertical', background: '#fff' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>BLOCKERS</div>
                        <textarea
                          value={template.blockers}
                          onChange={(e) => setTemplate((t) => ({ ...t, blockers: e.target.value }))}
                          placeholder="- blocker 1\n- blocker 2"
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.5, resize: 'vertical', background: '#fff' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, gridColumn: '1 / -1' }}>
                        {[
                          { key: 'energy', label: 'Energy' },
                          { key: 'workload', label: 'Workload' },
                          { key: 'managerSupport', label: 'Mgr Support' },
                        ].map((m) => (
                          <div key={m.key}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>{m.label} (1-5)</div>
                            <select
                              value={template[m.key]}
                              onChange={(e) => setTemplate((t) => ({ ...t, [m.key]: e.target.value }))}
                              style={{ width: '100%', padding: '9px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                            >
                              {['1', '2', '3', '4', '5'].map((v) => <option key={v} value={v}>{v}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>GROWTH / CAREER</div>
                        <textarea
                          value={template.growth}
                          onChange={(e) => setTemplate((t) => ({ ...t, growth: e.target.value }))}
                          placeholder="What did they say about growth, role, learning?"
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.5, resize: 'vertical', background: '#fff' }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>OTHER</div>
                        <textarea
                          value={template.other}
                          onChange={(e) => setTemplate((t) => ({ ...t, other: e.target.value }))}
                          placeholder="Anything else important?"
                          rows={3}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.5, resize: 'vertical', background: '#fff' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <textarea
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                  placeholder={useGuidedTemplate ? 'Optional: paste raw notes, verbatim quotes, or extra context…' : 'Paste your 1:1 notes here…'}
                  rows={useGuidedTemplate ? 5 : 8}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button
                  onClick={closeAddModal}
                  style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontWeight: 900, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateSession}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 16px', fontWeight: 900, cursor: 'pointer' }}
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {statusMsg && (
        <div style={{ background: sBg, borderBottom: '1px solid ' + sBorder, padding: '8px 24px', fontSize: 13, color: sColor }}>
          {statusMsg}
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: 230, background: '#1e293b', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 12px 12px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 10 }}>
              SIDEBAR
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SidebarTabButton id="employees" label="Employees" />
              <SidebarTabButton id="recent" label="Recent" />
              <SidebarTabButton id="insights" label="Insights" />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sidebarTab === 'employees' && (
              <div>
                <div style={{ padding: '14px 16px 8px', fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: 1 }}>
                  EMPLOYEES ({employees.length})
                </div>
                {employees.map((name) => {
                  const sessions = (db[name] && db[name].sessions) ? db[name].sessions : [];
                  const last = sessions[sessions.length - 1];
                  const hasAnalysis = sessions.some((s) => s.result);
                  const concern = (last && last.meta) ? last.meta.concern : null;
                  return (
                    <button key={name} onClick={() => { setSelected(name); setView('notes'); setAnalyseResult(null); setStatusMsg(''); }}
                      style={{ background: selected === name ? '#0f172a' : 'transparent', border: 'none', textAlign: 'left', padding: '11px 16px', cursor: 'pointer', width: '100%', borderLeft: selected === name ? '3px solid #2563eb' : '3px solid transparent' }}>
                      <div style={{ fontWeight: 600, color: selected === name ? '#f1f5f9' : '#94a3b8', fontSize: 13, marginBottom: 5 }}>{name}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {(hasAnalysis && concern) ? <Badge label={concern} type="concern" /> : <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>not analysed</span>}
                        <span style={{ fontSize: 11, color: '#475569' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {sidebarTab === 'recent' && (
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 1, marginBottom: 12 }}>
                  RECENT CONVERSATIONS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {recentConversations.map((r) => {
                    const date = (r.last && r.last.date) ? r.last.date : '—';
                    const sentiment = (r.lastAnalysed && r.lastAnalysed.meta) ? r.lastAnalysed.meta.sentiment : null;
                    const concern = (r.lastAnalysed && r.lastAnalysed.meta) ? r.lastAnalysed.meta.concern : null;
                    const snippet = (r.last && r.last.notes) ? r.last.notes.slice(0, 90) + (r.last.notes.length > 90 ? '…' : '') : '';
                    return (
                      <button
                        key={r.name}
                        onClick={() => {
                          setSelected(r.name);
                          setAnalyseResult(null);
                          setStatusMsg('');
                          setView((r.lastAnalysed && r.lastAnalysed.result) ? 'history' : 'notes');
                        }}
                        style={{
                          background: selected === r.name ? '#0f172a' : '#0b1220',
                          border: '1px solid #334155',
                          borderRadius: 12,
                          padding: '10px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                          <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: 13 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{date}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                          {sentiment ? <Badge label={sentiment} type="sentiment" /> : <span style={{ fontSize: 11, color: '#475569', fontStyle: 'italic' }}>no analysis</span>}
                          {concern ? <Badge label={concern} type="concern" /> : null}
                          <span style={{ fontSize: 11, color: '#475569' }}>{r.sessions.length} session{r.sessions.length !== 1 ? 's' : ''}</span>
                        </div>
                        {snippet && <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{snippet}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {sidebarTab === 'insights' && (
              <div style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 1, marginBottom: 12 }}>
                  ORG-WIDE INSIGHTS (PRIVACY-SAFE)
                </div>
                {(() => {
                  const latestPerEmp = employees.map((name) => {
                    const sessions = (db[name] && db[name].sessions) ? db[name].sessions : [];
                    const last = getLatestAnalysedSession(sessions);
                    const meta = last && last.meta ? last.meta : {};
                    const analysis = last && last.analysis ? last.analysis : null;
                    return { name, last, meta, analysis };
                  }).filter((x) => x.last);

                  if (latestPerEmp.length === 0) {
                    return (
                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 12, padding: 12, color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
                        No analysis data yet. Run “Analyse Data” for at least one employee to populate insights.
                      </div>
                    );
                  }

                  const concernCounts = { High: 0, Medium: 0, Watch: 0, Low: 0, Unknown: 0 };
                  latestPerEmp.forEach((e) => {
                    const c = e.meta && e.meta.concern ? e.meta.concern : 'Unknown';
                    concernCounts[c] = (concernCounts[c] || 0) + 1;
                  });

                  const allSessions = employees.flatMap((name) => ((db[name] && db[name].sessions) ? db[name].sessions : []).map((s) => ({ name, s })));
                  const now = Date.now();
                  const d30 = 30 * 24 * 60 * 60 * 1000;
                  const curStart = now - d30;
                  const prevStart = now - 2 * d30;

                  const themeCur = new Map();
                  const themePrev = new Map();
                  const gapCounts = new Map();

                  allSessions.forEach(({ s }) => {
                    if (!s || !s.analysis) return;
                    const ts = safeDateKey(s);
                    const themes = Array.isArray(s.analysis.themes) ? s.analysis.themes.map((t) => t.label).filter(Boolean) : [];
                    const gaps = Array.isArray(s.analysis.gaps_detected) ? s.analysis.gaps_detected : [];
                    gaps.forEach((g) => gapCounts.set(g, (gapCounts.get(g) || 0) + 1));

                    const target = ts >= curStart ? themeCur : (ts >= prevStart && ts < curStart ? themePrev : null);
                    if (!target) return;
                    themes.forEach((t) => target.set(t, (target.get(t) || 0) + 1));
                  });

                  const topThemes = Array.from(themeCur.entries())
                    .map(([label, count]) => {
                      const prev = themePrev.get(label) || 0;
                      const delta = count - prev;
                      return { label, count, prev, delta };
                    })
                    .sort((a, b) => b.count - a.count)
                    .slice(0, 8);

                  const topGaps = Array.from(gapCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);

                  const arrow = (d) => (d > 0 ? '↑' : d < 0 ? '↓' : '→');

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1 }}>RISK DISTRIBUTION (LATEST PER EMPLOYEE)</div>
                          <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input type="checkbox" checked={revealInsightsNames} onChange={(e) => setRevealInsightsNames(e.target.checked)} />
                            reveal names (local only)
                          </label>
                        </div>
                        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          {['High', 'Medium', 'Watch', 'Low'].map((lvl) => (
                            <div key={lvl} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Badge label={lvl} type="concern" />
                              <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 900 }}>{concernCounts[lvl] || 0}</span>
                            </div>
                          ))}
                        </div>
                        {revealInsightsNames && (
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {['High', 'Medium', 'Watch', 'Low'].map((lvl) => {
                              const names = latestPerEmp.filter((e) => (e.meta && e.meta.concern) === lvl).map((e) => e.name);
                              if (names.length === 0) return null;
                              return (
                                <div key={lvl} style={{ fontSize: 12, color: '#94a3b8' }}>
                                  <strong style={{ color: '#e2e8f0' }}>{lvl}:</strong> {names.join(', ')}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1 }}>TOP THEMES (LAST 30 DAYS)</div>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {topThemes.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#94a3b8' }}>No theme data available yet.</div>
                          ) : topThemes.map((t) => (
                            <div key={t.label} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 900 }}>{t.label}</span>
                                <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 900 }}>{t.count} {arrow(t.delta)}</span>
                              </div>
                              <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: '#111827' }}>
                                <div style={{ width: `${Math.min(100, (t.count / Math.max(1, topThemes[0].count)) * 100)}%`, height: 6, borderRadius: 999, background: '#60a5fa' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1 }}>COMMON INFORMATION GAPS</div>
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {topGaps.length === 0 ? (
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>No gap data available yet.</span>
                          ) : topGaps.map(([g, c]) => (
                            <span key={g} style={{ background: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: 999, padding: '5px 10px', fontSize: 12, fontWeight: 900 }}>
                              {g} · {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div style={{ flex: 1 }} />
          <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', fontSize: 11, color: '#475569', lineHeight: 1.6 }}>
            Use <span style={{ color: '#93c5fd', fontWeight: 800 }}>Add 1:1 Note</span> to paste new meeting notes.
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selected && (
            <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '11px 22px', display: 'flex', alignItems: 'center', gap: 12, overflow: 'hidden' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: 15 }}>{selected}</span>
              <span style={{ color: '#e2e8f0' }}>|</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 2 }}>
                {[
                  { id: 'notes', label: 'Notes' },
                  { id: 'analysis', label: 'Risk & Report' },
                  { id: 'actions', label: 'Actions' },
                  { id: 'coaching', label: 'Manager Coaching' },
                  { id: 'timeline', label: 'Timeline' },
                  { id: 'scenario', label: 'Scenario' },
                  { id: 'export', label: 'Export' },
                  { id: 'history', label: 'All History' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setView(t.id)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      border: '1px solid ' + (view === t.id ? '#0f172a' : '#e2e8f0'),
                      background: view === t.id ? '#0f172a' : '#fff',
                      color: view === t.id ? '#fff' : '#64748b',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => handleAnalyse(selected)} disabled={analyzing}
                style={{ background: analyzing ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: analyzing ? 'not-allowed' : 'pointer' }}>
                {analyzing ? 'Analysing...' : '🧠 Analyse Data'}
              </button>
            </div>
          )}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {!selected && (
              <div style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👈</div>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, marginBottom: 8 }}>Select an employee to begin</div>
                <div style={{ color: '#64748b', fontSize: 14, lineHeight: 1.7 }}>
                  {employees.length} employee{employees.length !== 1 ? 's' : ''} loaded. Select one, then click 🧠 Analyse Data.
                </div>
              </div>
            )}
            {selected && view === 'notes' && sel && (
              <div style={{ maxWidth: 740, margin: '0 auto' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 16, fontSize: 15 }}>
                  {sel.sessions.length} Session{sel.sessions.length !== 1 ? 's' : ''} — {selected}
                </div>
                {sel.sessions.map((s, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b' }}>Session {i + 1} — {s.date || 'No date'}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {(s.result && s.meta)
                          ? <span><Badge label={s.meta.sentiment} type="sentiment" /> <Badge label={s.meta.concern} type="concern" /></span>
                          : <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>not yet analysed</span>}
                      </div>
                    </div>
                    <div style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>MEETING NOTES</div>
                      <div style={{ fontSize: 13, color: '#475569', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{s.notes}</div>
                    </div>
                    {s.team && <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>Team: {s.team} · Manager: {s.manager}</div>}
                  </div>
                ))}
              </div>
            )}
            {selected && view === 'analysis' && (
              <div style={{ maxWidth: 780, margin: '0 auto' }}>
                {analyzing ? (
                  <div style={{ textAlign: 'center', padding: 80 }}>
                    <div style={{ fontSize: 36, marginBottom: 14 }}>⏳</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 6 }}>Running deep analysis...</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>Processing sessions, building memory card, detecting patterns</div>
                  </div>
                ) : (analyseResult && analyseResult.empName === selected) ? (
                  <div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Latest result:</span>
                      <Badge label={(analyseResult.latest && analyseResult.latest.meta) ? analyseResult.latest.meta.sentiment : null} type="sentiment" />
                      <Badge label={(analyseResult.latest && analyseResult.latest.meta) ? analyseResult.latest.meta.concern : null} type="concern" />
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{analyseResult.sessions.length} session(s) analysed</span>
                    </div>
                    {(() => {
                      const radar = computeRiskRadar(analyseResult.sessions);
                      if (!radar) return null;
                      const cd = radar.concernDelta;
                      const sd = radar.sentimentDelta;
                      const prevC = radar.prev && radar.prev.meta ? radar.prev.meta.concern : null;
                      const prevS = radar.prev && radar.prev.meta ? radar.prev.meta.sentiment : null;
                      const latestC = radar.latest && radar.latest.meta ? radar.latest.meta.concern : null;
                      const latestS = radar.latest && radar.latest.meta ? radar.latest.meta.sentiment : null;
                      const trendTxt = radar.prev ? 'vs previous analysed session' : 'first analysed session';
                      const confPct = Math.round((radar.confidence || 0.55) * 100);
                      const arrow = (x) => (x === null ? '—' : x > 0 ? '↑' : x < 0 ? '↓' : '→');

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, marginBottom: 16 }}>
                          <div style={{ background: '#0b1220', border: '1px solid #1e293b', borderRadius: 14, padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1 }}>PROACTIVE RISK RADAR</div>
                                <div style={{ marginTop: 6, fontSize: 13, color: '#e2e8f0', fontWeight: 800 }}>
                                  {trendTxt} · Confidence: {confPct}%
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>Concern</span>
                                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 900 }}>{prevC || '—'} {arrow(cd)} {latestC || '—'}</span>
                                </div>
                                <div style={{ width: 1, height: 18, background: '#334155' }} />
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                  <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>Sentiment</span>
                                  <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 900 }}>{prevS || '—'} {arrow(sd)} {latestS || '—'}</span>
                                </div>
                              </div>
                            </div>

                            {(radar.newRisks.length > 0 || radar.newThemes.length > 0) && (
                              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1 }}>WHAT CHANGED</div>
                                  <ul style={{ margin: '8px 0 0 0', paddingLeft: 16, color: '#e2e8f0', fontSize: 13, lineHeight: 1.6 }}>
                                    {radar.newRisks.slice(0, 3).map((r) => <li key={r}><strong>New risk:</strong> {r}</li>)}
                                    {radar.newThemes.slice(0, 3).map((t) => <li key={t}><strong>New theme:</strong> {t}</li>)}
                                  </ul>
                                </div>
                                <div style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, padding: 12 }}>
                                  <div style={{ fontSize: 11, fontWeight: 900, color: '#94a3b8', letterSpacing: 1 }}>EVIDENCE (QUOTES)</div>
                                  {radar.evidence.length === 0 ? (
                                    <div style={{ marginTop: 8, fontSize: 13, color: '#94a3b8' }}>No evidence quotes were returned in META_JSON yet. Run analysis again after adding more detailed notes.</div>
                                  ) : (
                                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {radar.evidence.slice(0, 4).map((ev, i) => (
                                        <div key={i} style={{ background: '#0b1220', border: '1px solid #334155', borderRadius: 10, padding: '8px 10px' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                            <div style={{ fontSize: 12, color: '#dbeafe', fontWeight: 800 }}>{ev.label}</div>
                                            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800 }}>{ev.date || radar.latest.date || '—'}</div>
                                          </div>
                                          <div style={{ marginTop: 6, fontSize: 12, color: '#e2e8f0', lineHeight: 1.55 }}>"{ev.quote}"</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                    <HRBPReport text={analyseResult.latest ? analyseResult.latest.result : ''} />
                    {analyseResult.latest && analyseResult.latest.analysis && (
                      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 10 }}>EVIDENCE LIBRARY (LINKED QUOTES)</div>
                        {collectEvidence(analyseResult.latest.analysis).length === 0 ? (
                          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
                            No evidence quotes found in META_JSON. Add more verbatim quotes to notes and re-run analysis to populate this.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {collectEvidence(analyseResult.latest.analysis).map((ev, i) => (
                              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                                  <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 900 }}>{ev.label}</div>
                                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>{ev.date || analyseResult.latest.date || '—'}</div>
                                </div>
                                <div style={{ marginTop: 6, fontSize: 13, color: '#0f172a', lineHeight: 1.7 }}>"{ev.quote}"</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>🧠</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Ready to analyse {selected}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
                      {sel ? sel.sessions.length : 0} session(s) loaded · Click below to run full HRBP analysis
                    </div>
                    <button onClick={() => handleAnalyse(selected)}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 9, padding: '12px 32px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                      🧠 Analyse Data Now
                    </button>
                  </div>
                )}
              </div>
            )}
            {selected && view === 'actions' && sel && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                {(() => {
                  const latest = getLatestAnalysedSession(sel.sessions);
                  const analysis = latest && latest.analysis ? latest.analysis : null;
                  const suggested = analysis && Array.isArray(analysis.suggested_actions) ? analysis.suggested_actions : [];
                  const followups = analysis && Array.isArray(analysis.followup_questions) ? analysis.followup_questions : [];
                  const gaps = analysis && Array.isArray(analysis.gaps_detected) ? analysis.gaps_detected : [];
                  const tasks = getEmployeeTasks(selected);
                  const openTasks = tasks.filter((t) => (t.status || 'Open') !== 'Done');

                  const statusColors = {
                    Open: { bg: '#eff6ff', bd: '#bfdbfe', fg: '#1d4ed8' },
                    'In Progress': { bg: '#fffbeb', bd: '#fde68a', fg: '#92400e' },
                    Blocked: { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
                    Done: { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#15803d' },
                  };

                  const pill = (label) => (
                    <span style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 800 }}>
                      {label}
                    </span>
                  );

                  return (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                        <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 15 }}>Action Tracker</div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {pill(`${openTasks.length} open`)}
                          {pill(`${tasks.length} total`)}
                          {latest && latest.date ? pill(`latest: ${latest.date}`) : null}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>NEXT 1:1 FOLLOW-UPS</div>
                            {gaps.length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {gaps.slice(0, 6).map((g) => (
                                  <span key={g} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 800 }}>
                                    gap: {g}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Open actions</div>
                            {openTasks.length === 0 ? (
                              <div style={{ fontSize: 13, color: '#94a3b8' }}>No open tracked actions.</div>
                            ) : (
                              <ul style={{ margin: 0, paddingLeft: 18, color: '#334155', fontSize: 13, lineHeight: 1.6 }}>
                                {openTasks.slice(0, 6).map((t) => (
                                  <li key={t.id}>
                                    <strong>{t.title}</strong>
                                    {t.dueDate ? <span style={{ color: '#64748b' }}> (due {t.dueDate})</span> : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 6 }}>Questions to ask</div>
                            {followups.length === 0 ? (
                              <div style={{ fontSize: 13, color: '#94a3b8' }}>Run analysis to generate personalized follow-up questions.</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {followups.slice(0, 6).map((q, i) => (
                                  <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}>
                                    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{q.question || String(q)}</div>
                                    {(q.gap || q.why) && (
                                      <div style={{ marginTop: 4, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                                        {q.gap ? <span><strong>Gap:</strong> {q.gap}. </span> : null}
                                        {q.why ? <span><strong>Why:</strong> {q.why}</span> : null}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>SUGGESTED ACTIONS (FROM LATEST ANALYSIS)</div>
                            <button
                              onClick={() => importSuggestedActionsAsTasks(selected)}
                              disabled={!latest || suggested.length === 0}
                              style={{
                                background: (!latest || suggested.length === 0) ? '#f1f5f9' : '#0f172a',
                                color: (!latest || suggested.length === 0) ? '#94a3b8' : '#fff',
                                border: '1px solid ' + ((!latest || suggested.length === 0) ? '#e2e8f0' : '#0f172a'),
                                borderRadius: 10,
                                padding: '8px 10px',
                                fontWeight: 900,
                                fontSize: 12,
                                cursor: (!latest || suggested.length === 0) ? 'not-allowed' : 'pointer',
                              }}
                            >
                              Import to tracker
                            </button>
                          </div>
                          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(!latest || suggested.length === 0) ? (
                              <div style={{ fontSize: 13, color: '#94a3b8' }}>No suggested actions available yet. Run analysis on the employee.</div>
                            ) : suggested.slice(0, 6).map((a, i) => (
                              <div key={i} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                                  <div style={{ fontSize: 13, fontWeight: 900, color: '#0f172a' }}>{a.title}</div>
                                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 800 }}>{a.owner_suggestion || '—'} · due ~{a.due_in_days || 7}d</div>
                                </div>
                                {a.success_metric && <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}><strong>Success metric:</strong> {a.success_metric}</div>}
                                {Array.isArray(a.evidence) && a.evidence.length > 0 && (
                                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                                    <strong>Evidence:</strong> “{a.evidence[0].quote}” {a.evidence[0].date ? <span>({a.evidence[0].date})</span> : null}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>TRACKED TASKS</div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder="Add a custom action…"
                              style={{ width: 280, maxWidth: '55vw', padding: '9px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                            />
                            <button
                              onClick={() => {
                                const title = newTaskTitle.trim();
                                if (!title) return;
                                addTask(selected, {
                                  id: `task-${Date.now()}`,
                                  title,
                                  owner: 'HRBP',
                                  status: 'Open',
                                  dueDate: addDaysToDate(null, 7),
                                  successMetric: null,
                                  outcome: '',
                                  createdAt: Date.now(),
                                  source: 'manual',
                                  sourceKey: `manual:${Date.now()}:${title}`,
                                  sourceSessionId: null,
                                  evidence: [],
                                });
                                setNewTaskTitle('');
                              }}
                              style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 12px', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {tasks.length === 0 ? (
                          <div style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>No tracked tasks yet.</div>
                        ) : (
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {tasks.map((t) => {
                              const sc = statusColors[t.status] || statusColors.Open;
                              return (
                                <div key={t.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 900 }}>{t.title}</div>
                                    <span style={{ background: sc.bg, border: '1px solid ' + sc.bd, color: sc.fg, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 900 }}>
                                      {t.status || 'Open'}
                                    </span>
                                  </div>

                                  <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>STATUS</div>
                                      <select
                                        value={t.status || 'Open'}
                                        onChange={(e) => updateTask(selected, t.id, { status: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                                      >
                                        {['Open', 'In Progress', 'Blocked', 'Done'].map((s) => <option key={s} value={s}>{s}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>OWNER</div>
                                      <select
                                        value={t.owner || 'HRBP'}
                                        onChange={(e) => updateTask(selected, t.id, { owner: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff' }}
                                      >
                                        {['HRBP', 'Manager', 'Employee'].map((o) => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>DUE DATE</div>
                                      <input
                                        type="date"
                                        value={t.dueDate || ''}
                                        onChange={(e) => updateTask(selected, t.id, { dueDate: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
                                      />
                                    </div>
                                  </div>

                                  <div style={{ marginTop: 10 }}>
                                    <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1, marginBottom: 6 }}>OUTCOME / NOTES</div>
                                    <textarea
                                      value={t.outcome || ''}
                                      onChange={(e) => updateTask(selected, t.id, { outcome: e.target.value })}
                                      placeholder="What happened? Any outcome/decision?"
                                      rows={2}
                                      style={{ width: '100%', padding: '8px 10px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.5, resize: 'vertical' }}
                                    />
                                  </div>

                                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>
                                      {t.successMetric ? <span><strong>Metric:</strong> {t.successMetric}</span> : <span />}
                                    </div>
                                    <button
                                      onClick={() => deleteTask(selected, t.id)}
                                      style={{ background: '#fff', border: '1px solid #fee2e2', color: '#b91c1c', borderRadius: 10, padding: '7px 10px', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {selected && view === 'coaching' && sel && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ fontWeight: 900, color: '#0f172a', fontSize: 15 }}>Manager Coaching</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontWeight: 900 }}>Tone</span>
                    {['empathetic', 'direct'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setCoachTone(t)}
                        style={{
                          background: coachTone === t ? '#0f172a' : '#fff',
                          color: coachTone === t ? '#fff' : '#64748b',
                          border: '1px solid ' + (coachTone === t ? '#0f172a' : '#e2e8f0'),
                          borderRadius: 999,
                          padding: '6px 12px',
                          fontWeight: 900,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                    <button
                      onClick={async () => {
                        setCoachingBusy(true);
                        setStatusMsg('Running manager coaching (' + coachTone + ') for ' + selected + '...');
                        try {
                          const text = await generateManagerCoaching({ empName: selected, sessions: sel.sessions, tone: coachTone });
                          updateEmployee(selected, (entry) => ({
                            ...entry,
                            coaching: { ...(entry.coaching || {}), [coachTone]: { text, generatedAt: Date.now() } },
                          }));
                          setStatusMsg('Coaching generated (' + coachTone + ') for ' + selected + '.');
                        } catch (e) {
                          setStatusMsg('Error: ' + (e && e.message ? e.message : 'Coaching failed'));
                        }
                        setCoachingBusy(false);
                      }}
                      disabled={coachingBusy}
                      style={{
                        background: coachingBusy ? '#94a3b8' : '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 10,
                        padding: '8px 12px',
                        fontWeight: 900,
                        fontSize: 12,
                        cursor: coachingBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {coachingBusy ? 'Generating…' : 'Generate coaching'}
                    </button>
                  </div>
                </div>

                {(() => {
                  const stored = (sel.coaching && sel.coaching[coachTone]) ? sel.coaching[coachTone] : null;
                  const text = stored ? stored.text : '';
                  return (
                    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>
                        MANAGER-READY OUTPUT {stored && stored.generatedAt ? <span style={{ fontWeight: 800, color: '#94a3b8' }}>· saved</span> : null}
                      </div>
                      {!text ? (
                        <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>
                          Click <strong>Generate coaching</strong> to produce a manager-ready plan and sample message. This will use the latest notes + analysis.
                        </div>
                      ) : (
                        <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                          <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#0f172a', lineHeight: 1.75 }}>{text}</div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            {selected && view === 'timeline' && sel && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 12, fontSize: 15 }}>Employee Memory Timeline</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[...sel.sessions].slice().sort((a, b) => safeDateKey(a) - safeDateKey(b)).map((s, idx, arr) => {
                    const prev = idx > 0 ? arr[idx - 1] : null;
                    const c1 = prev && prev.meta ? prev.meta.concern : null;
                    const c2 = s && s.meta ? s.meta.concern : null;
                    const inflect = c1 && c2 && c1 !== c2;
                    const summary = s && s.analysis && s.analysis.session_summary ? s.analysis.session_summary : (s.notes || '').slice(0, 120) + ((s.notes || '').length > 120 ? '…' : '');
                    return (
                      <div key={s.id || idx} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 12, fontWeight: 900, color: '#64748b' }}>{s.date || 'No date'}</span>
                            {s.meta && s.meta.sentiment ? <Badge label={s.meta.sentiment} type="sentiment" /> : null}
                            {s.meta && s.meta.concern ? <Badge label={s.meta.concern} type="concern" /> : null}
                            {inflect && <span style={{ fontSize: 11, fontWeight: 900, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '3px 9px', borderRadius: 999 }}>inflection</span>}
                          </div>
                          <button
                            onClick={() => { setView(s.result ? 'history' : 'notes'); }}
                            style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#2563eb', borderRadius: 10, padding: '6px 10px', fontWeight: 900, cursor: 'pointer', fontSize: 12 }}
                          >
                            {s.result ? 'View analysis' : 'View notes'}
                          </button>
                        </div>
                        <div style={{ marginTop: 10, color: '#0f172a', fontSize: 13, lineHeight: 1.7 }}>
                          {summary}
                        </div>
                        {s.analysis && (Array.isArray(s.analysis.risk_flags) || Array.isArray(s.analysis.themes)) && (
                          <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {(s.analysis.risk_flags || []).slice(0, 2).map((r) => (
                              <span key={r.label} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 900 }}>
                                risk: {r.label}
                              </span>
                            ))}
                            {(s.analysis.themes || []).slice(0, 3).map((t) => (
                              <span key={t.label} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 900 }}>
                                {t.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {selected && view === 'scenario' && sel && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 12, fontSize: 15 }}>Scenario Simulator</div>
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>WHAT-IF SCENARIO</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        'Reduce workload by 15% by shifting one major deliverable to next sprint.',
                        'Improve manager alignment: set weekly priorities + success criteria for 4 weeks.',
                        'Clarify role growth path and expectations for next level within 30 days.',
                      ].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setScenarioText(preset)}
                          style={{ background: '#fff', border: '1px solid #e2e8f0', color: '#2563eb', borderRadius: 999, padding: '6px 10px', fontWeight: 900, fontSize: 12, cursor: 'pointer' }}
                        >
                          Preset
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={scenarioText}
                    onChange={(e) => setScenarioText(e.target.value)}
                    rows={4}
                    style={{ marginTop: 10, width: '100%', padding: '10px 12px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, lineHeight: 1.6, resize: 'vertical' }}
                  />
                  <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={async () => {
                        const s = scenarioText.trim();
                        if (!s) return;
                        setScenarioBusy(true);
                        setStatusMsg('Running scenario simulation for ' + selected + '...');
                        try {
                          const text = await simulateScenario({ empName: selected, sessions: sel.sessions, scenario: s });
                          updateEmployee(selected, (entry) => ({
                            ...entry,
                            scenarios: { ...(entry.scenarios || {}), last: { scenario: s, text, generatedAt: Date.now() } },
                          }));
                          setStatusMsg('Scenario simulation complete for ' + selected + '.');
                        } catch (e) {
                          setStatusMsg('Error: ' + (e && e.message ? e.message : 'Scenario simulation failed'));
                        }
                        setScenarioBusy(false);
                      }}
                      disabled={scenarioBusy}
                      style={{ background: scenarioBusy ? '#94a3b8' : '#0f172a', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 14px', fontWeight: 900, cursor: scenarioBusy ? 'not-allowed' : 'pointer', fontSize: 12 }}
                    >
                      {scenarioBusy ? 'Simulating…' : 'Simulate'}
                    </button>
                  </div>
                </div>

                {sel.scenarios && sel.scenarios.last && sel.scenarios.last.text && (
                  <div style={{ marginTop: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>RESULT</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>{sel.scenarios.last.generatedAt ? new Date(sel.scenarios.last.generatedAt).toLocaleString() : ''}</div>
                    </div>
                    <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#0f172a', lineHeight: 1.75 }}>{sel.scenarios.last.text}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {selected && view === 'export' && sel && (
              <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <div style={{ fontWeight: 900, color: '#0f172a', marginBottom: 12, fontSize: 15 }}>Export Packs</div>
                {(() => {
                  const latest = getLatestAnalysedSession(sel.sessions);
                  const tasks = getEmployeeTasks(selected);
                  const openTasks = tasks.filter((t) => (t.status || 'Open') !== 'Done');
                  const coaching = sel.coaching && sel.coaching.empathetic && sel.coaching.empathetic.text ? sel.coaching.empathetic.text : '';

                  const managerBrief = () => {
                    const sentiment = latest && latest.meta ? latest.meta.sentiment : null;
                    const concern = latest && latest.meta ? latest.meta.concern : null;
                    const title = `Manager Brief — ${selected}`;
                    const bullets = openTasks.slice(0, 6).map((t) => `<li><strong>${t.title}</strong>${t.dueDate ? ` (due ${t.dueDate})` : ''}</li>`).join('');
                    const summary = (latest && latest.analysis && latest.analysis.session_summary) ? latest.analysis.session_summary : '';
                    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 28px; color: #0f172a; }
    h1 { margin: 0 0 8px 0; font-size: 22px; }
    .meta { color: #475569; font-size: 13px; margin-bottom: 18px; }
    h2 { font-size: 15px; margin: 18px 0 8px 0; }
    .card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; margin: 10px 0; background: #fff; }
    ul { margin: 8px 0 0 18px; }
    pre { white-space: pre-wrap; font-family: inherit; font-size: 13px; line-height: 1.6; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="meta">Sentiment: ${sentiment || '—'} · Concern: ${concern || '—'} · Latest session: ${latest && latest.date ? latest.date : '—'}</div>
  <div class="card">
    <h2>Context</h2>
    <div>${summary || '—'}</div>
  </div>
  <div class="card">
    <h2>Open follow-ups</h2>
    <ul>${bullets || '<li>—</li>'}</ul>
  </div>
  <div class="card">
    <h2>Coaching guidance (empathetic)</h2>
    <pre>${(coaching || 'Generate coaching first, then export.').replace(/</g, '&lt;')}</pre>
  </div>
</body>
</html>`;
                    return html;
                  };

                  const hrbpReportPrint = () => {
                    if (!latest || !latest.result) return;
                    const w = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
                    if (!w) return;
                    const safe = String(latest.result).replace(/</g, '&lt;');
                    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>HRBP Report — ${selected}</title>
<style>
body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:26px;color:#0f172a;}
pre{white-space:pre-wrap;font-family:inherit;font-size:13px;line-height:1.7}
</style></head><body>
<h2 style="margin:0 0 10px 0;">HRBP Report — ${selected}</h2>
<div style="color:#64748b;font-size:12px;margin-bottom:16px;">Latest session: ${latest.date || '—'}</div>
<pre>${safe}</pre>
</body></html>`);
                    w.document.close();
                    w.focus();
                    w.print();
                  };

                  const exportJson = () => {
                    const payload = {
                      exportedAt: new Date().toISOString(),
                      employee: selected,
                      entry: sel,
                    };
                    downloadText(`${selected.replace(/\s+/g, '_')}_hrbp_export.json`, JSON.stringify(payload, null, 2), 'application/json');
                  };

                  const exportTasksCsv = () => {
                    const rows = [
                      ['title', 'owner', 'status', 'dueDate', 'successMetric', 'outcome'].join(','),
                      ...tasks.map((t) => [
                        `"${String(t.title || '').replace(/"/g, '""')}"`,
                        `"${String(t.owner || '').replace(/"/g, '""')}"`,
                        `"${String(t.status || '').replace(/"/g, '""')}"`,
                        `"${String(t.dueDate || '').replace(/"/g, '""')}"`,
                        `"${String(t.successMetric || '').replace(/"/g, '""')}"`,
                        `"${String(t.outcome || '').replace(/"/g, '""')}"`,
                      ].join(',')),
                    ].join('\n');
                    downloadText(`${selected.replace(/\s+/g, '_')}_tasks.csv`, rows, 'text/csv');
                  };

                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>HRBP PACK</div>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <button onClick={hrbpReportPrint} disabled={!latest || !latest.result}
                            style={{ background: (!latest || !latest.result) ? '#f1f5f9' : '#0f172a', color: (!latest || !latest.result) ? '#94a3b8' : '#fff', border: '1px solid ' + ((!latest || !latest.result) ? '#e2e8f0' : '#0f172a'), borderRadius: 12, padding: '11px 12px', fontWeight: 900, cursor: (!latest || !latest.result) ? 'not-allowed' : 'pointer', textAlign: 'left' }}>
                            Print / Save as PDF (latest HRBP report)
                          </button>
                          <button onClick={exportJson}
                            style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 12, padding: '11px 12px', fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}>
                            Download JSON backup (employee)
                          </button>
                        </div>
                      </div>

                      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                        <div style={{ fontSize: 11, fontWeight: 900, color: '#64748b', letterSpacing: 1 }}>MANAGER PACK</div>
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <button
                            onClick={() => downloadText(`${selected.replace(/\s+/g, '_')}_manager_brief.doc`, managerBrief(), 'application/msword')}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 12px', fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}
                          >
                            Download manager brief (.doc)
                          </button>
                          <button onClick={exportTasksCsv}
                            style={{ background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: 12, padding: '11px 12px', fontWeight: 900, cursor: 'pointer', textAlign: 'left' }}>
                            Download tasks CSV
                          </button>
                        </div>
                        <div style={{ marginTop: 10, fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
                          Tip: generate <strong>Manager Coaching</strong> first, then export the brief.
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
            {selected && view === 'history' && sel && (
              <div style={{ maxWidth: 780, margin: '0 auto' }}>
                <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 16, fontSize: 15 }}>Full Analysis History — {selected}</div>
                {sel.sessions.filter((s) => s.result).length === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 14, padding: 20, background: '#fff', borderRadius: 12 }}>No analysis run yet.</div>
                ) : [...sel.sessions].filter((s) => s.result).reverse().map((s, i) => (
                  <div key={i} style={{ background: '#fff', borderRadius: 12, padding: 22, marginBottom: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: 14 }}>Session — {s.date || 'No date'}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Badge label={s.meta ? s.meta.sentiment : null} type="sentiment" />
                        <Badge label={s.meta ? s.meta.concern : null} type="concern" />
                      </div>
                    </div>
                    <details>
                      <summary style={{ cursor: 'pointer', fontSize: 13, color: '#2563eb', fontWeight: 600 }}>View Full Analysis ↓</summary>
                      <div style={{ marginTop: 14 }}><HRBPReport text={s.result} /></div>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
