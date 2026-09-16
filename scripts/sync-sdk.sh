#!/usr/bin/env bash
#
# Vendors the Starhive SDK into every app in this repo.
#
# `@starhive/bridge`, `@starhive/attributes`, `@starhive/ui` and `@starhive/theme` aren't published to
# npm yet, so every app here carries a *copy* of their source, aliased in vite.config.ts and
# tsconfig.json. Copies drift: the SDK moves, the apps don't. This is the one place that re-syncs them.
#
# The `starhive app create` template is vendored the same way and has its own copy of this script in
# the CLI repo, because it lives there. Both copies read the same SDK and can be run independently;
# when the SDK packages are published, both go away together - along with the vendored source, the
# aliases, and this whole idea.
#
#   bash scripts/sync-sdk.sh              # copy the SDK source into every target
#   bash scripts/sync-sdk.sh --check      # report drift, write nothing, exit 1 if any
#   CLIENT_REPO=/path/to/starhive-client bash scripts/sync-sdk.sh
#
# The clone you point at decides which SDK you get. If your checkouts sit on different branches,
# CLIENT_REPO is how you choose one — the script prints which it used, so a surprising result is
# visible rather than silent.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Default to the first sibling clone that actually has the packages.
if [[ -z "${CLIENT_REPO:-}" ]]; then
  for candidate in "$REPO_ROOT/../starhive-client" "$REPO_ROOT/../starhive-client-2"; do
    if [[ -d "$candidate/packages/bridge/src" ]]; then
      CLIENT_REPO="$(cd "$candidate" && pwd)"
      break
    fi
  done
fi

if [[ -z "${CLIENT_REPO:-}" || ! -d "$CLIENT_REPO/packages/bridge/src" ]]; then
  echo "Cannot find the Starhive client monorepo." >&2
  echo "Set CLIENT_REPO to a checkout containing packages/{bridge,ui,theme}/src." >&2
  exit 1
fi

MODE="sync"
if [[ "${1:-}" == "--check" ]]; then
  MODE="check"
elif [[ -n "${1:-}" ]]; then
  echo "Unknown argument: $1 (expected --check or nothing)" >&2
  exit 2
fi

# Every app that carries vendored SDK source. A new app is added here.
TARGETS=(
  "apps/chess"
  "apps/gitlab"
  "apps/excalidraw"
  "apps/time-tracking"
  "examples/time-reporting"
  "examples/employee-onboarding"
  "examples/ice-cream-survey"
)

