const { app, Tray, Menu, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

const { startIngestServer }                                               = require('./ingest_server');
const {
  readAllCalls, readAllSessions, buildDailyStats, getLast7Days,
  PROJECTS_DIR, COWORK_SESSIONS_DIR,
} = require('./claude_reader');
const { calcCost, PRICING, setPricingOverrides }                          = require('./pricing');
const { runCheck, isDue, loadState, loadOverrides, saveOverrides, WEEK_MS } = require('./pricing_checker');
const { createMenuBarIcon }                                               = require('./icon');

let tray           = null;
let dashboardWindow = null;

// claudeCodeCalls includes Cowork (both parsed from JSONL by readAllCalls)
// browserCalls arrive via the ingest server from the Chrome extension
let claudeCodeCalls = [];
let browserCalls    = [];

function getAllCalls() {
  return [...claudeCodeCalls, ...browserCalls]
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

function refresh() {
  claudeCodeCalls = readAllCalls();
  updateTray();
  pushStatsUpdate();
}

function sumDays(daily, keys) {
  return keys.reduce((acc, k) => {
    const d = daily[k];
    if (!d) return acc;
    acc.cost             += d.cost;
    acc.calls            += d.calls;
    acc.inputTokens      += d.inputTokens;
    acc.cacheWriteTokens += d.cacheWriteTokens;
    acc.cacheReadTokens  += d.cacheReadTokens;
    acc.outputTokens     += d.outputTokens;
    return acc;
  }, emptyDay());
}

function getStats() {
  const all   = getAllCalls();
  const daily = buildDailyStats(all);
  const today = new Date().toISOString().slice(0, 10);

  // Last 7 calendar days (including today)
  const last7Keys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().slice(0, 10);
  });

  // Current calendar month
  const monthPrefix = today.slice(0, 7); // "YYYY-MM"
  const monthKeys   = Object.keys(daily).filter(k => k.startsWith(monthPrefix));

  const sourceCounts = all.reduce((a, c) => { a[c.product] = (a[c.product] || 0) + 1; return a; }, {});

  return {
    todayData:    daily[today] || emptyDay(),
    weekData:     sumDays(daily, last7Keys),
    monthData:    sumDays(daily, monthKeys),
    recentCalls:  all.slice(0, 50),
    last7:        getLast7Days(daily),
    sessions:     readAllSessions(),
    sourceCounts,
  };
}

function getTodayData() {
  return buildDailyStats(getAllCalls())[new Date().toISOString().slice(0, 10)] || emptyDay();
}

function emptyDay() {
  return { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, calls: 0, cost: 0 };
}

function totalTokens(d) {
  return d.inputTokens + d.cacheWriteTokens + d.cacheReadTokens + d.outputTokens;
}

// ── Tray ─────────────────────────────────────────────────────────────────────

function updateTray() {
  if (!tray) return;
  const t     = getTodayData();
  const tok   = totalTokens(t);
  const label = tok >= 1000
    ? `$${t.cost.toFixed(3)} · ${(tok / 1000).toFixed(1)}k`
    : `$${t.cost.toFixed(3)} · ${tok}`;
  tray.setTitle(label);
  tray.setToolTip(`Claude Usage Today\n${t.calls} calls · ${tok.toLocaleString()} tokens · $${t.cost.toFixed(4)}`);
  tray.setContextMenu(buildMenu());
}

