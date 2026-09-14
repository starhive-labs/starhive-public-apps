/**
 * The matcher, run against the branch names a real workspace actually has.
 *
 * `npm run test:sync` compiles sync.ts and branchName.ts (neither imports anything) and executes
 * this. The cases are taken from starhive-development's own branch list, because a matcher that only
 * recognises names this app produced would find nothing on the day it is installed.
 */
import { candidateKeys, matchWorkItem, planSync } from '../.branch-name-check/sync.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}`)
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
}

console.log('reading keys out of real branch names')
eq('jira key at the front', candidateKeys('LYNX-1015-reduce-query-to-open-search'), ['lynx-1015'])
eq('key after a prefix segment', candidateKeys('ME/STAR-2642'), ['star-2642'])
eq('this app’s own naming', candidateKeys('wi-1-test'), ['wi-1'])
eq('sequence and a repeat marker', candidateKeys('LYNX-105-be-create-starql-date-time-functions-3'), [
  'lynx-105',
  'functions-3',
])
eq('no key at all', candidateKeys('fix-the-flaky-test'), [])
eq('numbers alone are not keys', candidateKeys('2026-09-07-release'), [])

console.log('\nmatching to work items')
const index = {
  byKey: { 'lynx-1015': 'wi-a', 'star-2642': 'wi-b', 'wi-1': 'wi-c' },
  byLabel: { 'add-the-code-panel': 'wi-d' },
}
eq('by key', matchWorkItem('LYNX-1015-reduce-query', index), 'wi-a')
eq('by key after a prefix', matchWorkItem('ME/STAR-2642', index), 'wi-b')
eq('first resolvable key wins over a later lookalike', matchWorkItem('LYNX-1015-fix-functions-3', index), 'wi-a')
eq('falls back to the label', matchWorkItem('add-the-code-panel', index), 'wi-d')
eq('nothing recognised', matchWorkItem('fix-the-flaky-test', index), undefined)
// The trap a naive prefix match falls into: wi-1 must not claim wi-12's branch.
eq('a shorter key does not claim a longer one', matchWorkItem('wi-12-other', index), undefined)

console.log('\nplanning')
const candidate = (ref, matchOn, kind = 'branch') => ({
  kind,
  project: 'g/p',
  ref,
  title: ref,
  url: '',
  state: 'active',
  matchOn,
})
const plan = planSync(
  [
    candidate('LYNX-1015-reduce-query', 'LYNX-1015-reduce-query'),
    candidate('fix-the-flaky-test', 'fix-the-flaky-test'),
    candidate('42', 'ME/STAR-2642', 'merge-request'),
    candidate('wi-1-test', 'wi-1-test'),
  ],
  index,
  new Set(['branch:g/p:wi-1-test']),
)
eq('matched', plan.matched.map((m) => `${m.ref}->${m.workItemId}`), [
  'LYNX-1015-reduce-query->wi-a',
  '42->wi-b',
])
eq('unmatched is reported, not guessed', plan.unmatched.map((u) => u.ref), ['fix-the-flaky-test'])
eq('already linked is counted', plan.alreadyLinked, 1)

console.log(`\n${failed === 0 ? 'all checks passed' : failed + ' CHECK(S) FAILED'}`)
process.exit(failed ? 1 : 0)
