// Loaded before first paint so there is no flash of the wrong theme. It lives
// in its own file because the content security policy forbids inline scripts.
try {
  var saved = localStorage.getItem('theme')
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
} catch {
  // Storage is blocked: fall back to the light theme.
}
