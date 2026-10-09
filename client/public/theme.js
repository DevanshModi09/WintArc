// Loaded before first paint so there is no flash of the wrong theme. It lives
// in its own file because the content security policy forbids inline scripts.
var saved = null
var font = null
try {
  saved = localStorage.getItem('theme')
  font = localStorage.getItem('themeFont')
} catch {
  // Storage is blocked: the default theme it is.
}
// The names the first light and dark themes were saved under.
if (saved === 'light') saved = 'linear-light'
if (saved === 'dark') saved = 'linear'
// Dark is the default whatever the system is set to.
var theme = saved || 'linear'
document.documentElement.dataset.theme = theme

var href = saved && font ? font : 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
// Only ever a Google Fonts stylesheet, whatever storage says.
if (href && href.indexOf('https://fonts.googleapis.com/css2?') === 0) {
  var link = document.createElement('link')
  link.id = 'theme-font'
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}
