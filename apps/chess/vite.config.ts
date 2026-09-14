import react from '@vitejs/plugin-react-swc'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * `base: './'` is important: the published bundle is served from a versioned sub-path
 * (e.g. `…/version/0.1.0/`), so assets must be referenced relatively.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      // Vendored copies of the Starhive SDK (not on npm yet). They live in src/{bridge,starhive-ui}/.
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
  build: {
    outDir: 'build',
    sourcemap: true,
    // Phase 2 adds an analysis engine in a worker. The bundle CSP has no `worker-src`, so it falls
    // back to `script-src 'self'` — a real same-origin worker file loads, an inlined `blob:` one is
    // blocked with no error. Keep workers as emitted files.
    rollupOptions: { output: { inlineDynamicImports: false } },
  },
  worker: { format: 'es' },
})
