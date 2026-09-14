# GitLab — merge requests and branches, beside the work item

A Starhive app that shows the GitLab work behind a Starhive object, and takes new links as people make them.
One bundle serves three slots — `objectPanel` (the product), `globalPage` (the rollup) and
`settingsPage` — switching on `context.slot` from the bridge handshake.

## What it does

- **Object panel** — a "GitLab" tab on any object: what is linked, live from GitLab, plus two ways to
  add more.
- **Finds itself** — a work item with a key is looked up in GitLab by that key on every open, and
  whatever carries it is linked. A branch cut as `STAR-2642-fix` before this app existed is in the
  panel the first time somebody opens it, and nobody links anything, ever.
- **Start a branch** — named from the work item by a template, so the key is in the name and the
  branch is found again by the paragraph above.
- **Link by URL** — paste a merge request, branch or commit URL. It is verified against GitLab before
  it is stored, so a typo fails at the form rather than becoming a row that never resolves.
- **Global page** — what is happening in the project, and how much of it Starhive knows about. Open
  merge requests and the oldest one waiting, then the two lists neither system can produce alone: a
  merge request open in GitLab that nothing here points at (untracked work), and a linked branch with
  no merge request from it (started, never proposed). That second list is the awkward one: open merge
  requests alone report a branch as never proposed the moment its work merges, and a branch deleted
  after merging is reported forever. So the page also asks which branches still exist, and then asks
  GitLab — per candidate branch, not per project — whether anything was ever opened from it. Per
  branch on purpose: reading every merge request state for a project is a crawl of its whole history,
  where one branch is one call, and only branches that would otherwise be listed are worth asking
  about. Both comparisons are keyed by project *and* name: `fix-tests` exists in every repository a
  workspace has. Underneath, counts aggregated over the app's own
  objects — no egress, correct past any page size, still right when the token is missing.

## Three constraints that shaped it

Worth reading before changing anything, because each one looks like a bug otherwise.

**It reads the object it is mounted on through a keyhole.** An `objectPanel` is handed
`context.objectId` and nothing else — no type, no label — and for a long time `objects.get` on that id
was refused outright. It is allowed now, but only because the app's own `codeLink` type holds a
`REFERENCE` to whatever `workItemType` names: the host lets an app read the types its own
config-bound references point at, and nothing else. So the panel reads that object once, in
`useWorkItem`, and everything downstream works from what came back — the branch name, and the key
GitLab is searched for. Point the setting somewhere else and the read closes again, which is why
`useWorkItem` reports *why* it got nothing rather than just getting nothing: a refused read, a type
with no SEQUENCE and a work item created a second ago all produce the same empty panel and want
completely different things done about them.

**Writing a reference is gated on the type being created, not on its target.** A link object lives in the app's space
and points *out* at a work item through a `REFERENCE`. `objects.create` gates only the type being
created, and space-manager validates a reference against the attribute's target type without caring
which space the target sits in. That asymmetry is what the whole data model rests on, so it is held by
tests rather than assumed — `CrossSpaceReferenceTest` in space-manager, and a case in the bridge
dispatcher's own suite.

**Nothing refreshes on its own.** Apps have no background execution and no inbound webhook, so there
is no "PR merged → move to Done" and no copy that stays true by itself. Everything is fetched when a
person opens the panel — cached in two places so that opening the same work item twice costs nothing.
`src/cache.ts` spares one viewer from asking twice; `cacheSeconds` on `bridge.fetch` asks the host to
keep the answer beside the credential, where it is shared by everyone looking at the same thing, so
ten people opening one object ask GitLab once. **Refresh** throws the app's copy away. A project's address and default branch are
cached for hours, since they are asked for constantly and effectively never change. Each link also
keeps what GitLab last said, and that is what renders when a live read fails — "this was open when we
last looked" beats an empty panel.

## Adding a provider

**One app per product.** GitHub and Bitbucket are not remotes to add here — each is its own app, so
that someone searching the marketplace for "GitLab" finds a thing called GitLab rather than a thing
called Code that happens to speak it. It costs a second panel tab in a workspace that installs two,
and buys a name people can look for.

