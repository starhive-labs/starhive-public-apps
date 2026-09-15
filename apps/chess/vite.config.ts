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
  },
  // The engine is Stockfish, and it deliberately does not go through the bundler. `public/engine/`
  // is emitted verbatim (see `scripts/copy-engine.mjs`), which is what both of its constraints
  // want: the bundle CSP has no `worker-src` and so falls back to `script-src 'self'`, where a real
  // same-origin worker file loads and an inlined `blob:` one is blocked with no error at all; and
  // the Emscripten glue locates its own 7MB `.wasm` beside itself at runtime, which only holds if
  // the two files are really neighbours on the origin.
  //
  // Compiling that `.wasm` needs `'wasm-unsafe-eval'` in the bundle policy. Without it the worker
  // errors at boot and no search ever returns.
})
