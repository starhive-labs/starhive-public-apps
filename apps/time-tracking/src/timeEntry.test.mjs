/**
 * The duration parser, the period arithmetic and the StarQL fragments, run.
 *
 * Plain node, no test runner: `npm test` compiles `timeEntry.ts` on its own (it imports nothing)
 * and executes this. These are the rules that look right and are wrong for `1,5`, for a Monday, or
 * for anyone west of Greenwich.
 */
import {
  asTypeIds,
  dateFromIso,
  formatDayShort,
  formatRange,
  nextDayIso,
  previousDayIso,
  rangeFor,
  entrySummary,
  formatHours,
  hoursToStored,
  localDateIso,
  monthKeysBetween,
  monthLabel,
  nextMonthKey,
  parseDuration,
  periodRange,
  readConfig,
  roundHours,
  starqlFor,
  whereFor,
} from '../.test-build/timeEntry.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${label}\n        got  ${JSON.stringify(got)}${ok ? '' : `\n        want ${JSON.stringify(want)}`}`,
  )
}
const near = (label, got, want) => {
  const ok = got !== null && Math.abs(got - want) < 1e-9
  if (!ok) failed++
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${label}\n        got  ${got}${ok ? '' : `\n        want ${want}`}`,
  )
}

console.log('parseDuration')
near('a bare number is hours', parseDuration('1.5'), 1.5)
near('a comma is a decimal point', parseDuration('1,5'), 1.5)
near('leading dot', parseDuration('.5'), 0.5)
near('h:mm', parseDuration('1:30'), 1.5)
near('h:mm with a single digit minute', parseDuration('2:5'), 2 + 5 / 60)
near('hours unit', parseDuration('2h'), 2)
near('hours and minutes', parseDuration('1h 30m'), 1.5)
near('hours and minutes, no space', parseDuration('1h30m'), 1.5)
near('hours then bare minutes', parseDuration('1h30'), 1.5)
near('minutes only', parseDuration('90m'), 1.5)
near('minutes spelt out', parseDuration('45 min'), 0.75)
near('hours spelt out', parseDuration('2 hours'), 2)
near('decimal hours with unit', parseDuration('1.5h'), 1.5)
near('hr', parseDuration('3hrs'), 3)
near('surrounding space and case', parseDuration('  1H 15M  '), 1.25)
eq('empty is nothing', parseDuration(''), null)
eq('zero is not a duration', parseDuration('0'), null)
eq('negative is not a duration', parseDuration('-1'), null)
eq('words are not a duration', parseDuration('an hour'), null)
eq('a stray unit is not a duration', parseDuration('1h 30x'), null)
eq('minutes past 59 in h:mm is not a duration', parseDuration('1:75'), null)

console.log('roundHours')
near('0 keeps what was typed', roundHours(1.17, 0), 1.17)
near('to the quarter hour, up', roundHours(1 + 10 / 60, 15), 1.25)
near('to the quarter hour, down', roundHours(1 + 5 / 60, 15), 1)
near('never to zero', roundHours(0.02, 15), 0.25)
near('to the half hour', roundHours(1.7, 30), 1.5)

console.log('formatHours')
eq('whole hours', formatHours(8), '8h')
eq('hours and minutes', formatHours(2.5), '2h 30m')
eq('minutes only', formatHours(0.75), '45m')
eq('a third of an hour is 20m, not 19m', formatHours(1 / 3), '20m')
eq('zero', formatHours(0), '0h')
eq('stored as two decimals', hoursToStored(1 / 3), '0.33')

console.log('dates')
eq('local date, not UTC', localDateIso(new Date(2026, 8, 15, 0, 30)), '2026-09-15')
eq('month label', monthLabel('2026-09'), 'Sep 2026')
eq('next month', nextMonthKey('2026-12'), '2027-01')
eq('months between', monthKeysBetween('2026-11', '2027-02'), [
  '2026-11',
  '2026-12',
  '2027-01',
  '2027-02',
])
eq('months between, one', monthKeysBetween('2026-11', '2026-11'), ['2026-11'])
eq('months between, reversed is empty', monthKeysBetween('2026-11', '2026-10'), [])

// `new Date('2026-09-16')` is UTC midnight, i.e. the 15th for anyone west of Greenwich. Every period
// is reckoned from this, so getting it wrong shifts a whole month's report by a day.
eq('a bare day is local midnight, not UTC', dateFromIso('2026-09-16').getDate(), 16)
eq('…and the right month', dateFromIso('2026-09-16').getMonth(), 8)
eq('…and the right year', dateFromIso('2026-09-16').getFullYear(), 2026)
eq('midnight local', dateFromIso('2026-09-16').getHours(), 0)
eq(
  'a period reckoned from a parsed day matches one reckoned from the Date itself',
  periodRange('month', dateFromIso('2026-09-16')),
  periodRange('month', new Date(2026, 8, 16)),
)

console.log('periodRange')
const wednesday = new Date(2026, 8, 16, 12) // Wed 16 Sep 2026
eq('this week starts Monday, ends before next Monday', periodRange('week', wednesday), {
  from: '2026-09-14',
  to: '2026-09-21',
})
eq(
  'this week on a Sunday still starts the Monday before',
  periodRange('week', new Date(2026, 8, 20)),
  { from: '2026-09-14', to: '2026-09-21' },
)
eq('this month', periodRange('month', wednesday), { from: '2026-09-01', to: '2026-10-01' })
eq('last month', periodRange('lastMonth', wednesday), { from: '2026-08-01', to: '2026-09-01' })
eq('last month across a year boundary', periodRange('lastMonth', new Date(2026, 0, 10)), {
  from: '2025-12-01',
  to: '2026-01-01',
})
eq('this quarter', periodRange('quarter', wednesday), { from: '2026-07-01', to: '2026-10-01' })
eq('this quarter in December ends next year', periodRange('quarter', new Date(2026, 11, 3)), {
  from: '2026-10-01',
  to: '2027-01-01',
})
eq('this year', periodRange('year', wednesday), { from: '2026-01-01', to: '2027-01-01' })
eq('all time is unbounded', periodRange('all', wednesday), {})

console.log('custom ranges')
// The pair a person picks is inclusive at both ends, because that is what the picker shows and what
// "the 1st to the 30th" means. Everything downstream wants `to` exclusive. Losing this conversion
// drops the last day of every custom report, quietly and plausibly.
eq(
  'the last day picked is counted in',
  rangeFor({ period: 'custom', from: '2026-09-01', to: '2026-09-30' }),
  { from: '2026-09-01', to: '2026-10-01' },
)
eq(
  'a single day is a real range',
  rangeFor({ period: 'custom', from: '2026-09-16', to: '2026-09-16' }),
  { from: '2026-09-16', to: '2026-09-17' },
)
eq(
  'crossing a month end',
  rangeFor({ period: 'custom', from: '2026-01-30', to: '2026-01-31' }),
  { from: '2026-01-30', to: '2026-02-01' },
)
eq(
  'crossing a year end',
  rangeFor({ period: 'custom', from: '2026-12-30', to: '2026-12-31' }),
  { from: '2026-12-30', to: '2027-01-01' },
)
eq(
  'a leap day',
  rangeFor({ period: 'custom', from: '2028-02-28', to: '2028-02-29' }),
  { from: '2028-02-28', to: '2028-03-01' },
)
eq('only a start bounds only the start', rangeFor({ period: 'custom', from: '2026-09-01' }), {
  from: '2026-09-01',
  to: undefined,
})
eq('only an end bounds only the end', rangeFor({ period: 'custom', to: '2026-09-30' }), {
  from: undefined,
  to: '2026-10-01',
})
eq('nothing picked yet bounds nothing', rangeFor({ period: 'custom' }), {
  from: undefined,
  to: undefined,
})
eq(
  'a preset still goes through periodRange',
  rangeFor({ period: 'month' }, wednesday),
  periodRange('month', wednesday),
)
eq('a custom period on its own bounds nothing', periodRange('custom', wednesday), {})

console.log('day steps')
eq('next day', nextDayIso('2026-09-16'), '2026-09-17')
eq('next day over a month end', nextDayIso('2026-09-30'), '2026-10-01')
eq('next day over a year end', nextDayIso('2026-12-31'), '2027-01-01')
eq('previous day', previousDayIso('2026-09-16'), '2026-09-15')
eq('previous day over a month start', previousDayIso('2026-10-01'), '2026-09-30')
eq('previous day over a year start', previousDayIso('2027-01-01'), '2026-12-31')
eq('a round trip is the same day', previousDayIso(nextDayIso('2026-02-28')), '2026-02-28')

console.log('range labels')
eq('a day in this year drops the year', formatDayShort('2026-09-16', wednesday), '16 Sep')
eq('a day in another year keeps it', formatDayShort('2025-09-16', wednesday), '16 Sep 2025')
eq('a range in this year', formatRange('2026-09-16', '2026-09-20', wednesday), '16 Sep – 20 Sep')
// Both ends carry the year or neither does: one end alone reads as though the other were elsewhere.
eq(
  'a range in another year carries the year on both ends',
  formatRange('2025-09-16', '2025-09-20', wednesday),
  '16 Sep 2025 – 20 Sep 2025',
)
eq(
  'a range straddling New Year is never ambiguous',
  formatRange('2026-12-30', '2027-01-02', wednesday),
  '30 Dec 2026 – 2 Jan 2027',
)
eq('half a range', formatRange('2026-09-16', undefined, wednesday), '16 Sep onwards')
eq('the other half', formatRange(undefined, '2026-09-20', wednesday), 'up to 20 Sep')
eq('neither half', formatRange(undefined, undefined, wednesday), 'any time')

console.log('StarQL')
eq('no filter is no predicate', whereFor({}), '')
// `==` and not `=`: the id lives in a TEXT attribute, where `=` is analyzed and a uuid is several
// tokens. This assertion is the whole reason the id can be stored as text at all.
eq('by object, strictly', whereFor({ workItemId: 'abc' }), '"Work item id" == "abc"')
eq('by type', whereFor({ workItemTypeId: 't1' }), '"Work item type id" == "t1"')
eq('by person', whereFor({ userId: 'u1' }), '"Logged by" = userId("u1")')
eq(
  'by everything, joined with and',
  whereFor({
    workItemId: 'abc',
    workItemTypeId: 't1',
    userId: 'u1',
    range: { from: '2026-09-01', to: '2026-10-01' },
  }),
  '"Work item id" == "abc" and "Work item type id" == "t1" and "Logged by" = userId("u1") and "Date" >= "2026-09-01" and "Date" < "2026-10-01"',
)
eq('an open-ended range', whereFor({ range: { from: '2026-09-01' } }), '"Date" >= "2026-09-01"')
eq('a quote in a value is escaped', whereFor({ workItemId: 'a"b' }), '"Work item id" == "a\\"b"')
eq('list order, newest work first', starqlFor({}), 'order by "Date" desc, Created desc')
eq(
  'list order after a predicate',
  starqlFor({ userId: 'u1' }),
  '"Logged by" = userId("u1") order by "Date" desc, Created desc',
)

console.log('labels')
eq(
  'the description is the label',
  entrySummary({
    hours: 2,
    dateIso: '2026-09-15',
    userName: 'Jane',
    description: '  Fixed the build ',
  }),
  'Fixed the build',
)
eq(
  'without one, what·who·when',
  entrySummary({ hours: 2.5, dateIso: '2026-09-15', userName: 'Jane Doe' }),
  '2h 30m · Jane Doe · 2026-09-15',
)
eq('without a name either', entrySummary({ hours: 0.5, dateIso: '2026-09-15' }), '30m · 2026-09-15')
eq(
  'a long description is cut to 117 characters and an ellipsis',
  entrySummary({ hours: 1, dateIso: '2026-09-15', description: 'x'.repeat(200) }),
  `${'x'.repeat(117)}…`,
)

console.log('config')
eq('defaults', readConfig(undefined), { workItemTypes: [], roundingMinutes: 0 })
eq('a negative rounding is ignored', readConfig({ roundingMinutes: -5 }), {
  workItemTypes: [],
  roundingMinutes: 0,
})
eq('as saved', readConfig({ workItemTypes: ['t1', 't2'], roundingMinutes: 15 }), {
  workItemTypes: ['t1', 't2'],
  roundingMinutes: 15,
})
// The platform seeds a manifest default as the string it was declared as, even for a `multi` field,
// so a fresh install arrives with one type and no brackets.
eq('a lone string is one type', readConfig({ workItemTypes: 't1' }), {
  workItemTypes: ['t1'],
  roundingMinutes: 0,
})

console.log('asTypeIds')
eq('nothing', asTypeIds(undefined), [])
eq('null', asTypeIds(null), [])
eq('a string', asTypeIds('t1'), ['t1'])
eq('a list', asTypeIds(['t1', 't2']), ['t1', 't2'])
eq('blanks are dropped', asTypeIds(['t1', '', '   ']), ['t1'])
eq('surrounding space is trimmed', asTypeIds([' t1 ']), ['t1'])
eq('duplicates collapse', asTypeIds(['t1', 't1', 't2']), ['t1', 't2'])
eq('non-strings are dropped', asTypeIds(['t1', 42, null, {}]), ['t1'])

console.log(failed ? `\n${failed} failed` : '\nall passed')
process.exit(failed ? 1 : 0)
