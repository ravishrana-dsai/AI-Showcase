// Runs in the MAIN world (direct page context, bypasses CSP).
// Wraps window.fetch to intercept SSE responses from claude.ai.

const originalFetch = window.fetch.bind(window);

window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : (input?.url || '');
  const response = await originalFetch(input, init);
  const ct = response.headers.get('content-type') || '';

  // Match both the claude.ai frontend API and the direct Anthropic API
  const isClaudeApi = url.includes('/api/organizations') ||
                      url.includes('/api/append_message') ||
                      url.includes('completion') ||
                      url.includes('/chat_conversations') ||
                      url.includes('a-api.anthropic.com') ||
                      url.includes('api.anthropic.com/v1/messages');

  if (!isClaudeApi) return response;
  if (!ct.includes('text/event-stream')) return response;

  const [original, copy] = response.body.tee();
  parseSSE(copy).then(data => {
    if (data.inputTokens || data.outputTokens) {
      window.postMessage({ type: '__claude_tracker_usage', payload: data }, '*');
    }
  });

  return new Response(original, {
    status:     response.status,
    statusText: response.statusText,
    headers:    response.headers,
  });
};

async function parseSSE(body) {
  let inputTokens  = 0;
  let outputTokens = 0;
  let model        = 'unknown';

  try {
    const reader  = body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const raw = line.slice(5).trim();
        if (!raw || raw === '[DONE]') continue;
        let event;
        try { event = JSON.parse(raw); } catch { continue; }

        if (event.type === 'message_start') {
          const usage = event.message?.usage;
          inputTokens = usage?.input_tokens || inputTokens;
          model       = event.message?.model || model;
        }
        if (event.type === 'message_delta') {
          outputTokens = event.usage?.output_tokens || outputTokens;
        }
      }
    }
  } catch { /* stream closed */ }

  return { product: 'Claude.ai', model, inputTokens, outputTokens, timestamp: new Date().toISOString() };
}
