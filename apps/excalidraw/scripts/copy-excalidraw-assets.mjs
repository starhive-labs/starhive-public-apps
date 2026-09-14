/*
 * Copies Excalidraw's fonts into `public/`, so the app serves them from its own bundle.
 *
 * With nothing self-hosted, Excalidraw resolves fonts against a public CDN
 * (`https://esm.sh/@excalidraw/excalidraw@<version>/dist/prod/fonts/...`). Inside a Starhive app that
 * would mean a customer's page quietly fetching from a third party.
 *
 * **Copy every family, CJK included.** A missing subset is not a fallback to a system font: the
 * loader 404s against the asset path and then reaches for that CDN anyway, which is exactly what
 * self-hosting is meant to prevent - reached by writing Chinese in a diagram. The faces are split
 * into `unicode-range` subsets, so a browser fetches only the few kilobytes it needs; the directory
 * size is what gets deployed, not what anyone downloads.
 *
 * Vite copies `public/` verbatim into the build output, and `src/excalidrawAssets.ts` points
 * Excalidraw at it relative to wherever the bundle ended up.
 */
import { cp, mkdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

/** Keep in step with `ASSET_DIR` in src/excalidrawAssets.ts. */
const DESTINATION = path.join(projectRoot, 'public', 'excalidraw-assets')

async function main() {
  // Resolved by path rather than by `require.resolve`: the package's `exports` map deliberately
  // hides everything but the entry point and its stylesheet, `package.json` included.
  const fontsSource = path.join(
    projectRoot,
    'node_modules',
    '@excalidraw',
    'excalidraw',
    'dist',
    'prod',
    'fonts',
  )

  try {
    await stat(fontsSource)
  } catch {
    console.error(`[excalidraw-assets] fonts not found at ${fontsSource} — run npm install first.`)
    process.exit(1)
  }

  await rm(DESTINATION, { recursive: true, force: true })
  await mkdir(DESTINATION, { recursive: true })
  await cp(fontsSource, path.join(DESTINATION, 'fonts'), { recursive: true })

  console.log('[excalidraw-assets] copied fonts to public/excalidraw-assets')
}

await main()
