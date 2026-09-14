# Time Reporting — runnable reference app

A complete, self-contained Starhive app you can **build and publish**. It logs time against any
Starhive object; each entry is a native `Time Entry` object, so reporting is just Starhive (StarQL,
views, widgets). One bundle serves all five extension slots — `globalPage`, `objectPanel`, `widget`,
`settingsPage`, and `macro` — switching on `context.slot` from the bridge handshake.

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
provisions the `Time Reporting` space + `Time Entry` type (from `manifest.yaml` → `data`) and turns
on the four slots. Then:

- **Global page** — log time + this week's entries.
- **Object panel** — a "Time" tab on any object: log against it + entries for it.
- **Widget** — "My timesheet" on any dashboard (the `EXTENSION_WIDGET` widget type).
- **Settings** — rounding increment; read/written via `starhive.config.*`.
- **Macro** — "Logged time" in the editor's `/` menu: drops a live hours-per-work-item block into any
  rich-text page, for the period the writer picks.

### The macro slot

The macro is the one slot with **arguments** and **no size of its own**, so it's worth reading
`manifest.yaml` → `modules.macro` next to `src/slots/MacroPage.tsx`:

```yaml
macro:
  - key: time-summary
    title: Logged time      # what the editor's `/` menu calls it
    route: /
    height: 200             # holds the block's space until the app reports its own
    params:                 # the insert dialog, drawn by the host — the app isn't running yet
      - { key: period, name: Period, type: select, options: [week, month, all], default: week }
      - { key: workItem, name: Work item, type: text }
```

The writer's answers are stored on the page and arrive as `context.macroParams`, so the same macro
inserted twice says two different things. They are **not** `config`: config is one set of admin
settings per install, params are per block. Param types are `text` | `number` | `boolean` | `select`
| `typeRef`; declare none and the block drops in with no dialog at all.

Height is the app's to report — a macro sits in prose, so the host has nothing to size it by:

```tsx
const ref = useAutoResize<HTMLDivElement>()   // clamped host-side to 40–2000 px
return <div ref={ref}>…</div>
```

`useAutoResize` is a no-op in every other slot, so a bundle serving all five can call it
unconditionally. Nothing under the ref may stretch to the frame's height, or the block grows by its
own reported size on each pass.

### What the app may read

The `Work item type` setting defaults to this app's own `workItem` type, and an app needs no
permission to read what it provisioned. Point that setting at a type the *workspace* owns and it
becomes somebody else's data, which the app has to ask for:

```yaml
scopes:
  read:
    - config: workItemType
      reason: Reads the work item a panel is opened beside, to check time can be logged against it.
```

The unit is **a type an admin nominates**, named by the config field holding it — never "all types".
The developer bounds it to a setting; the customer decides what goes in the setting. `reason` is
required, because the declaration exists to be read by whoever approves the install.

Without it `objects.get` on the nominated type is refused, and the object panel here treats a refusal
the same as a type mismatch — it quietly reads "not available", which is a hard thing to debug from
the outside. Declaring the scope is what makes the setting mean anything.

Act-as-user still applies underneath: a scope narrows what the app may ask for and can never widen
what the person looking at the page could open themselves.

## How it's wired

| File | Role |
|---|---|
| `manifest.yaml` | identity, the 4 modules, admin `config`, the `scopes` it asks for, and the `data` model provisioned on install |
| `src/App.tsx` | reads `useStarhiveContext().slot` and renders the matching screen |
| `src/slots/*` | one component per extension point (`MacroPage` reads `context.macroParams` + `useAutoResize`) |
| `src/timeEntry.ts` | logical type key + attribute **names** the app reads/writes (must match the manifest) |
| `src/LogTimeForm.tsx`, `src/EntriesList.tsx` | `useObjects().create(...)`, `useObjectQuery(starql)`, `useType(key)` |
| `src/starhive-ui/` | **vendored** `@starhive/ui` + `@starhive/theme`; `StarhiveAppProvider` owns theming (re-synced by `scripts/sync-sdk.sh` in the repo root) |
| `src/bridge/` | **vendored** copy of `@starhive/bridge` (see below) |

The app refers to its data by **logical type key** (`"timeEntry"`) and **attribute name**
(`"Hours"`, `"Date"`, …); the bridge resolves keys to the install's real IDs. Keep `manifest.yaml`'s
`data.types` and `src/timeEntry.ts`'s `ATTR` in sync.

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
