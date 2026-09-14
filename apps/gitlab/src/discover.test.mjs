/**
 * The two rules that stand between a substring search and a write onto somebody's work item.
 *
 * `npm test` compiles discover.ts (which imports only branchName.ts) and runs this. The cases that
 * matter are the near misses: a key that is a prefix of another key, and a sequence value too thin
 * to be anybody's identifier. Both of those look like features until they link the wrong thing.
 */
import { carriesKey, searchTermFor } from '../.branch-name-check/discover.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}`)
  if (!ok) console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`)
}

console.log('deciding what is safe to search for')
eq('an ordinary key', searchTermFor('STAR-2642'), 'STAR-2642')
eq('no prefix configured — a bare number matches everything', searchTermFor('42'), undefined)
eq('a long bare number is no better', searchTermFor('1024768'), undefined)
eq('no dash needed', searchTermFor('INC0001234'), 'INC0001234')
eq('one letter is not a prefix', searchTermFor('x-1'), undefined)
eq('a key with no digits identifies nothing', searchTermFor('RELEASE'), undefined)
eq('a year is not a key', searchTermFor('2026'), undefined)
eq('nothing to search', searchTermFor(undefined), undefined)
eq('unset', searchTermFor(''), undefined)
eq('whitespace is not a value', searchTermFor('   '), undefined)
eq('sent as stored, not as slugged', searchTermFor('  STAR-2642 '), 'STAR-2642')

console.log('\nholding a substring hit to a whole key')
eq('the name this app produces', carriesKey('me/star-2642-fix-the-thing', 'STAR-2642'), true)
eq('a name from whatever came before', carriesKey('ME/STAR-2642', 'STAR-2642'), true)
eq('case is decided here, not by the host', carriesKey('feature/star-2642', 'STAR-2642'), true)
eq('the key alone', carriesKey('STAR-2642', 'STAR-2642'), true)
eq('at the end, after a slash', carriesKey('fix/the-thing-STAR-2642', 'STAR-2642'), true)
eq('a merge request title and description', carriesKey('Fix the thing Closes STAR-2642', 'STAR-2642'), true)

console.log('\nand the near misses it exists for')
eq('a longer number is a different work item', carriesKey('me/star-26420-other', 'STAR-2642'), false)
eq('a shorter one, too', carriesKey('me/star-264-other', 'STAR-2642'), false)
eq('STAR-1 does not own STAR-12', carriesKey('star-12-something', 'STAR-1'), false)
eq('nor STAR-123', carriesKey('star-123-something', 'STAR-1'), false)
eq('but STAR-1 is still STAR-1', carriesKey('star-1-something', 'STAR-1'), true)
eq('a different project prefix', carriesKey('lynx-2642-fix', 'STAR-2642'), false)
eq('digits run together', carriesKey('star2642-fix', 'STAR-2642'), false)
eq('nothing there at all', carriesKey('fix-the-flaky-test', 'STAR-2642'), false)
eq('an empty key matches nothing', carriesKey('star-2642', ''), false)

console.log(failed === 0 ? '\nall ok' : `\n${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
