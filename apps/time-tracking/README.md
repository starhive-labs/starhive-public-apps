# Time Tracking — hours on an object, by whoever spent them

A Starhive app that logs time on any object and reports on it. Several people log time on the same
project or ticket; the object's **Time** tab shows the total, who logged what, how it splits per
person and per month, and every entry. One bundle serves four slots — `objectPanel` (the product),
`globalPage` (the report across everything), `widget` and `settingsPage` — switching on
`context.slot` from the bridge handshake.

## What it does

- **Time tab** — beside Comments and History on every object of the nominated types. Log time
  (`1h 30m`, `1:30` and `1.5` all work), pick a period, and see the total, entries, people and your
  own share; per-person bars; per-month columns; and the entries themselves with who logged each.
  You can delete your own entries; nobody else's.
- **Periods** — this week, this month, last month, this quarter, this year, all time, or **a custom
  range** you pick. The two days a custom range asks for are inclusive at both ends, which is what
  the picker shows; `rangeFor` in `src/timeEntry.ts` is the single place that turns that into the
  half-open range every query wants, and its tests are mostly about that one conversion.
- **App page** — the same report across every work item, with a per-work-item breakdown and an
  "Only my time" switch. Time can be logged here too, against any object of any nominated type.
- **Widget** — "Time this month": the total, your part of it, and the top five people.
- **Settings** — which types time is logged on, and rounding.

Every entry is a native `Time Entry` object, so Starhive's own views, StarQL and widgets report on the
same rows the app does.

## Which objects time can be logged on

**Any number of unrelated types.** An admin nominates them in the settings; a **Time** tab appears on
each, and on the types that extend them.

That is the whole reason an entry stores its object's **id in a TEXT attribute** rather than holding a
`REFERENCE`. A reference targets exactly one type — a platform rule, not a choice — so a referencing
version of this app could only ever cover one type per install, and "track time on Projects and
Tickets" had no answer unless the two happened to extend a common parent. An id belongs to no type,
so the setting became a list.

Three consequences, in the order they will bite:

- **Filtering uses `==`, never `=`.** For a TEXT attribute those are different index fields: `=` is
  analyzed, where a hyphenated uuid is several tokens and one entry's id matches another's; `==`
  reads the untokenized keyword field and matches the whole string. `whereFor` in
  `src/timeEntry.ts` is the only place that builds these, and its tests assert the operator.
- **The name beside an entry is a copy** — see below.
- **Nothing validates the id.** A reference is checked by space-manager on write; a text field is
  not. The id written is one the app just read back from the object it is logging against, so it is
  well-formed, but an object deleted later leaves entries pointing at nothing. They keep their stored
  name and keep reporting, which is the desired behaviour for a timesheet — the hours were still
  worked — and the alternative under a reference was a write that space-manager rejected.

**Changing the setting is safe at any time.** It decides where the tab appears and what the app may
read, and never touches an entry already written. Under the referencing version the setting had to
lock once any time was logged, because re-pointing a reference with objects behind it is refused
(`OBJECTS_EXIST`). Time logged on a type since removed keeps reporting; its tab simply stops being
offered.

## What it provisions

A `Time Tracking` space (`access: open` — every read runs as the viewer, so a restricted space would
refuse everyone but the installer), a minimal `Work Item` type so the app works on day one, and:

| Attribute (`Time Entry`) | Type    |                                                                                      |
| ------------------------ | ------- | ------------------------------------------------------------------------------------ |
| `summary`                | TEXT    | The label. The description when there is one, else `2h 30m · Jane Doe · 2026-09-15`  |
| `workItemId`             | TEXT    | The id of the object the time was spent on. Matched with `==`                        |
| `workItemLabel`          | TEXT    | That object's name, as it read when the time was logged                              |
| `workItemTypeId`         | TEXT    | That object's type, so an entry survives its type leaving the settings               |
| `loggedBy`               | USER    | Who spent it. Always the signed-in user; the app never lets you log for someone else |
| `date`                   | DATE    | The day the work was done, not the day it was logged                                 |
| `hours`                  | DECIMAL | Decimal hours, two places                                                            |
| `description`            | TEXT    | Optional                                                                             |

## The name beside an entry

With no reference, the host has nothing to resolve a label from, so the app stores the object's name
itself and shows that. It is the name at the time of logging, not necessarily the name now.

Two things keep it from drifting far, and neither costs a request:

- **It is rewritten on every log against the same object**, so anything actively being tracked
  carries a current name.
- **The Time tab's own heading is live** — the panel reads the object anyway, to check time can be
  logged there at all.

What is deliberately _not_ done is reading each distinct work item back to refresh the name on a
report. That is one request per distinct object on every screen, which is exactly the cost that
storing the name avoids. Grouping is by id throughout, so a renamed object's hours stay together
whatever its rows are called; only the label shown can lag.

