const PRICING = {
  'claude-opus-4':   { input: 15.00, output: 75.00 },
  'claude-sonnet-4': { input:  3.00, output: 15.00 },
  'claude-haiku-4':  { input:  0.80, output:  4.00 },
  'default':         { input:  3.00, output: 15.00 },
};

function estCost(model, input, output) {
  let r = PRICING.default;
  if (model) {
    const m = model.toLowerCase();
    for (const [k, v] of Object.entries(PRICING)) {
      if (k !== 'default' && m.includes(k)) { r = v; break; }
    }
  }
  return ((input * r.input) + (output * r.output)) / 1_000_000;
}

chrome.storage.local.get('daily', ({ daily = {} }) => {
  const today = new Date().toISOString().slice(0, 10);
  const d = daily[today] || { inputTokens: 0, outputTokens: 0, calls: 0 };
  document.getElementById('tokens').textContent = (d.inputTokens + d.outputTokens).toLocaleString();
  document.getElementById('calls').textContent  = d.calls;
  document.getElementById('cost').textContent   = '$' + estCost('default', d.inputTokens, d.outputTokens).toFixed(4);
});
