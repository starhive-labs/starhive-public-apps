# Ice Cream Survey — runnable reference app

A complete, self-contained Starhive app you can **build and publish**. It surveys people about ice
cream: pick a flavor, tap a star rating, and each response is a native `Survey Response` object — so
reporting is just Starhive (StarQL, views, widgets). One bundle serves all four extension slots —
`globalPage`, `objectPanel`, `widget`, and `settingsPage` — switching on `context.slot` from the
bridge handshake.

The **widget** is the centerpiece: drop "Rate our ice cream" on any dashboard and people rate without
leaving the page (`src/slots/Widget.tsx` → `src/RateForm.tsx`, built on the `@starhive/ui` `Rating`
component). For the concepts behind this (manifest, bridge SDK, act-as-user, provisioning), read
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
provisions the `Ice Cream Survey` space + `Flavor` and `Survey Response` types (from `manifest.yaml`
→ `data`), seeds a few flavors, and turns on the four slots. Then:

- **Widget** — "Rate our ice cream" on any dashboard: pick a flavor, tap a star, submit. The header
  shows the running average (the `EXTENSION_WIDGET` widget type).
- **Global page** — leave a full rating (with comment) + a table of every response.
- **Object panel** — a "Feedback" tab on a Flavor object: rate it + see its ratings.
- **Settings** — flavor type + star scale; read/written via `starhive.config.*`.

## How it's wired

| File | Role |
|---|---|
| `manifest.yaml` | identity, the 4 modules, admin `config`, and the `data` model provisioned on install |
| `src/App.tsx` | reads `useStarhiveContext().slot` and renders the matching screen |
| `src/slots/*` | one component per extension point (`Widget` is the focus) |
| `src/survey.ts` | logical type keys + attribute **names** the app reads/writes (must match the manifest) |
| `src/RateForm.tsx`, `src/ResponsesList.tsx` | `useObjects().create(...)`, `useObjectQuery(starql)`, `useType(key)`, `@starhive/ui` `Rating` |
| `src/bridge/` | **vendored** copy of `@starhive/bridge` (see below) |

The app refers to its data by **logical type key** (`"response"`, `"flavor"`) and **attribute name**
(`"Flavor"`, `"Rating"`, …); the bridge resolves keys to the install's real IDs. Keep
`manifest.yaml`'s `data.types` and `src/survey.ts`'s `ATTR` in sync.

The rating itself is a `DECIMAL` attribute (1–`maxRating`); the `@starhive/ui` `Rating` component
captures it as stars on write and renders read-only stars in the response table. `maxRating` is an
admin `config` value, so the star scale is configurable per install.

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