`src/providers/types.ts` is still a seam, and that is why: a provider recognises its own URLs
(`locate`), reads one thing's state (`read`), finds what carries a branch name (`search`,
`mergeRequestsFor`), creates a branch, and builds the links a person clicks. Everything above that
line works in `CodeLocator` and `CodeState` and does not know what a merge request is called. Building
the GitHub app means copying this one and writing one file — the seam is what makes that a copy rather
than a rewrite.

**Several projects, one workspace.** A workspace plans in one place and commits in many, so the
setting is a list of `group/project` paths. Only two things ever needed a single answer — which
project a new branch is created in (the dialog asks, defaulting to whatever the work item already
uses) and which projects the app page summarises (all of them, one call each, cached host-side).
Linking by URL never needed it: the project comes out of the URL, listed or not.

**Branch names.** An install setting, written as a template: `{initials}/{key}-{label}` produces
`me/STAR-123-the-name`. The default is `{initials}/{label}` — whose it is and what it is about, the
two things true of every type; a key is the better name where there is one, but a SEQUENCE is not
something a type has by default, and a default that silently drops half of itself on the types that
lack one is worse than one that never promised a key. A template rather than a prefix
because teams disagree about more than the folder — some want no key, some want the label first —
and each of those is the same values in a different order. `{initials}` resolves per person, so one
setting still gives each of them their own folder; a literal would put the whole team under one.

`{key}` and `{label}` name a **role** rather than an attribute — the type's SEQUENCE and whichever
attribute it marks `isLabel` — so the default template works on a type whose key is called `Key` and
on one where it is called `Ref`. **Every other token is an attribute of the work item, by display
name**: `{Manufacturer}`, `{Serial number}`, matched however it is typed. Display name and not key,
because the type belongs to the customer rather than to this app and has no manifest keys; the name
is what the admin writing the template sees in the product. A role with a value wins over an
attribute of the same name, and an empty role falls through to it — so a type with no SEQUENCE but
an attribute called `Key` still resolves `{key}`.

A token's own case decides its value's case: `{key}` gives `star-123` and `{KEY}` gives `STAR-123`.
The template is the only place that can answer this — a sequence's value is whatever prefix the
workspace generated, and there is no telling from the app whether `HARDWARE-1` is an identifier a
team writes in capitals or just what a type called Hardware produced. Otherwise each token renders
the way that kind of value should read: a key keeps the dots and underscores a slug would flatten,
because it is an identifier rather than prose; a label is slugged, because it is a sentence. A
separator left next to a token that resolved to nothing is dropped, so `{initials}/{key}-{label}` on
a work item with no key is `me/the-name` rather than `me/-the-name` — the template is written for
the case where everything is there, and the missing case should not need its own syntax. Everything
is capped at 200 characters with the label as the only elastic part, since losing a key or a folder
changes what the branch *is* where losing the tail of a label only changes how much of it there is.

A name has to identify the object, and `{initials}` does not — so if nothing that came out of the
object resolved, a short suffix of its id stands in for the label. Not because an object might lack
one, but because the app is not always allowed to read it, and `me/` on its own would be the same
branch name for everything that person touches.

Installs that set the older `branchPrefix` are upgraded to the template that produces the same
names — pinned to what that setting meant rather than composed with the current default, which has
since changed — and saving the settings page blanks it, since otherwise clearing the field would
bring the old prefix back rather than fall through to the default.

**Finding the work, rather than being told about it.** A work item whose type has a SEQUENCE already
carries the only thing this app and GitLab both know: its key. So the panel searches for it. Every
open asks each configured project for the branches and merge requests carrying this work item's key,
and links what comes back — which means a repository that has never heard of Starhive fills the panel
anyway, and nobody has to link anything for the app to be useful. It is the same convention every
tracker before this one ran on, and the reason `{key}` belongs in a branch name at all.

Three things make that safe enough to *write* from, which is the bar — a wrong guess here is a row on
somebody's work item, not a wrong line in a list:

- **Not every key is a key.** `SequenceConfiguration.sequencePrefix` is optional, so an ordinary type
  produces values like `42`, and a repository searched for `42` answers with everything. Nothing in
  the value says which kind it is, so `searchTermFor` judges the shape: two letters, a digit, four
  characters. Below that the panel simply does not search, and behaves as it did before.
