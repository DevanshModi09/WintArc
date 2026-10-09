// The looks the app can wear. The values themselves live in themes.css, one
// block per id; this is the list the picker shows, plus the web fonts each
// one needs. Linear, dark, is what the app wears until someone picks
// otherwise. Cream and Ink are the app's own pair and Classic is the original
// black and white. Linear and the rest are inspired by the public design write-ups
// collected at getdesign.md, and aren't affiliated with those companies.

export type Theme = {
  id: string
  name: string
  scheme: 'light' | 'dark'
  // The Google Fonts families to load, or null for a system typeface.
  fonts: string | null
}

export const THEMES: Theme[] = [
  { id: 'linear', name: 'Linear', scheme: 'dark', fonts: 'Inter:wght@400;500;600' },
  { id: 'linear-light', name: 'Linear Light', scheme: 'light', fonts: 'Inter:wght@400;500;600' },
  { id: 'cream', name: 'Cream', scheme: 'light', fonts: 'Sofia+Sans:wght@400..700' },
  { id: 'ink', name: 'Ink', scheme: 'dark', fonts: 'Sofia+Sans:wght@400..700' },
  { id: 'classic', name: 'Classic', scheme: 'light', fonts: 'Space+Grotesk:wght@400;500;600;700' },
  { id: 'stripe', name: 'Stripe', scheme: 'light', fonts: 'Hanken+Grotesk:wght@300;400;500;600' },
  { id: 'notion', name: 'Notion', scheme: 'light', fonts: 'Inter:wght@400;500;600;700' },
  { id: 'apple', name: 'Apple', scheme: 'light', fonts: null },
  { id: 'vercel', name: 'Vercel', scheme: 'light', fonts: 'Geist:wght@400;500;600' },
  { id: 'airbnb', name: 'Airbnb', scheme: 'light', fonts: 'Figtree:wght@400;500;600;700' },
  { id: 'spotify', name: 'Spotify', scheme: 'dark', fonts: 'DM+Sans:wght@400;500;700' },
  { id: 'figma', name: 'Figma', scheme: 'light', fonts: 'Albert+Sans:wght@300;400;500' },
  { id: 'claude', name: 'Claude', scheme: 'light', fonts: 'Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500' },
  { id: 'supabase', name: 'Supabase', scheme: 'dark', fonts: 'DM+Sans:wght@400;500;700' },
  { id: 'uber', name: 'Uber', scheme: 'light', fonts: 'Inter+Tight:wght@400;500;700' },
  { id: 'nike', name: 'Nike', scheme: 'light', fonts: null },
  { id: 'ferrari', name: 'Ferrari', scheme: 'dark', fonts: 'Titillium+Web:wght@400;600;700' },
  { id: 'ibm', name: 'IBM', scheme: 'light', fonts: 'IBM+Plex+Sans:wght@300;400;500;600' },
  { id: 'slack', name: 'Slack', scheme: 'light', fonts: 'Lato:wght@400;700;900' },
  { id: 'pinterest', name: 'Pinterest', scheme: 'light', fonts: 'Manrope:wght@400;500;700' },
  { id: 'starbucks', name: 'Starbucks', scheme: 'light', fonts: 'Lato:wght@400;700;900' },
  { id: 'shopify', name: 'Shopify', scheme: 'light', fonts: 'Inter:wght@300;400;500;600' },
  { id: 'raycast', name: 'Raycast', scheme: 'dark', fonts: 'Inter:wght@400;500;600' },
  { id: 'cursor', name: 'Cursor', scheme: 'light', fonts: 'Schibsted+Grotesk:wght@400;500;600' },
  { id: 'posthog', name: 'PostHog', scheme: 'light', fonts: 'IBM+Plex+Sans:wght@400;500;700' },
  { id: 'wired', name: 'Wired', scheme: 'light', fonts: 'Work+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400;6..72,500' },
  { id: 'nintendo', name: 'Nintendo 2001', scheme: 'light', fonts: null },
  { id: 'revolut', name: 'Revolut', scheme: 'light', fonts: 'Inter:wght@400;500;600&family=Outfit:wght@400;500;600' },
  { id: 'coinbase', name: 'Coinbase', scheme: 'light', fonts: 'Inter:wght@400;500;600' },
]

const FONT_LINK = 'theme-font'

const fontHref = (theme: Theme) =>
  theme.fonts ? `https://fonts.googleapis.com/css2?family=${theme.fonts}&display=swap` : null

export const DEFAULT_THEME = 'linear'

// Themes that are the light and dark of one design.
const PAIRS: Record<string, string> = { linear: 'linear-light', 'linear-light': 'linear', cream: 'ink', ink: 'cream' }

export function currentTheme(): Theme {
  const id = document.documentElement.dataset.theme ?? DEFAULT_THEME
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// The theme a light/dark switch should land on from this one: its own other
// half if it has one, otherwise the default design in the opposite mode.
export function oppositeMode(theme: Theme): Theme {
  const id = PAIRS[theme.id] ?? (theme.scheme === 'dark' ? 'linear-light' : 'linear')
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

// Points the font <link> at this theme's typeface, adding it if need be.
function loadFont(id: string, href: string | null) {
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!href) return link?.remove()
  if (!link) {
    link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    document.head.append(link)
  }
  if (link.href !== href) link.href = href
}

export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme.id
  const href = fontHref(theme)
  loadFont(FONT_LINK, href)
  try {
    localStorage.setItem('theme', theme.id)
    // Kept alongside so the font can start loading before the app does.
    if (href) localStorage.setItem('themeFont', href)
    else localStorage.removeItem('themeFont')
  } catch {
    // Private browsing: the choice just won't be remembered.
  }
}

// Every theme's typeface in one request, for the picker's previews.
export function loadAllFonts() {
  const families = [...new Set(THEMES.flatMap((t) => t.fonts?.split('&family=') ?? []))]
  loadFont('theme-fonts-all', `https://fonts.googleapis.com/css2?family=${families.join('&family=')}&display=swap`)
}
