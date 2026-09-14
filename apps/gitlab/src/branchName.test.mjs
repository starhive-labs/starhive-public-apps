/**
 * The branch-naming rules, run.
 *
 * Plain node, no test runner and no dependency: `npm test` compiles `branchName.ts` on its own (it
 * imports nothing) and executes this. The rules are the kind of thing that looks obviously right and
 * is quietly wrong for Swedish labels, so they are worth running rather than reading.
 */
import {
  branchNameFrom,
  branchNameProblem,
  DEFAULT_BRANCH_TEMPLATE,
  initialsOf,
  MAX_BRANCH_NAME,
  slugify,
  unknownTokens,
} from '../.branch-name-check/branchName.js'

let failed = 0
const eq = (label, got, want) => {
  const ok = got === want
  if (!ok) failed++
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}\n        got  ${JSON.stringify(got)}${ok ? '' : `\n        want ${JSON.stringify(want)}`}`)
}
const ok = (label, cond, detail = '') => {
  if (!cond) failed++
  console.log(`${cond ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`)
}

// Everything below that is about composing a key uses this explicitly: the default deliberately
// has no key in it, because a type is not obliged to have a SEQUENCE.
const kl = (options) => branchNameFrom({ template: '{key}-{label}', ...options })

console.log('the default template')
const mathias = { name: 'Mathias Edblom' }
eq('whose it is and what it is about', branchNameFrom({ person: mathias, label: 'Add the code panel' }), 'me/add-the-code-panel')
eq('no key in it, even when there is one', branchNameFrom({ person: mathias, key: 'TASK-42', label: 'Add the code panel' }), 'me/add-the-code-panel')
eq('nobody to name it after', branchNameFrom({ label: 'Add the code panel' }), 'add-the-code-panel')
eq('nothing to say about it', branchNameFrom({ person: mathias, objectId: 'e48e4fcb-2ee4-45d8-a20c-f94c2fb38d43' }), 'me/work-2fb38d43')
eq('nothing at all', branchNameFrom({}), 'work')
eq('an empty template is the default', branchNameFrom({ template: '   ', person: mathias, label: 'x' }), 'me/x')
eq('the default is what it says it is', branchNameFrom({ template: DEFAULT_BRANCH_TEMPLATE, person: mathias, label: 'x' }), 'me/x')

console.log('\nkey and label, for a type that has a sequence')
eq('both', kl({ key: 'TASK-42', label: 'Add the code panel' }), 'task-42-add-the-code-panel')
eq('label only', kl({ label: 'Add the code panel' }), 'add-the-code-panel')
eq('key only', kl({ key: 'TASK-42' }), 'task-42')
eq('neither, falls back to id', kl({ objectId: 'e48e4fcb-2ee4-45d8-a20c-f94c2fb38d43' }), 'work-2fb38d43')

console.log('\nmessy labels')
eq('punctuation', branchNameFrom({ label: 'Fix: the \u201cpanel\u201d (again!)' }), 'fix-the-panel-again')
eq('accents', branchNameFrom({ label: 'F\u00f6rb\u00e4ttra s\u00f6kningen' }), 'forbattra-sokningen')
eq('emoji and symbols', branchNameFrom({ label: '\ud83d\ude80 ship it ~now^' }), 'ship-it-now')
eq('leading/trailing junk', branchNameFrom({ label: '   ---hello---   ' }), 'hello')
eq('non-latin only', branchNameFrom({ label: '\u65e5\u672c\u8a9e', objectId: 'abcd1234efgh' }), 'work-1234efgh')

console.log('\na second branch')
eq('suffix appended', kl({ key: 'WI-1', label: 'test', suffix: '2' }), 'wi-1-test-2')
eq('suffix without a label', kl({ key: 'WI-1', suffix: '3' }), 'wi-1-3')
eq('suffix on the id fallback', kl({ objectId: 'abcd1234', suffix: '2' }), 'work-abcd1234-2')
const suffixed = kl({ key: 'WI-1', label: 'word '.repeat(120), suffix: '2' })
ok('suffix counted against the budget', suffixed.length <= MAX_BRANCH_NAME, `${suffixed.length} chars`)
ok('suffix survives the trim', suffixed.endsWith('-2'), suffixed.slice(-20))
ok('suffixed name is a legal ref', branchNameProblem(suffixed) === null)

console.log('\na template, so a team names branches its own way')
const me = { name: 'Mathias Edblom' }
eq('the example from the request', branchNameFrom({ template: '{initials}/{KEY}-{label}', person: me, key: 'STAR-123', label: 'The name' }), 'me/STAR-123-the-name')
eq('label first', branchNameFrom({ template: '{label}-{key}', key: 'STAR-1', label: 'The name' }), 'the-name-star-1')
eq('no key wanted', branchNameFrom({ template: '{initials}/{label}', person: me, key: 'STAR-1', label: 'The name' }), 'me/the-name')
eq('literal text is kept', branchNameFrom({ template: 'feature/{key}', key: 'STAR-1' }), 'feature/star-1')
eq('literal capitals survive', branchNameFrom({ template: 'ME/{key}', key: 'STAR-1' }), 'ME/star-1')
eq('nested folders', branchNameFrom({ template: 'team/{initials}/{key}', person: me, key: 'STAR-1' }), 'team/me/star-1')
eq('a capitalised token still resolves', branchNameFrom({ template: '{Initials}/{key}', person: me, key: 'S-1' }), 'me/s-1')

console.log('\\nthe token\u2019s own case decides the value\u2019s')
eq('lower gives lower', branchNameFrom({ template: '{key}', key: 'HARDWARE-1' }), 'hardware-1')
eq('SHOUTED gives shouted', branchNameFrom({ template: '{KEY}', key: 'hardware-1' }), 'HARDWARE-1')
eq('a stored key is not preserved by default', branchNameFrom({ template: '{key}', key: 'STAR-123' }), 'star-123')
eq('and is when asked for', branchNameFrom({ template: '{KEY}', key: 'STAR-123' }), 'STAR-123')
eq('the label obeys it too', branchNameFrom({ template: '{LABEL}', label: 'The Name' }), 'THE-NAME')
eq('as do initials', branchNameFrom({ template: '{INITIALS}/{label}', person: me, label: 'The name' }), 'ME/the-name')
eq('mixed case is not shouting', branchNameFrom({ template: '{Key}', key: 'STAR-1' }), 'star-1')
eq('a token nobody implements resolves to nothing', branchNameFrom({ template: '{nope}/{key}', key: 'S-1' }), 's-1')

console.log('\nseparators left orphaned by an empty token')
eq('no key', branchNameFrom({ template: '{initials}/{key}-{label}', person: me, label: 'The name' }), 'me/the-name')
eq('no label', branchNameFrom({ template: '{initials}/{key}-{label}', person: me, key: 'STAR-1' }), 'me/star-1')
eq('no person', branchNameFrom({ template: '{initials}/{key}-{label}', key: 'STAR-1', label: 'x' }), 'star-1-x')
eq('everything empty falls back', branchNameFrom({ template: '{initials}/{key}-{label}', objectId: 'abcd1234' }), 'work-abcd1234')
eq('doubled separators collapse', branchNameFrom({ template: '{key}--//--{label}', key: 'S-1', label: 'x' }), 's-1/x')
eq('a dotted template cannot make ..', branchNameFrom({ template: '{key}..{label}', key: 'S-1', label: 'x' }), 's-1.x')
eq('a template cannot end in .lock', branchNameFrom({ template: '{key}.lock', key: 'S-1' }), 's-1-lock')

console.log('\nany attribute of the work item, by name')
const hardware = { Key: 'HARDWARE-1', Manufacturer: 'HP', 'Serial number': '1234567890', Model: '123' }
const withAttrs = (template) => branchNameFrom({ template, attributes: hardware, label: 'Computer 1' })
eq('an attribute by name', withAttrs('{Manufacturer}/{label}'), 'hp/computer-1')
eq('a name with a space', withAttrs('{Serial number}'), '1234567890')
eq('matched however it is typed', withAttrs('{serial NUMBER}'), '1234567890')
eq('and trimmed', withAttrs('{ Manufacturer }'), 'hp')
eq('capitals still mean capitals', withAttrs('{MANUFACTURER}'), 'HP')
eq('several attributes', withAttrs('{Manufacturer}-{Model}'), 'hp-123')
eq('an attribute the object has no value for collapses', withAttrs('{Manufacturer}-{Owner}'), 'hp')
eq('a role wins over an attribute of the same name', branchNameFrom({ template: '{key}', key: 'SEQ-9', attributes: hardware }), 'seq-9')
eq('and the attribute is the fallback when there is no role', branchNameFrom({ template: '{key}', attributes: hardware }), 'hardware-1')

console.log('\na name has to identify the object, not just the person')
eq('the id stands in for a missing label', branchNameFrom({ template: '{initials}/{label}', person: me, objectId: 'bd6057fb-dab9632c2221' }), 'me/work-632c2221')
eq('an initials-only branch is every branch', branchNameFrom({ template: '{initials}', person: me, objectId: 'abcd1234' }), 'work-abcd1234')
eq('a template naming only an empty attribute', branchNameFrom({ template: '{initials}/{Owner}', person: me, objectId: 'abcd1234' }), 'work-abcd1234')
eq('but any object value is enough', branchNameFrom({ template: '{initials}/{Owner}', person: me, attributes: { Owner: 'ada' }, objectId: 'abcd1234' }), 'me/ada')
eq('a key counts as identifying', branchNameFrom({ template: '{initials}/{key}-{label}', person: me, key: 'S-1', objectId: 'abcd1234' }), 'me/s-1')

console.log('\nnaming the tokens that do not exist')
eq('none in the default', unknownTokens('{key}-{label}').length, 0)
eq('one', unknownTokens('{initials}/{name}').join(','), 'name')
eq('several, lowercased', unknownTokens('{Nope}/{key}/{alsoNope}').join(','), 'nope,alsonope')
eq('an attribute of the type is known', unknownTokens('{Manufacturer}', Object.keys(hardware)).length, 0)
eq('however it is typed', unknownTokens('{ serial NUMBER }', Object.keys(hardware)).length, 0)
eq('one that is not', unknownTokens('{Colour}', Object.keys(hardware)).join(','), 'colour')
eq('{user} is no longer a token', unknownTokens('{user}').join(','), 'user')
eq('reported once however often it appears', unknownTokens('{nope}/{nope}').join(','), 'nope')

console.log('\ninitials, and who a branch belongs to')
eq('two names', initialsOf({ name: 'Mathias Edblom' }), 'me')
eq('one name', initialsOf({ name: 'Prince' }), 'p')
eq('three names', initialsOf({ name: 'Ada Byron King Lovelace' }), 'abkl')
eq('a one-word address is its own folder', initialsOf({ email: 'mathias@starhive.com' }), 'mathias')
eq('an address that carries a name gives initials', initialsOf({ email: 'mathias.edblom@starhive.com' }), 'me')
eq('other separators too', initialsOf({ email: 'ada_byron-king@example.com' }), 'abk')
eq('a name always wins over the address', initialsOf({ name: 'Mathias Edblom', email: 'someone.else@x.com' }), 'me')
eq('nothing to go on', initialsOf({}), '')

console.log('\nlength')
const long = kl({ key: 'TASK-42', label: 'word '.repeat(120) })
const prefixed = branchNameFrom({ template: '{initials}/{key}-{label}', person: me, key: 'STAR-1', label: 'word '.repeat(120) })
ok('a prefix is reserved from the budget', prefixed.length <= MAX_BRANCH_NAME, `${prefixed.length} chars`)
ok('the prefix survives the trim', prefixed.startsWith('me/star-1-'))
ok(`caps at ${MAX_BRANCH_NAME}`, long.length <= MAX_BRANCH_NAME, `${long.length} chars`)
ok('keeps the key', long.startsWith('task-42-'))
ok('does not end mid-word', !long.endsWith('-') && long.endsWith('word'), long.slice(-24))
const twice = branchNameFrom({ template: '{label}/{label}', label: 'word '.repeat(120) })
ok('a label used twice still fits', twice.length <= MAX_BRANCH_NAME, `${twice.length} chars`)
ok('a label used twice is a legal ref', branchNameProblem(twice) === null, branchNameProblem(twice) ?? '')
const hugeWord = kl({ key: 'T-1', label: 'x'.repeat(400) })
ok('one huge word still fits', hugeWord.length <= MAX_BRANCH_NAME, `${hugeWord.length} chars`)
ok('huge word not trimmed to nothing', hugeWord.length > 50)
const hugeKey = kl({ key: 's'.repeat(400), label: 'anything' })
ok('over-long key alone is capped', hugeKey.length === MAX_BRANCH_NAME, `${hugeKey.length} chars`)

console.log('\nevery generated name is a legal ref')
for (const c of [
  { label: 'Fix: the panel (again!)' }, { template: '{key}-{label}', key: 'TASK-42', label: 'word '.repeat(120) },
  { label: '   ---hello---   ' }, { label: '..' }, { label: 'a.lock' }, { label: '@{weird}' },
  { label: '//slashes//' }, { objectId: 'e48e4fcb' }, {}, { template: '{key}-{label}', key: 'S'.repeat(400), label: 'x' },
  { template: '{initials}/{key}-{label}', person: { name: 'Ada Lovelace' }, key: 'A-1', label: 'x' },
  { template: '{key}..{label}', key: 'S-1', label: 'x' }, { template: '{key}.lock', key: 'S-1' },
  { template: '~^:?*[', key: 'S-1' }, { template: '/{key}/', key: 'S-1' },
  { template: '{nope}', objectId: 'abcd1234' }, { template: '@{{key}', key: 'S-1' },
  { template: '{label}/{label}', label: 'word '.repeat(200) },
]) {
  const name = branchNameFrom(c)
  ok(`legal: ${JSON.stringify(c).slice(0, 46)} -> ${name.slice(0, 32)}`, branchNameProblem(name) === null, branchNameProblem(name) ?? '')
}

console.log('\nthe validator catches what a person can type')
for (const [name, shouldFail] of [
  ['feature/thing', false], ['ok-name', false], ['', true], ['has space', true],
  ['tilde~x', true], ['caret^x', true], ['colon:x', true], ['star*x', true], ['brack[x', true],
  ['double..dot', true], ['at@{x', true], ['/leading', true], ['trailing/', true],
  ['double//slash', true], ['.dotstart', true], ['dotend.', true], ['thing.lock', true],
  ['x'.repeat(MAX_BRANCH_NAME + 1), true],
]) ok(`${shouldFail ? 'rejects' : 'accepts'} ${JSON.stringify(name).slice(0, 30)}`, (branchNameProblem(name) !== null) === shouldFail, branchNameProblem(name) ?? '')

console.log(`\n${failed === 0 ? 'all checks passed' : failed + ' CHECK(S) FAILED'}`)
process.exit(failed ? 1 : 0)
