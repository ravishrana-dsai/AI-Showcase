// Runs in the content-script isolated world.
// Injects network_hook.js into the page context so it can wrap window.fetch.
const script = document.createElement('script');
script.src = chrome.runtime.getURL('content/network_hook.js');
(document.head || document.documentElement).appendChild(script);
script.onload = () => script.remove();

// Relay usage events from the page context to the background service worker.
window.addEventListener('message', event => {
  if (event.source !== window || event.data?.type !== '__claude_tracker_usage') return;
  chrome.runtime.sendMessage({ type: 'usage', payload: event.data.payload });
});