function buildMenu() {
  const t = getTodayData();
  return Menu.buildFromTemplate([
    { label: 'Claude Usage Tracker', enabled: false },
    { type: 'separator' },
    { label: `Today: $${t.cost.toFixed(4)}`,                             enabled: false },
    { label: `Tokens: ${totalTokens(t).toLocaleString()}`,               enabled: false },
    { label: `Calls: ${t.calls}`,                                        enabled: false },
    { type: 'separator' },
    { label: 'Open Dashboard', click: openDashboard },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

// ── Dashboard window ──────────────────────────────────────────────────────────

function openDashboard() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show(); dashboardWindow.focus(); return;
  }
  dashboardWindow = new BrowserWindow({
    width: 920, height: 700,
    titleBarStyle: 'hiddenInset',
    title: 'Claude Usage Tracker',
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  dashboardWindow.loadFile(path.join(__dirname, 'dashboard.html'));
  dashboardWindow.webContents.once('did-finish-load', () => {
    const { pendingDiff } = loadState(app.getPath('userData'));
    if (pendingDiff && pendingDiff.length) {
      dashboardWindow.webContents.send('pricing-diff', pendingDiff);
    }
  });
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
}

function pushStatsUpdate() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.webContents.send('stats-update', getStats());
  }
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle('get-stats', () => getStats());

ipcMain.handle('clear-today', () => {
  const today = new Date().toISOString().slice(0, 10);
  browserCalls = browserCalls.filter(c => !c.ts.startsWith(today));
  updateTray();
  return getStats();
});

ipcMain.handle('get-pricing-state', () => {
  return loadState(app.getPath('userData'));
});

ipcMain.handle('apply-pricing-update', (_, diffs) => {
  const userData  = app.getPath('userData');
  const overrides = loadOverrides(userData);
  for (const { key, fetched } of diffs) {
    overrides[key] = fetched;
  }
  saveOverrides(userData, overrides);
  setPricingOverrides(overrides);
  // Clear pending diff from state
  const state = loadState(userData);
  saveState_internal(userData, { ...state, pendingDiff: null });
  // Recalculate costs with new rates
  refresh();
  return getStats();
});

ipcMain.handle('dismiss-pricing-diff', () => {
  const userData = app.getPath('userData');
  const state    = loadState(userData);
  saveState_internal(userData, { ...state, pendingDiff: null });
});

function saveState_internal(userData, state) {
  fs.writeFileSync(path.join(userData, 'pricing-state.json'), JSON.stringify(state, null, 2));
}

// ── Ingest (called by ingest_server when browser extension POSTs) ─────────────

function recordBrowserCall(payload) {
  const call = {
    id:               Date.now() + Math.random(),
    ts:               payload.timestamp || new Date().toISOString(),
    product:          payload.product || 'Claude.ai',
    model:            payload.model   || 'unknown',
    inputTokens:      payload.inputTokens      || 0,
    cacheWriteTokens: payload.cacheWriteTokens || 0,
    cacheReadTokens:  payload.cacheReadTokens  || 0,
    outputTokens:     payload.outputTokens     || 0,
    totalTokens:      (payload.inputTokens || 0) + (payload.outputTokens || 0),
    cost:             calcCost({
      model:            payload.model,
      inputTokens:      payload.inputTokens      || 0,
      cacheWriteTokens: payload.cacheWriteTokens || 0,
      cacheReadTokens:  payload.cacheReadTokens  || 0,
      outputTokens:     payload.outputTokens     || 0,
    }),
  };
  browserCalls = [call, ...browserCalls].slice(0, 500);
  updateTray();
  pushStatsUpdate();
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.dock?.hide();
  app.setLoginItemSettings({ openAtLogin: true });

  // Apply any saved pricing overrides before first render
  const userData = app.getPath('userData');
  const savedOverrides = loadOverrides(userData);
  if (Object.keys(savedOverrides).length) setPricingOverrides(savedOverrides);

  tray = new Tray(createMenuBarIcon());
  tray.setContextMenu(buildMenu());
  tray.on('click', openDashboard);

  refresh();

  // Weekly pricing check: run on startup if due, then re-check every week
  function checkPricing() {
    if (!isDue(userData)) return;
    runCheck(userData, PRICING).then(diffs => {
      if (!diffs.length) return;
      if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.webContents.send('pricing-diff', diffs);
      }
    }).catch(() => { /* network unavailable — silent fail */ });
  }
  checkPricing();
  setInterval(checkPricing, WEEK_MS);

  // Watch ~/.claude/projects for new JSONL data written by Claude Code
  try {
    fs.watch(PROJECTS_DIR, { recursive: true }, (_, filename) => {
      if (filename?.endsWith('.jsonl')) refresh();
    });
  } catch {
    setInterval(refresh, 30_000);
  }

  // Watch Cowork session JSONL files
  try {
    fs.watch(COWORK_SESSIONS_DIR, { recursive: true }, (_, filename) => {
      if (filename?.endsWith('.jsonl')) refresh();
    });
  } catch { /* Cowork not installed — ignore */ }


  setInterval(updateTray, 5_000);

  startIngestServer(recordBrowserCall);
});

app.on('window-all-closed', e => e.preventDefault());
