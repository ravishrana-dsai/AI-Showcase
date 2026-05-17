const INGEST_URL = 'http://127.0.0.1:9877/ingest';

// Persist a running session total in extension storage so the popup can read it
async function addToStorage(payload) {
  const { daily = {} } = await chrome.storage.local.get('daily');
  const today = new Date().toISOString().slice(0, 10);
  if (!daily[today]) daily[today] = { inputTokens: 0, outputTokens: 0, calls: 0, cost: 0 };
  daily[today].inputTokens  += payload.inputTokens  || 0;
  daily[today].outputTokens += payload.outputTokens || 0;
  daily[today].calls        += 1;
  await chrome.storage.local.set({ daily, lastCall: payload });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'usage') return;
  const payload = message.payload;

  addToStorage(payload);

  // Forward to the Electron tracker app; silently ignore if it's not running
  fetch(INGEST_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  }).catch(() => {});
});