# The source files each vendored package is made of, as "<src-relative-path>:<dest-relative-path>".
# Anything not listed here is not vendored — and `--check` flags files that appear in a target
# without appearing here, which is how a package gaining a file gets noticed.
BRIDGE_FILES=(bridge.ts protocol.ts react.tsx index.ts ids.ts)
THEME_FILES=(colors.ts theme.ts index.ts)
UI_FILES=(index.ts StarhiveAppProvider.tsx)
# `@starhive/attributes` is **globbed**, not listed. A hardcoded list went stale three times as the
# package grew, and each time `--check` reported no drift: it verifies the files it knows about and
# validates stale copies in the target, but a file added upstream is invisible to it. Globbing means a
# new module syncs on its own and `--check` sees it.
#
# collect_sources <dir> -> SOURCES (basenames, tests and stories excluded)
SOURCES=()
collect_sources() {
  SOURCES=()
  local dir="$1" src name
  for src in "$dir"/*.ts "$dir"/*.tsx; do
    [[ -e "$src" ]] || continue
    name="$(basename "$src")"
    # Tests and stories are the package's own; an app that vendored them would fail to typecheck for
    # want of vitest and @testing-library.
    case "$name" in *.test.ts | *.test.tsx | *.stories.tsx | *.d.ts) continue ;; esac
    SOURCES+=("$name")
  done
}

drift=0
copied=0

# place <source-file> <dest-file>
place() {
  local src="$1" dst="$2"
  if [[ ! -f "$src" ]]; then
    echo "  ✗ missing from source: ${src#"$CLIENT_REPO"/}"
    drift=1
    return
  fi
  if diff -q "$src" "$dst" >/dev/null 2>&1; then
    return
  fi
  if [[ "$MODE" == "check" ]]; then
    echo "  ✗ drift: ${dst#"$REPO_ROOT"/}"
    drift=1
  else
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    copied=$((copied + 1))
  fi
}

# Flag vendored files that the source no longer has (a rename upstream leaves a stale copy behind).
# check_extra <dest-dir> <expected-file...>
check_extra() {
  local dir="$1"
  shift
  [[ -d "$dir" ]] || return 0
  local expected=" $* "
  local found
  while IFS= read -r found; do
    if [[ "$expected" != *" $(basename "$found") "* ]]; then
      echo "  ✗ not in source (stale?): ${found#"$REPO_ROOT"/}"
      drift=1
    fi
  done < <(find "$dir" -maxdepth 1 -type f)
}

echo "SDK source: $CLIENT_REPO"
[[ "$MODE" == "check" ]] && echo "Mode: check (nothing will be written)"
echo

for target in "${TARGETS[@]}"; do
  dest="$REPO_ROOT/$target/src"
  if [[ ! -d "$dest" ]]; then
    echo "$target — skipped (no src/)"
    continue
  fi
  echo "$target"

  for file in "${BRIDGE_FILES[@]}"; do
    place "$CLIENT_REPO/packages/bridge/src/$file" "$dest/bridge/$file"
  done
  check_extra "$dest/bridge" "${BRIDGE_FILES[@]}"

  # Not every app vendors @starhive/ui (the bridge is the only required part).
  if [[ -d "$dest/starhive-ui" ]]; then
    for file in "${THEME_FILES[@]}"; do
      place "$CLIENT_REPO/packages/theme/src/$file" "$dest/starhive-ui/theme/$file"
    done
    check_extra "$dest/starhive-ui/theme" "${THEME_FILES[@]}"

    for file in "${UI_FILES[@]}"; do
      place "$CLIENT_REPO/packages/ui/src/$file" "$dest/starhive-ui/ui/$file"
    done
    check_extra "$dest/starhive-ui/ui" "${UI_FILES[@]}"

    # Globbed via collect_sources so a component added as a plain `.ts` (a shared hook, say) is not
    # silently skipped — a `*.tsx`-only glob missed exactly that and broke every app's typecheck.
    collect_sources "$CLIENT_REPO/packages/ui/src/components"
    for file in "${SOURCES[@]}"; do
      place "$CLIENT_REPO/packages/ui/src/components/$file" "$dest/starhive-ui/ui/components/$file"
    done
    check_extra "$dest/starhive-ui/ui/components" "${SOURCES[@]}"

    # @starhive/ui re-exports @starhive/attributes, so an app that vendors one needs the other.
    # Every directory is globbed: root modules, the read-side primitives, the edit-side fields.
    for subdir in "" primitives fields; do
      source_dir="$CLIENT_REPO/packages/attributes/src${subdir:+/$subdir}"
      target_dir="$dest/starhive-ui/attributes${subdir:+/$subdir}"
      [[ -d "$source_dir" ]] || continue
      collect_sources "$source_dir"
      for file in "${SOURCES[@]}"; do
        place "$source_dir/$file" "$target_dir/$file"
      done
      check_extra "$target_dir" "${SOURCES[@]}"
    done
  fi
done

echo
if [[ "$MODE" == "check" ]]; then
  if (( drift )); then
    echo "SDK copies are out of date — run: bash scripts/sync-sdk.sh"
    exit 1
  fi
  echo "✓ every vendored SDK copy matches the source"
else
  if (( drift )); then
    echo "Synced with problems — see the ✗ lines above."
    exit 1
  fi
  if (( copied )); then
    echo "✓ updated $copied file(s). Re-run each app's build to check nothing broke."
  else
    echo "✓ already up to date — nothing to copy."
  fi
fi
