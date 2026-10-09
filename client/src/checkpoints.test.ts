import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseCheckpoints } from './checkpoints'

test('a pasted playlist keeps only the numbered titles', () => {
  const pasted = `
15:46
1. Before we Start
rish현
148K
4y ago


4:14:09
2. Essential C and C++ Concepts
rish현
39K
4y ago



23. Asymptotic Notations
rish현
3.3K
1y ago
`
  assert.deepEqual(parseCheckpoints(pasted), ['Before we Start', 'Essential C and C++ Concepts', 'Asymptotic Notations'])
})

test('a plain list loses its bullets, blank lines and repeats', () => {
  assert.deepEqual(parseCheckpoints('- Arrays\n* Strings\n\n[ ] Trees\n• Graphs\narrays'), ['Arrays', 'Strings', 'Trees', 'Graphs'])
})

test('durations, view counts and dates are dropped from a plain list', () => {
  assert.deepEqual(parseCheckpoints('Recursion\n5:06:09\n24K\n1y ago\nStack\n26K views\n3 months ago'), ['Recursion', 'Stack'])
})

test('a single numbered line among others is just a title', () => {
  assert.deepEqual(parseCheckpoints('Learn the basics\n2. pointer chapter'), ['Learn the basics', '2. pointer chapter'])
})

test('long titles are cut to the limit', () => {
  assert.equal(parseCheckpoints(`a\n${'x'.repeat(120)}`)[1].length, 80)
})