## What the app reads

`scopes.read` nominates the setting, and the host resolves it to every type in it — so the panel may
read the object it is opened on, and the app page may list objects of any nominated type to log
against. Under the referencing version this permission was a side effect of where the reference
happened to point, which is why the app page had no picker at all once an admin aimed the setting at
one of their own types.

## How the numbers are made

- **The headline total is an index aggregate** (`objects.aggregate`, `sum` of `hours` under the
  same predicate as the list) and is exact whatever the volume.
- **The breakdowns are computed from the fetched entries** — per person, per work item, per month
  with the empty months filled in — in `src/report.ts`, which imports nothing and is run by
  `npm test`. Entries are paged in at 200 a request up to 1,000; past that the screen says so and
  suggests a shorter period. The cap is why the aggregate exists beside it.
- **Filtering is StarQL**, so the index does it. StarQL matches display names, so `ATTR_NAME` in
  `src/timeEntry.ts` must stay in step with `manifest.yaml`.
- **Nothing refreshes on its own.** A write is followed by a re-read after `INDEX_DELAY_MS`, because
  the index lags a write by a second or two; a delete is hidden locally in the meantime.

## How it's wired

| File                                         | Role                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| `manifest.yaml`                              | identity, the 4 modules, `config`, the `scopes` it asks for, and the `data` model |
| `src/App.tsx`                                | reads `useStarhiveContext().slot` and renders the matching screen                 |
| `src/timeEntry.ts`                           | keys and names, config, the duration parser, periods, StarQL fragments            |
| `src/report.ts`                              | the arithmetic: total, per person, per work item, per month                       |
| `src/useTimeEntries.ts`                      | paged fetch → plain `Entry` records; the exact aggregate total                    |
| `src/useNominatedTypes.ts`                   | the types from the settings, with each one's label attribute                      |
| `src/useWorkItem.ts`                         | reads the object the tab is on, for its name and as the "may log here" check      |
| `src/useToday.ts`                            | the current day, so a long-lived frame's "this month" rolls over                  |
| `src/WorkItemPicker.tsx`                     | type, then object — the app page's way to log without opening anything            |
| `src/TimeReport.tsx`                         | the KPI row, the two charts, the table — shared by the tab and the app page       |
| `src/LogTimeForm.tsx`, `src/EntriesList.tsx` | the form and the table                                                            |
| `src/Breakdown.tsx`, `src/MonthChart.tsx`    | ranked bars and monthly columns, one hue, no legend                               |
| `src/slots/*`                                | one component per extension point                                                 |
| `src/bridge/`, `src/starhive-ui/`            | **vendored** SDK — re-sync with `scripts/sync-sdk.sh` at the repo root            |

## Listing it

Listed as **Time Tracking** — the term someone hunting for this would type, and the name the
permanent app key (`com.starhive.apps.timetracking`) already commits to. The manifest's `description`
does as the one-line summary.

`logo.svg` is the marketplace logo: upload it under **Publish a new app**, which takes PNG, JPEG,
SVG, WebP or GIF up to 512KB. Vector, so it stays sharp at every size the marketplace draws it at and
costs a couple of kilobytes.

The mark is deliberately a full-bleed square with no corner radius of its own: the marketplace
renders a logo in its own 8px-rounded, overflow-hidden box at 40, 48 and 64 pixels, so a radius baked
in here would either be clipped away or leave a pale notch in each corner.

## Developing

```sh
npm install
npm run dev          # http://localhost:4500 — UI only; the bridge connects only inside the host
npm run tscheck
npm test             # the parser, the periods and the report arithmetic, in plain node
npm run build        # → ./build
npm run deploy       # build + publish to whatever `starhive env` points at
npm run deploy:local # …or to localhost:8099 regardless
```

Anything touching the bridge has to be built, deployed and installed — there is no mock and no hot
reload for that loop. Deploying needs the CLI on your PATH and an access token (`starhive access`).

## Known limits

- **The stored name can lag a rename.** See "The name beside an entry".
- **The app page's picker offers the 200 most recent objects of a type**, searchable within those.
  Anything older is logged from its own Time tab, and the picker says so.
- **Your own entries only.** There is no admin override for deleting or editing someone else's entry
  in the app; an admin can still do it on the object in Starhive.
- **No editing.** A wrong entry is deleted and logged again.
- **The widget is workspace-wide.** It has no settings of its own, so it always shows this month
  across every work item.
- **A period is reckoned from the viewer's own clock**, and two people in different timezones near
  a month boundary can see different totals for "this month". The day stored on an entry is the one
  the logger's clock showed.