- **The host's search is a substring match.** `STAR-1` comes back holding `STAR-12`, `STAR-123` and
  `STAR-1000`, and taken at face value the lowest-numbered work item in a project collects every
  branch its siblings ever had. So every hit carries the text it was found by, and `carriesKey`
  re-checks it as a whole token on the same slug both sides. That is what `discover.test.mjs` is
  mostly about; the near misses are the whole point of the file.
- **Searching merge requests is not enough.** GitLab's merge request search reads title and
  description and never the source branch — so the ordinary merge request, branch named after the
  key and title written in prose, is invisible to it. That one is found the other way, from its
  source branch once the branch is linked. Both routes run as one pass in `LinkList`, over one set of
  what is already known, so a merge request both of them find is created once.

A row the search keeps finding does not offer **Unlink** — it would be back on the next open, which
is what made Unlink look broken for the merge requests discovered from a branch. It says nothing
about why: the line explaining it was one more thing to read on every such row, and the absence of a
button people were not reaching for did not need a paragraph. The rule is asked of the row's own name
rather than remembered from the pass that wrote it, so it survives a reload and is also right about
rows linked long before any of this existed.

**It says what it is doing, and waits before contradicting itself.** The search sits at the top of
the panel — a line and a progress bar that fills as each project answers — because until it settles
it is the only current thing on screen; everything below is what we knew before we asked.

And **the offer to start a branch is held back until it settles**. "No branch yet" is a claim about
GitLab rather than about the list, so making it while still asking GitLab is how a panel tells
somebody to create a branch that already exists — and they do, and then there are two. A work item
that already has a branch is exempt, since "create another" is not a claim about absence.

Once settled, one dimmed line reports the pass: how many projects were
searched, how many things carried the key, how many were rejected for not carrying it *as* a key, and
— the one that matters most — any project that could not be read at all. A private project with no
token answers 404, and that used to be swallowed, which made "the token is missing" and "nothing is
named after this work item" the same empty panel. They have completely different fixes, so the panel
now distinguishes them. It also says when it did not search, and why: no SEQUENCE on the type, no
value on the object, a key too thin to be safe, no projects configured, or a workspace that cannot
reach GitLab at all — that last one used to return before anything was said, which made the failure
hardest to diagnose exactly where it was most likely.

What it does not do is change *when*. There is still no webhook and no background execution, so this
runs when somebody opens the panel — see the third constraint above. It does make that cheap: a
search per project, through both cache layers, so the second open costs nothing.

**Why a second link to the same merge request used to appear.** Whether something is already linked
was answered by a StarQL query, which reads the search index, which is written asynchronously — so
for a second or two after a write the true answer is available nowhere the app can reach.
`useReloadAfterIndex` waits `INDEX_DELAY_MS` to cover that, but a delay is a guess and the cost of
guessing low is a duplicate row on somebody's work item. So the pass no longer trusts the guess:
`src/linked.ts` remembers what this browser wrote, from *before* the create is awaited, and the next
pass treats it as linked whether or not the index agrees. Unlinking forgets it again, or a removed
row could never come back. The list also collapses rows that name the same thing, so an install that
already collected duplicates heals on the next open rather than needing them cleaned out by hand —
which matters because a row the search keeps finding offers no Unlink to clean it out with.

**Catching up with history.** Installed into a workspace that has been working for a year, the app
knows nothing: every work item already has its branches and merge requests in GitLab, and the panel
says "no branch yet" about work that shipped weeks ago. *Catch up with GitLab* on the app page reads
every branch and open merge request in the configured projects and links the ones whose name
identifies a work item — reading the key *out of* the name (`LYNX-1015-reduce-query`,
`ME/STAR-2642`, `wi-1-test` all work) rather than expecting names this app produced, because a
workspace names branches after whatever tracker it used before. Those real examples live here and in
`sync.test.mjs`, never in the app: the bundle ships with sourcemaps, so anything written in `src/`
is readable by every customer, and naming our own repositories and Jira projects there would be
vendor noise in someone else's workspace. It previews before it writes, skips what is already linked,
and lists what it could not identify rather than guessing. `src/sync.ts` imports nothing so the
matcher can be run: `npm test`.

