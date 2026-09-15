/**
 * Copy the Stockfish build into `public/engine/`, where Vite emits it verbatim.
 *
 * It cannot go through the bundler. The glue is a classic script that finds its own `.wasm` beside
 * itself at runtime (`self.location`), and it is started as a real worker file because the bundle
 * CSP has no `worker-src` and so falls back to `script-src 'self'` — a `blob:` worker is blocked
 * with no error at all. Both facts want two plain files sitting next to each other on the origin.
 *
 * Copied rather than committed: it is 7MB of build output that `npm ci` already fetches, and a
 * lockfile is a better record of which build is in use than a binary in the history.
 */
import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(app, 'node_modules', 'stockfish', 'bin')
const to = join(app, 'public', 'engine')

/**
 * The lite, single-threaded build, and the only one of the five that can run here.
 *
 * Multi-threaded needs `SharedArrayBuffer`, which needs cross-origin isolation — COOP/COEP on the
 * bundle response *and* on the host page, plus `allow="cross-origin-isolated"` on the iframe. None
 * of that exists, so the choice is between the two single-threaded builds, and the full net is 108MB
 * against the lite net's 7MB. Stockfish's own guidance is that lite is the one to ship: still far
 * beyond any human, and the large one loads slowly enough to hurt.
 */
export const ENGINE_BASENAME = 'stockfish-18-lite-single'

/**
 * The app loads the engine by name, so a copy under a name nothing loads is a blank board with
 * nothing in the console to explain it. Checked here rather than trusted.
 */
const loader = readFileSync(join(app, 'src', 'engine', 'uci.ts'), 'utf8')
if (!loader.includes(`'${ENGINE_BASENAME}'`)) {
  throw new Error(
    `src/engine/uci.ts does not load '${ENGINE_BASENAME}' — ENGINE_BASENAME is out of step here.`,
  )
}

mkdirSync(to, { recursive: true })
for (const extension of ['js', 'wasm']) {
  const name = `${ENGINE_BASENAME}.${extension}`
  copyFileSync(join(from, name), join(to, name))
  console.log(`engine: ${name} (${(statSync(join(to, name)).size / 1e6).toFixed(1)}MB)`)
}
