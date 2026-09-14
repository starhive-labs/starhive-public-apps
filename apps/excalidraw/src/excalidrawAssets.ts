/**
 * Where Excalidraw looks for its fonts.
 *
 * Two things make this less trivial than setting a path:
 *
 * 1. **It must run before Excalidraw's module body does.** The library reads
 *    `window.EXCALIDRAW_ASSET_PATH` while registering its `@font-face` rules, and a static `import`
 *    is hoisted above every assignment in its module. So the library may only be reached through a
 *    *dynamic* import made after this has run — which is what `DiagramCanvas` is loaded through.
 *
 * 2. **It must be an absolute URL, computed at runtime.** A published bundle is served from a
 *    versioned sub-path (`…/version/0.1.0/`), which is why `vite.config.ts` sets `base: './'`. But
 *    Excalidraw resolves a `./`-relative asset path against the *origin*, not against the document —
 *    so `./excalidraw-assets/` would look for `/excalidraw-assets/` at the root of the host and 404.
 *    `document.baseURI` is the bundle's own directory, so resolving against it lands inside this
 *    version's assets and stays correct when a new version is published beside it.
 *
 * A 404 here does not degrade gracefully: the loader falls back to `https://esm.sh/...`, putting a
 * third-party request in a customer's page. Self-hosting is only self-hosting if every face resolves.
 */

/** Keep in step with `DESTINATION` in scripts/copy-excalidraw-assets.mjs. */
const ASSET_DIR = 'excalidraw-assets/'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string
  }
}

export function setExcalidrawAssetPath(): string {
  const path = new URL(ASSET_DIR, document.baseURI).toString()
  window.EXCALIDRAW_ASSET_PATH = path
  /*
   * Logged, because getting this wrong fails in a way nothing else explains: the fonts 404, the
   * loader silently reaches for `https://esm.sh/...` instead, the host's `font-src 'self' data:`
   * blocks that, and what you see is an editor whose text never settles. The path it tried is the
   * one fact that turns all of that into one obvious mistake.
   */
  console.info(`[excalidraw] fonts from ${path} (document.baseURI ${document.baseURI})`)
  return path
}
