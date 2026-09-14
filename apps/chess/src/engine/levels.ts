/**
 * The strength ladder.
 *
 * **These are the ratings a level aims at, not measured strength.** The engine behind them is a
 * negamax over chess.js move generation running in a browser worker, because the bundle CSP
 * (`script-src 'self' 'unsafe-inline'`, no `'wasm-unsafe-eval'`) refuses to compile WebAssembly, so
 * Stockfish cannot run *in the browser*.
 *
 * That is a statement about compiling WASM client-side, not about what is reachable. There are two
 * ways to a real engine, and this file is the seam for both — nothing above it changes either way:
 *
 * 1. **Allow `'wasm-unsafe-eval'`** in the bundle policy (`BundleCsp.kt`, `cloudfront.tf`) and run
 *    Stockfish in this worker. Nearly free, nothing to operate, nothing leaves the browser — but the
 *    strength a player meets then depends on the device they are holding.
 * 2. **A `proxy` remote** to a Stockfish service. The proxy is built and needs no platform change
 *    (`app-platform-service/.../remote/`), and a remote with a fixed address and no credential is
 *    callable with nothing stored. It costs running that service, and it is the only route that
 *    makes 1500 mean the same thing on a phone and a laptop.
 *
 * What that costs, measured rather than guessed, in a middlegame with ~38 legal moves:
 *
 * | search | time |
 * |---|---|
 * | depth 2, quiescence 4 | ~0.5s |
 * | depth 3, quiescence 2 | ~6s |
 * | depth 4 | ~60s |
 *
 * So depth 3 is the practical ceiling, and the numbers below are honest only at the bottom of the
 * ladder. Up to about 1500 the rungs differ in the way a weaker player differs from a stronger one:
 * how often they throw a move away. Above it they differ by less and less, and the top few are the
 * same search with the sloppiness turned off — a long way short of a real 2500.
 *
 * Making the top half mean what it says needs two things, in this order: allow WASM in the bundle
 * policy (two string literals — see `docs/chess-app-investigation.md` §3 in the starhive-development
 * repo), then put Stockfish behind this same `Profile` interface. Nothing above this file changes.
 */

/** Every level offered, weakest first. */
export const LEVELS = [
  100, 250, 500, 750, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100, 2200,
  2300, 2400, 2500,
] as const

export type Level = (typeof LEVELS)[number]

export const DEFAULT_LEVEL: Level = 1000

export type Profile = {
  elo: number
  /** Hard ceiling on iterative deepening. */
  depth: number
  /** Wall-clock budget for a move. A depth that does not finish inside it is discarded. */
  timeMs: number
  /**
   * How far past the horizon captures are chased. 0 disables quiescence entirely.
   *
   * **Keep it even.** An odd cut-off stops in the middle of an exchange, so the evaluation credits
   * whoever captured last — a bias that flips every ply. Measured, an odd depth was six times
   * noisier than the even one either side of it.
   */
  quiescence: number
  /**
   * Average centipawns this level intends to give away per move. 0 always plays the best move.
   *
   * In the same units as the thing it controls, so calibration is not guesswork: a level that should
   * lose 90cp a move asks for 90. See `pickByLoss`.
   */
  meanLoss: number
  /**
   * The most one move may give away, in centipawns.
   *
   * The difference between "a bit weaker" and "hangs the queen", and the reason the ladder no longer
   * produces 700cp single-move losses at levels that should never see them.
   */
  maxLoss: number
}

/**
 * The names, and only the names.
 *
 * The numbers used to live in a table too, and a hand-written table is how the ladder ended up
 * non-monotonic — measured, level 250 threw away more than level 100, and 1000 through 1400 were
 * indistinguishable. A formula cannot do that, and the tests assert it does not.
 */
const NAMES: Array<[number, string]> = [
  [250, 'Learning the moves'],
  [500, 'Beginner'],
  [750, 'Casual'],
  [1000, 'Club novice'],
  [1300, 'Club player'],
  [1600, 'Strong club'],
  [1900, 'Tournament'],
  [2200, 'Expert'],
  [2500, 'Master'],
]

const WEAKEST = LEVELS[0]
const STRONGEST = LEVELS[LEVELS.length - 1]

/** 0 at the bottom of the ladder, 1 at the top. */
function position(elo: number): number {
  const clamped = Math.max(WEAKEST, Math.min(STRONGEST, elo))
  return (clamped - WEAKEST) / (STRONGEST - WEAKEST)
}

