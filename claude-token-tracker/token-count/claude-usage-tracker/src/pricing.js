// Per-million-token rates. Cache write costs ~25% more than input; cache read ~90% less.
// Runtime overrides (applied via setPricingOverrides from loaded pricing-overrides.json)
let _overrides = {};

function setPricingOverrides(overrides) {
  _overrides = overrides || {};
}

const PRICING = {
  'claude-opus-4':   { input: 15.00, cacheWrite: 18.75, cacheRead: 1.50, output: 75.00 },
  'claude-sonnet-4': { input:  3.00, cacheWrite:  3.75, cacheRead: 0.30, output: 15.00 },
  'claude-haiku-4':  { input:  0.80, cacheWrite:  1.00, cacheRead: 0.08, output:  4.00 },
  'claude-opus-3':   { input: 15.00, cacheWrite: 18.75, cacheRead: 1.50, output: 75.00 },
  'claude-sonnet-3': { input:  3.00, cacheWrite:  3.75, cacheRead: 0.30, output: 15.00 },
  'claude-haiku-3':  { input:  0.25, cacheWrite:  0.30, cacheRead: 0.03, output:  1.25 },
  'default':         { input:  3.00, cacheWrite:  3.75, cacheRead: 0.30, output: 15.00 },
};

function getRates(model) {
  const m = (model || '').toLowerCase();
  for (const [key, rates] of Object.entries(_overrides)) {
    if (key !== 'default' && m.includes(key)) return rates;
  }
  if (!m) return _overrides.default || PRICING.default;
  for (const [key, rates] of Object.entries(PRICING)) {
    if (key !== 'default' && m.includes(key)) return rates;
  }
  return _overrides.default || PRICING.default;
}

function calcCost({ model, inputTokens = 0, cacheWriteTokens = 0, cacheReadTokens = 0, outputTokens = 0 }) {
  const r = getRates(model);
  return (
    inputTokens      * r.input      +
    cacheWriteTokens * r.cacheWrite +
    cacheReadTokens  * r.cacheRead  +
    outputTokens     * r.output
  ) / 1_000_000;
}

module.exports = { calcCost, getRates, PRICING, setPricingOverrides };
