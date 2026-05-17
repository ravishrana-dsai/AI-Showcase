// Runs in the ISOLATED content-script world.
// Listens for usage events posted by network_hook.js (MAIN world) and
// forwards them to the background service worker via chrome.runtime.sendMessage.
window.addEventListener('message', event => {
  if (event.source !== window || event.data?.type !== '__claude_tracker_usage') return;
  chrome.runtime.sendMessage({ type: 'usage', payload: event.data.payload });
});
