const https = require('https');
const fs    = require('fs');
const path  = require('path');

const LITELLM_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';
const WEEK_MS     = 7 * 24 * 60 * 60 * 1000;

// Maps our PRICING keys to the prefix used in LiteLLM's model registry
const MODEL_LITELLM_PREFIXES = {
  'claude-opus-4':   'claude-opus-4',
  'claude-sonnet-4': 'claude-sonnet-4',
  'claude-haiku-4':  'claude-haiku-4',
  'claude-opus-3':   'claude-3-opus',
  'claude-sonnet-3': 'claude-3-5-sonnet',
  'claude-haiku-3':  'claude-3-haiku',
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 10000 }, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function extractRates(entry) {
  if (!entry) return null;
  const input      = entry.input_cost_per_token;
  const output     = entry.output_cost_per_token;
  const cacheWrite = entry.cache_creation_input_token_cost;
  const cacheRead  = entry.cache_read_input_token_cost;
  if (input == null || output == null) return null;
  return {
    input:      round4(input      * 1_000_000),
    output:     round4(output     * 1_000_000),
    cacheWrite: round4((cacheWrite || 0) * 1_000_000),
    cacheRead:  round4((cacheRead  || 0) * 1_000_000),
  };
}

// Returns the best-matching LiteLLM entry for a given prefix.
// Sorts matching keys and takes the last (highest version number).
function findBestEntry(litellmData, prefix) {
  const matches = Object.keys(litellmData)
    .filter(k => k.startsWith(prefix))
    .sort();
  if (!matches.length) return null;
  const key = matches[matches.length - 1];
  return { key, rates: extractRates(litellmData[key]) };
}

function diffPricing(currentPricing, litellmData) {
  const diffs = [];
  for (const [ourKey, currentRates] of Object.entries(currentPricing)) {
    if (ourKey === 'default') continue;
    const prefix = MODEL_LITELLM_PREFIXES[ourKey];
    if (!prefix) continue;
    const found = findBestEntry(litellmData, prefix);
    if (!found || !found.rates) continue;

    const { key: litellmKey, rates: fetched } = found;
    const fields = ['input', 'output', 'cacheWrite', 'cacheRead'];
    const changed = fields.some(f => Math.abs((fetched[f] || 0) - (currentRates[f] || 0)) > 0.001);
    if (changed) {
      diffs.push({ key: ourKey, litellmKey, current: currentRates, fetched });
    }
  }
  return diffs;
}

function stateFile(userData)    { return path.join(userData, 'pricing-state.json'); }
function overridesFile(userData){ return path.join(userData, 'pricing-overrides.json'); }

function loadState(userData) {
  try   { return JSON.parse(fs.readFileSync(stateFile(userData), 'utf8')); }
  catch { return { lastCheck: null, pendingDiff: null }; }
}

function saveState(userData, state) {
  fs.writeFileSync(stateFile(userData), JSON.stringify(state, null, 2));
}

function loadOverrides(userData) {
  try   { return JSON.parse(fs.readFileSync(overridesFile(userData), 'utf8')); }
  catch { return {}; }
}

function saveOverrides(userData, overrides) {
  fs.writeFileSync(overridesFile(userData), JSON.stringify(overrides, null, 2));
}

function isDue(userData) {
  const { lastCheck } = loadState(userData);
  if (!lastCheck) return true;
  return Date.now() - new Date(lastCheck).getTime() > WEEK_MS;
}

async function runCheck(userData, currentPricing) {
  const litellmData = await fetchJson(LITELLM_URL);
  const diffs = diffPricing(currentPricing, litellmData);
  const state = loadState(userData);
  saveState(userData, { ...state, lastCheck: new Date().toISOString(), pendingDiff: diffs.length ? diffs : null });
  return diffs;
}

module.exports = { runCheck, isDue, loadState, loadOverrides, saveOverrides, WEEK_MS };
