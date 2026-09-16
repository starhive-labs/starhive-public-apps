/**
 * The report arithmetic, run. See `timeEntry.test.mjs` for how.
 */
import { byMonth, byPerson, byWorkItem, distinctPeople, totalHours } from '../.test-build/report.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${label}\n        got  ${JSON.stringify(got)}${ok ? '' : `\n        want ${JSON.stringify(want)}`}`,
  )
}

const entry = (over) => ({
  id: 'e',
  date: '2026-09-15',
  hours: 1,
  user: { id: 'u1', name: 'Ada' },
  workItem: { id: 'w1', label: 'Website' },
  ...over,
})

const entries = [
  entry({ id: '1', hours: 2, date: '2026-09-15' }),
  entry({ id: '2', hours: 1, date: '2026-09-16', user: { id: 'u2', name: 'Bob' } }),
  entry({ id: '3', hours: 1, date: '2026-07-02', workItem: { id: 'w2', label: 'App' } }),
]

console.log('totals')
eq('total hours', totalHours(entries), 4)
eq('total of nothing', totalHours([]), 0)
eq('distinct people', distinctPeople(entries), 2)

console.log('byPerson')
eq('most first, with shares of the whole', byPerson(entries), [
  { key: 'u1', label: 'Ada', hours: 3, count: 2, share: 0.75 },
  { key: 'u2', label: 'Bob', hours: 1, count: 1, share: 0.25 },
])
eq('nobody', byPerson([]), [])
eq(
  'ties break on name',
  byPerson([
    entry({ user: { id: 'z', name: 'Zed' } }),
    entry({ user: { id: 'a', name: 'Amy' } }),
  ]).map((share) => share.label),
  ['Amy', 'Zed'],
)
// The fallback is the word, not the id. `toEntry` writes "Unknown user" when the host sent no name,
// so that is what a group upgrades away from — and somebody actually called "u9" keeps their name.
// The earlier version of this compared the label to the group's key, which was quietly dead once a
// work item came to be keyed by its uuid.
eq(
  'a real name replaces the fallback',
  byPerson([
    entry({ user: { id: 'u9', name: 'Unknown user' } }),
    entry({ user: { id: 'u9', name: 'Nia' } }),
  ]).map((share) => share.label),
  ['Nia'],
)
eq(
  'a name that merely looks like an id is left alone',
  byPerson([
    entry({ user: { id: 'u9', name: 'u9' } }),
    entry({ user: { id: 'u9', name: 'Nia' } }),
  ]).map((share) => share.label),
  ['u9'],
)

console.log('byWorkItem')
eq(
  'by work item',
  byWorkItem(entries).map((share) => [share.label, share.hours]),
  [
    ['Website', 3],
    ['App', 1],
  ],
)

// Entries arrive newest first. When the newest one lost its stored name — a restricted value, or a
// row written outside the app — the group must still take the name an older entry remembers, rather
// than being headed "Unknown work item" while the data to name it is right there.
eq(
  'a group takes a real name from an older entry when the newest has none',
  byWorkItem([
    entry({ id: 'new', date: '2026-09-16', workItem: { id: 'w1', label: 'Unknown work item' } }),
    entry({ id: 'old', date: '2026-09-15', workItem: { id: 'w1', label: 'Website' } }),
  ]).map((share) => share.label),
  ['Website'],
)
eq(
  'but a real name is never replaced by an older one — the newest wins a rename',
  byWorkItem([
    entry({ id: 'new', date: '2026-09-16', workItem: { id: 'w1', label: 'Website v2' } }),
    entry({ id: 'old', date: '2026-09-15', workItem: { id: 'w1', label: 'Website' } }),
  ]).map((share) => share.label),
  ['Website v2'],
)
console.log('byMonth')
const now = new Date(2026, 8, 20)
eq(
  'unbounded: from the earliest entry to now, empty months filled in',
  byMonth(entries, {}, now).map((month) => [month.key, month.hours, month.count]),
  [
    ['2026-07', 1, 1],
    ['2026-08', 0, 0],
    ['2026-09', 3, 2],
  ],
)
eq(
  'bounded: the range decides the span, not the entries',
  byMonth(entries, { from: '2026-06-01', to: '2026-10-01' }, now).map((month) => [
    month.key,
    month.hours,
  ]),
  [
    ['2026-06', 0],
    ['2026-07', 1],
    ['2026-08', 0],
    ['2026-09', 3],
  ],
)
eq(
  'an exclusive end on the 1st does not add the next month',
  byMonth(entries, { from: '2026-09-01', to: '2026-10-01' }, now).map((month) => month.key),
  ['2026-09'],
)
eq(
  'a range ending mid-month includes that month',
  byMonth([], { from: '2026-09-01', to: '2026-10-15' }, now).map((month) => month.key),
  ['2026-09', '2026-10'],
)
eq('unbounded with nothing is nothing', byMonth([], {}, now), [])
eq('labels', byMonth(entries, {}, now)[0].label, 'Jul 2026')
eq(
  'a year boundary',
  byMonth([entry({ date: '2025-11-03' })], {}, new Date(2026, 0, 5)).map((month) => month.key),
  ['2025-11', '2025-12', '2026-01'],
)

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
