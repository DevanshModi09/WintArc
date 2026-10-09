import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { THEMES } from './themes'

const css = readFileSync(new URL('./themes.css', import.meta.url), 'utf8')

// The declarations of one theme's block, by name.
function block(id: string) {
  const body = css.match(new RegExp(`\\[data-theme='${id}'\\] \\{([^}]*)\\}`))?.[1]
  assert.ok(body, `themes.css has no block for "${id}"`)
  return Object.fromEntries(body.split(';').flatMap((line) => (line.includes(':') ? [line.split(/:(.*)/s).slice(0, 2).map((p) => p.trim())] : [])))
}

// WCAG contrast ratio between two "#rrggbb" colours.
function contrast(a: string, b: string) {
  const luminance = (hex: string) => {
    const [r, g, bl] = [0, 1, 2].map((i) => {
      const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('every theme in the list has a block in themes.css, and the other way round', () => {
  const inCss = [...css.matchAll(/\[data-theme='([^']+)'\] \{/g)].map((m) => m[1])
  assert.deepEqual(inCss.sort(), THEMES.map((t) => t.id).sort())
  assert.equal(new Set(inCss).size, inCss.length)
})

test('every theme keeps its text readable', () => {
  for (const { id } of THEMES) {
    const v = block(id)
    for (const surface of ['--color-bg', '--color-raised', '--color-surface']) {
      assert.ok(contrast(v['--color-fg'], v[surface]) >= 7, `${id}: text on ${surface}`)
      assert.ok(contrast(v['--color-muted'], v[surface]) >= 4.5, `${id}: muted text on ${surface}`)
    }
    assert.ok(contrast(v['--color-btn-text'], v['--color-btn']) >= 3, `${id}: button label`)
  }
})

test("a theme's colour scheme matches how dark its page is", () => {
  for (const { id, scheme } of THEMES) {
    const v = block(id)
    assert.equal(v['color-scheme'], scheme, id)
    assert.equal(contrast(v['--color-bg'], '#000000') < contrast(v['--color-bg'], '#ffffff'), scheme === 'dark', id)
  }
})
