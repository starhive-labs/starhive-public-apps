import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * `base: './'` is important: the published bundle is served from a versioned
 * sub-path (e.g. `…/version/1.0.0/`), so assets must be referenced relatively —
 * absolute `/assets/…` URLs would 404 against the app's origin.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // Vendored copies of the Starhive SDK packages (not on npm yet). Re-sync with
      // `scripts/sync-sdk.sh` in the CLI repo root. Once they ship, delete src/{bridge,starhive-ui}/,
      // drop these aliases, and add the packages as dependencies.
      '@starhive/bridge': fileURLToPath(new URL('./src/bridge/index.ts', import.meta.url)),
      '@starhive/ui': fileURLToPath(new URL('./src/starhive-ui/ui/index.ts', import.meta.url)),
      '@starhive/attributes': fileURLToPath(
        new URL('./src/starhive-ui/attributes/index.ts', import.meta.url),
      ),
      '@starhive/theme': fileURLToPath(
        new URL('./src/starhive-ui/theme/index.ts', import.meta.url),
      ),
    },
  },
  server: { port: 4500, strictPort: true },
  preview: { port: 4500, strictPort: true },
  build: { outDir: 'build', sourcemap: true },
})
