# Employee Onboarding — runnable reference app

A complete, self-contained Starhive app you can **build and publish**. It runs structured employee
onboarding: each task is a native `Onboarding Task` object referencing a `New Hire`, so checklists,
progress and reporting are just Starhive (StarQL, views, widgets). One bundle serves all four
extension slots — `globalPage`, `objectPanel`, `widget`, and `settingsPage` — switching on
`context.slot` from the bridge handshake.

For the concepts behind this (manifest, bridge SDK, act-as-user, provisioning), read
[Build Your First Starhive App](https://gitlab.com/starhive-core/starhive-cli/-/blob/main/docs/build-your-first-app.md).

## Build & publish

```sh
npm install
npm run build          # → ./build (Vite, base: './' so it works under a versioned path)
npm run deploy         # build + publish in one step
```

`npm run deploy` just wraps `starhive app deploy --dir ./build --manifest ./manifest.yaml`. For the
publish flow, auth (`starhive access`), and options like `--api` for a local backend, see
**[Deploying an app](https://gitlab.com/starhive-core/starhive-cli/-/blob/main/README.md#deploying-an-app)** in the CLI README.

## Install & use

A workspace admin installs the app from the in-product **Apps** UI. On install the platform
provisions the `Employee Onboarding` space, a `taskStatus` **workflow** (To do → In progress → Done),
and the `New Hire` and `Onboarding Task` types (from `manifest.yaml` → `data`) — the task's `Status` is
a `WORKFLOW` attribute bound to that workflow — then seeds a sample hire and a standard checklist and
turns on the four slots. Then:

- **Global page** — add tasks + see every onboarding task with its status and progress.
- **Object panel** — an "Onboarding" tab on any new-hire object: add tasks for them + their checklist.
- **Widget** — "My onboarding" on any dashboard: open tasks broken down by status.
- **Settings** — which type counts as a "new hire" + the default due window; via `starhive.config.*`.

### Moving a task's status

A `WORKFLOW` value is never written on its own — Starhive refuses a new state that doesn't name the
transition that got there, which is what makes the state machine and its conditions mean anything. So
`src/StatusMenu.tsx` does it in two steps: ask which moves the task can make **right now**, then write
the target state and the transition together in one update.

```tsx
const { data } = useTransitions(objectId, statusAttributeId)   // "Start", "Complete", "Reopen"…
await objects.update(
  objectId,
  [{ attributeId: statusAttributeId, values: [move.toStateId] }],
  { transitions: { [statusAttributeId]: move.id } },
)
```

Three things the component is shaped by:

- **The answer is per object.** What's offered depends on the state that task is in and on conditions
  that can involve the current user, so it's fetched when the menu opens — not once for the table.
  200 tasks would otherwise be 200 bridge calls just to render.
- **The update returns the moved object**, so the new status shows immediately instead of refetching
  and waiting on the search index.
- **Moves that require a screen are skipped** — Starhive expects that screen's attributes in the same
  update, which the app can't collect. A workflow provisioned from a manifest never has one.

### Automations: what the app does on its own

The manifest's `automations:` block declares rules that Starhive's automation engine runs for the
app, with nobody having it open. The app ships no code for them. Before installing, the admin sees
each one by name with its reason. Once installed, each has its own on/off switch on the app's
settings page, and they appear read-only under **Settings → Automations → Managed by apps**.

| Automation | When | What it does |
| --- | --- | --- |
| Mark new tasks | a task is created | sets its Notes to "Waiting to be started" |
| Tell the owner when a task is done | a task's Status changes to Done | emails the task's Owner, linking to the task |
| Start overdue tasks | every five minutes | moves a task still in To do past its Due date to In progress |
| Remind the owner the day before a task is due | a day before a task's Due date | emails the task's Owner, unless the task is Done |
| Note the owner of a finished task | a task with an Owner changes to Done | leaves an internal note on the task naming its Owner |

To try them after installing:

1. **Create a task.** Its Notes read "Waiting to be started".
2. **Give a task an Owner, then Start it and Complete it.** The workflow goes To do → In progress →
   Done, with no move straight to Done. Once it is Done, the owner gets an email.
3. **Give a To do task a Due date in the past.** Within five minutes it moves to In progress. A real
   app would check hourly. The five minutes is only here so the demo is quick.
4. **Give a task an Owner and a Due date two days from now.** The owner gets the reminder at midnight
   UTC at the start of the day before it is due. A Due date is a DATE, which counts from midnight UTC,
   and `by: 1d` counts a day back from that. So the reminder comes at the next midnight UTC when your
   date and the UTC date are the same day, and a day later when they are not (east of UTC early in the
   morning, west of UTC late in the evening). A Due date of tomorrow is usually too late: its reminder
   was due at the midnight UTC just gone, and one more than 40 minutes late is not sent. Move the Due
   date and the reminder moves with it. Mark the task Done first and no reminder is sent.
5. **See a rule wait for the workspace.** *Note the owner of a finished task* leaves an internal
   note, and a type has internal notes only once an admin turns them on, on a plan that has them. Until
   then the rule is left out and the rest of the app works: the app's page under **Settings → Apps**
   lists it as not running, says why, and links to the Onboarding Task type's settings. Turn internal
   notes on there and the rule starts by itself, with no upgrade or reinstall. Give a task an Owner,
   Start it and Complete it, and the note appears.

A rule names everything by key (`{dueDate}`, `{state:taskStatus.todo}`, `{title}`), so renaming an
attribute or a state in the workspace doesn't break it. The rules act on this app's own types only,
and a rule's run counts toward the workspace's automation usage like any other.

## How it's wired

| File | Role |
|---|---|
| `manifest.yaml` | identity, the 4 modules, admin `config`, and the `data` model provisioned on install |
| `src/App.tsx` | reads `useStarhiveContext().slot` and renders the matching screen |
| `src/slots/*` | one component per extension point |
| `src/onboarding.ts` | logical type keys + attribute **names** the app reads/writes (must match the manifest) |
| `src/TaskForm.tsx`, `src/TaskList.tsx` | `useObjects().create(...)`, `useObjectQuery(starql)`, `useType(key)` |
| `src/StatusMenu.tsx` | `useTransitions(...)` + an update that names the transition — how a status moves |
| `src/useApplyHostTheme.ts` | applies the host's live colors, so light/dark and widget transparency work |
| `src/bridge/` | **vendored** copy of `@starhive/bridge` (see below) |

The app refers to its data by **logical type key** (`"onboardingTask"`, `"newHire"`) and **attribute
name** (`"Title"`, `"Status"`, `"Due date"`, …); the bridge resolves keys to the install's real IDs.
Keep `manifest.yaml`'s `data.types` and `src/onboarding.ts`'s `ATTR` in sync.

> **Vendored bridge.** `@starhive/bridge` isn't on npm yet, so `src/bridge/` is a copy of its source
> and `vite.config.ts` aliases `@starhive/bridge` → `./src/bridge`. When the package ships, delete
> `src/bridge/`, drop the alias, and add `@starhive/bridge` as a dependency — no app code changes.

## Running it locally

There's no separate app environment — your local stack is just the **backend services** (which
include LocalStack S3) and **platform-ui**. The app's runtime (iframe host + bridge) lives in
platform-ui; the app's *bundle* is uploaded and served by the backend, exactly like production.

**1. Point the CLI at your local backend.** The CLI reads `.starhive/config.json` (walking up from
the current directory), so set `appPlatformUrl` and you won't need `--api` on every command:

```json
{ "appPlatformUrl": "http://localhost:8099" }
```

**2. Authenticate.** `starhive app deploy` always needs a Personal Access Token (sent as a Bearer
token). Add one once:

```sh
starhive access
```

Against a **local** backend (which uses an in-process fake user-service) paste the local test token
**`sp_abcd1234`**; against a **hosted** environment paste your real PAT.

**3. Run the backend, then build + deploy.**

```sh
# backend — its `local` profile serves bundles from LocalStack S3 (standard docker infra) on its own:
MICRONAUT_ENVIRONMENTS=local ./gradlew :services:app-platform-service:run

# the app:
npm install && npm run build
starhive app deploy
```

You'll get `✓ Deployed 1.0.0` and a `serveUrl`; install the app from platform-ui and the host iframes
the locally-served bundle. Re-run build + deploy to ship a change (no hot reload).

> `npm run dev` serves the UI standalone on `:4500` for quick component work, but the bridge only
> connects inside the Starhive host. (You can also run the backend with `SECURITY_ENABLED=false` to skip
> auth, but you still need any non-empty `token` in `.starhive/config.json` for the CLI's own check.)