It only works while `workItemType` is the type this app provisions — matching means enumerating work
items, and the bridge refuses objects outside the app's own types. Pointed at a customer's own type,
the section says so instead of returning nothing.

**Self-managed GitLab does not work yet.** A remote whose address the customer supplies needs a
`configurable.patterns` block bounding the hosts they may enter, and a bare `*` is refused — but a
customer's GitLab at `git.acme.internal` cannot be pattern-bounded at publish time. That gap is on the
platform, not in this app.

## Credentials

One GitLab token per install, held by Starhive and written onto each request on the way out; the app
never sees it. There is no OAuth and no per-user token yet, which means **everyone who opens a Code
panel sees what that one token can see**, regardless of their own GitLab access. Point it at a
read-only token on a bot account, scoped to the projects that should be workspace-visible. The
settings page says as much where an admin will read it.

**`configured` does not mean "a token is stored".** `bridge.remotes()` gives an app `{ key, name,
configured }`, and `configured` is true as soon as the host has an address to send to — which for a
remote whose manifest fixes its `baseUrl` and needs no credential is always. So the app cannot warn
"connect GitLab first", and a private project fails at the call rather than in the UI. That is why
the GitLab client turns 401, 403 and 404 into the one thing a reader can act on: a private project
needs a token.

## How it's wired

| File | Role |
|---|---|
| `manifest.yaml` | identity, the 3 modules, the `gitlab` remote, admin `config`, and the `data` model provisioned on install |
| `src/App.tsx` | reads `useStarhiveContext().slot` and renders the matching screen |
| `src/codeLink.ts` | type keys, attribute **keys** and **names**, the minted link key, the branch name |
| `src/providers/` | the provider seam and the GitLab client |
| `src/discover.ts` | which keys are safe to search for, and which hits really carry one |
| `src/LinkList.tsx` | the stored links, the live read that replaces them, and the pass that finds more |
| `src/BranchSection.tsx` | the offer to start a branch, and the name it suggests |
| `src/useRemoteStatus.ts` | `bridge.remotes()` → can this call be made at all |
| `src/slots/GlobalPage.tsx` | the dashboard: one live GitLab call, two `objects.aggregate` counts, one query for the joins |

## Developing

```sh
npm install
npm run dev          # http://localhost:4500 — UI only; the bridge connects only inside the host
npm run tscheck
npm run build        # → ./build
npm run deploy       # build + publish to whatever `starhive env` points at
npm run deploy:local # …or to localhost:8099 whatever it points at
```

Anything touching the bridge or GitLab has to be built, deployed and installed — there is no mock and
no hot reload for that loop.

`deploy` follows the CLI's current environment (`starhive env local` / `starhive env prod`), which is
the normal way to work. `deploy:local` pins localhost with `--api` regardless, so a local build
cannot become a release because the environment was left somewhere else.

> **Never target local with the `--env local` *flag*.** On CLI 0.2.2 it is accepted, listed in
> `app deploy --help`, and deploys to **production** anyway: the root command declares `--env` too,
> so it never reaches the subcommand and the base URL stays whatever it was. `starhive env local`
> (the standalone command) works correctly — it is only the per-command flag that lies. The tell is
> the banner, `▲ target: http://localhost:8099/external/v1 — not production.`, which prints for
> every non-prod target and nothing else: **no banner means production**, and `✓ Deployed` reports
> success either way.

### Against a local backend

Iterate here rather than on prod: the app bundle still has to be redeployed for every change, but
platform-ui — which is where the bridge dispatcher lives — hot-reloads, so half the loop disappears.

```sh
starhive env local                   # or leave it wherever it is; deploy:local pins localhost anyway
starhive access                      # the local test token is sp_abcd1234
npm run deploy:local
```

with `apps/platform-ui` running from a `starhive-client` checkout (`pnpm dev`, http://localhost:3000,
`.env.development.local` pointing every service at localhost). Then install or update the app from
**Settings → Apps**. `starhive env` shows which environment each token is for.
