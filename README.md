# Starhive Apps

Starhive's own apps for the app platform, and the reference apps that show how one is built.

Every app here is a self-contained Vite + React project with its own `package.json`, built and
published with the [Starhive CLI](https://gitlab.com/starhive-core/starhive-cli). There is no
workspace and no shared lockfile on purpose: an app in this repo is exactly what a customer gets
when they copy it, so anything it needs, it declares.

## Our apps

| App                                   | What it does                                                       |
| ------------------------------------- | ------------------------------------------------------------------ |
| [`apps/chess`](apps/chess/)           | Correspondence chess; every game is a native object                |
| [`apps/gitlab`](apps/gitlab/)         | GitLab merge requests and branches beside a work item              |
| [`apps/excalidraw`](apps/excalidraw/) | Excalidraw diagrams as a macro block inside a page                 |

## Examples

| App                                                             | What it shows                                       |
| --------------------------------------------------------------- | --------------------------------------------------- |
| [`examples/time-reporting`](examples/time-reporting/)           | The reference app — covers all five extension slots |
| [`examples/employee-onboarding`](examples/employee-onboarding/) | Workflows and transitions                           |
| [`examples/ice-cream-survey`](examples/ice-cream-survey/)       | The small one, widget-first                         |

Each has its own README with what it does, how to run it, and what it provisions on install.

## Working on an app

```sh
cd examples/time-reporting
npm install
npm run dev        # http://localhost:4500
npm run tscheck
npm run build      # → ./build
npm run deploy     # build + publish via the CLI
```

Deploying needs the CLI on your PATH and an access token (`starhive access`); the token is written
to that app's `.starhive/`, which is git-ignored and must stay that way.

## The vendored SDK

`@starhive/bridge`, `@starhive/ui`, `@starhive/attributes` and `@starhive/theme` are not published to
npm yet. Each app therefore carries a **copy** of their source under `src/bridge/` and
`src/starhive-ui/`, aliased to the package names in `vite.config.ts` and `tsconfig.json`, so the code
reads exactly as it will once the packages ship.

Copies drift. `scripts/sync-sdk.sh` is the one place that re-syncs them from a checkout of the client
monorepo:

```sh
bash scripts/sync-sdk.sh                                    # copy the SDK source into every app
bash scripts/sync-sdk.sh --check                            # report drift, write nothing, exit 1 if any
CLIENT_REPO=/path/to/starhive-client bash scripts/sync-sdk.sh
```

It defaults to the first sibling checkout that has `packages/bridge/src`, and prints which one it
used — so a surprising result is visible rather than silent.

The `starhive app create` template is vendored the same way and keeps its own copy of this script in
the CLI repo, because the template lives there. When the SDK packages are published, both copies go
away together, along with the vendored source and the aliases.

## Adding an app

Scaffold it with `starhive app create`, drop it under `apps/` (or `examples/` if it is there to be
read rather than run), and add its path in two places: `TARGETS` in `scripts/sync-sdk.sh` so its
vendored SDK stays in step, and the `APP` matrix in `.gitlab-ci.yml` so CI builds it.

## CI

`.gitlab-ci.yml` runs on merge requests and on `main`. One job per app (`build-app: [apps/excalidraw]`
and so on) runs `npm ci`, `npm run tscheck` and `npm run build`, and keeps each app's `build/` as an
artifact for a week. Nothing is deployed from CI; `npm run deploy` stays a local, token-holding step.
