/** Inline script to prevent theme flash. Runs before React. */
export function ThemeScript() {
  const script = `
(function() {
  var key = 'theme';
  var stored = localStorage.getItem(key);
  var root = document.documentElement;
  var dark = false;
  if (stored === 'dark') dark = true;
  else if (stored === 'light') dark = false;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) dark = true;
  if (dark) { root.classList.add('dark'); root.classList.remove('light'); }
  else { root.classList.add('light'); root.classList.remove('dark'); }
})();
`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