export function profileFor(elo: number): Profile {
  const t = position(elo)
  const remaining = 1 - t

  // Depth is what the level can see; meanLoss is how much of it the level chooses to use.
  //
  // **Why no rung searches three plies.** Playing below your best means ranking the moves against
  // each other, ranking needs exact scores, and exact scores need the *wide* root search at about
  // 2.5x the cost — so depth 3 is affordable only for a level that never plays below its best, which
  // is the top rung alone. That produced an absurd cliff: 2400 intends to give away one centipawn a
  // move, one centipawn is not zero, so it searched wide at depth 2 in two seconds — while 2500, at
  // exactly zero, searched narrow at depth 3 and took seven. A 1cp difference in intent buying a
  // 3.5x difference in thinking time is not a trade worth making, least of all at the end of a
  // ladder that is openly aspirational up there anyway.
  //
  // So the whole ladder is one mechanism: the same search, and meanLoss all the way up. The top rung
  // gives up a ply and answers in two seconds like everything else. Getting real strength back is
  // not a matter of tuning this line — it is Stockfish, by either route named above.
  const depth = elo >= 750 ? 2 : 1
  const timeMs = depth === 2 ? 2200 : 600

  return {
    elo,
    depth,
    timeMs,
    // Even, always: an odd cut-off stops mid-exchange and credits whoever captured last.
    //
    // The weakest rungs get less of it on purpose. Asking a level to give away 320cp a move does not
    // work if no move on the board gives away that much — measured, the bottom of the ladder
    // saturated around 130cp however hard it was pushed. Taking quiescence away instead makes the
    // level genuinely not see the recapture, so it loses material the way a beginner does: by
    // missing the exchange rather than by choosing a bad move on purpose.
    quiescence: elo <= 250 ? 0 : elo <= 500 ? 2 : 4,
    // Tuned against measurement, not chosen: see the table in the README. The exponent makes the
    // drop steep at the bottom, where rungs are far apart in strength, and gentle at the top, where
    // they are close.
    meanLoss: Math.round(320 * remaining ** 1.7),
    // The tail. Four times the mean, so the cap binds rarely but a single move can never be a
    // catastrophe — the failure of the very first model.
    maxLoss: Math.round(4 * 320 * remaining ** 1.7) + 20,
  }
}

/** The short label a level card carries under its number. */
export function nameFor(elo: number): string {
  return (NAMES.find(([limit]) => elo <= limit) ?? NAMES[NAMES.length - 1])[1]
}

/**
 * True where the label is doing more work than the engine.
 *
 * The card says so rather than letting someone pick 2500 and wonder why it drops a piece.
 */
export function isAspirational(elo: number): boolean {
  return elo > 1600
}

/**
 * How long this level may take to move, for the card.
 *
 * A ceiling, and phrased as one: `timeMs` is the budget iterative deepening is cut off at, not the
 * time a move actually takes. Measured, a depth-2 rung answers a middlegame in about a second and
 * only approaches its budget in a tangle — saying "~2s" would overstate the wait on most moves.
 */
export function thinkingTime(elo: number): string {
  const { timeMs } = profileFor(elo)
  return timeMs >= 1000 ? `under ${Math.round(timeMs / 1000)}s a move` : 'instant'
}

/**
 * The analysis profile, which is not a playing profile.
 *
 * Never a blunder and never a near-best pick: an evaluation wants the truth of the position, not a
 * personality. The other two numbers were measured rather than chosen.
 *
 * **Depth 2, not 3.** Depth 3 costs five times as much (80s against 16s for the same game) and
 * flags *more* moves, not fewer — it is slower and no steadier. Depth is not what this engine is
 * short of.
 *
 * **Quiescence 6, and even.** This is what actually mattered. A quiescence cut-off is a horizon of
 * its own, and an *odd* one stops in the middle of an exchange, so the evaluation is biased by
 * whoever happened to capture last — which alternates every ply. Measured on a quiet game, the
 * median ply-to-ply wobble was 85cp at q3 and 15cp at q6, with the worst case falling from 145cp to
 * 50cp. Since an inaccuracy starts at 75cp, q3 put the engine's own noise floor *above* the
 * threshold it was being judged against: it flagged half the moves in a game where nobody erred.
 */
export const ANALYSIS_PROFILE: Profile = {
  elo: 0,
  depth: 2,
  timeMs: 6000,
  quiescence: 6,
  meanLoss: 0,
  maxLoss: 0,
}

/** What `analysisEngine` records, so a better engine later knows what to re-run. */
export const ANALYSIS_ENGINE = `builtin d${ANALYSIS_PROFILE.depth} q${ANALYSIS_PROFILE.quiescence}`
