/**
 * The strength ladder.
 *
 * The engine underneath is Stockfish 18 (lite, single-threaded) compiled to WebAssembly and run in a
 * worker — see `uci.ts` for how it is spoken to and `scripts/copy-engine.mjs` for how it gets there.
 * That replaced a negamax over chess.js move generation, which could not search past depth 3 in a
 * reasonable time and whose evaluations were noisy enough to be their own problem.
 *
 * **One mechanism, all the way up.** Every rung searches the same depth in the same time; what
 * separates them is [Profile.meanLoss] — how many centipawns a level intends to give away per move.
 * The search is not the dial, because two dials is how the ladder was non-monotonic the first time:
 * a hand-written table had level 250 throwing away more than level 100, and 1000 through 1400
 * indistinguishable. A formula over one dial cannot do that.
 *
 * **What changed by moving to Stockfish.** The dial is the same and its units are the same, but the
 * numbers feeding it are now true. The old engine's own evaluation noise was measured at 15cp at
 * best and 85cp at worst, which put a level's intended error inside its engine's error — asking for
 * 90cp and getting something between 5 and 175. It also saturated: the bottom of the ladder could
 * not give away more than about 130cp however hard it was pushed, because at depth 2 it could not
 * tell which moves were the bad ones. Both of those are gone.
 *
 * **The numbers are measured now, not inherited.** They used to be solved against *published*
 * centipawn loss for a rating — a table of what humans of that rating average — and that was the
 * whole problem. Matching a human's average error does not produce a player of that strength: a
 * human's error is concentrated in a few blunders around an otherwise accurate game, and a level
 * that spends its allowance evenly, move after move, is far weaker for the same average. Games said
 * so — every rung was 300–390 Elo below its own label, and level 1000 played at about 610. The
 * ladder is fitted to played games instead; see [profileFor].
 *
 * **Strength depends on the device.** A search bounded by wall-clock on the player's own hardware
 * means a phone reaches a shallower depth than a laptop in the same second. The only route where
 * 1500 means the same thing everywhere is a server-side engine behind this same [Profile] — see the
 * `proxy` remote route in the app README. Nothing above this file would change.
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
  /** Ceiling on the search, as UCI `go depth`. */
  depth: number
  /**
   * Wall-clock budget for a move, as UCI `go movetime`. A cap, not a target: the search stops at
   * whichever of the two it reaches first, and at these depths that is almost always the depth.
   */
  timeMs: number
  /** How many ranked moves to ask Stockfish for, as `MultiPV`. See [RANKED_MOVES]. */
  multiPv: number
  /**
   * Average centipawns this level intends to give away per move. 0 always plays the best move.
   *
   * In the same units as the thing it controls, so calibration is not guesswork: a level that should
   * lose 90cp a move asks for 90. See `pickByLoss` in `weaken.ts`.
   */
  meanLoss: number
  /**
   * The most one move may give away, in centipawns.
   *
   * The difference between "a bit weaker" and "hangs the queen", and the reason the ladder does not
   * produce 700cp single-move losses at levels that should never see them.
   */
  maxLoss: number
}

/**
 * The names, and only the names.
 *
 * The numbers used to live in a table too, and a hand-written table is how the ladder ended up
 * non-monotonic. A formula cannot do that.
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

/**
 * What every rung searches.
 *
 * Depth 10 with [RANKED_MOVES] lines measured at ~150ms, against 400–750ms for depth 12, and every
 * line reaches the full depth in both cases. Depth 12 was the first choice and is not worth its
 * price: the whole ladder is far beyond human strength at either, and what the extra plies buy is a
 * search more likely to be cut off on a slow device — which is the one outcome that actually costs
 * something, because a cut-off iteration leaves some lines a ply shallower than others and the
 * losses `pickByLoss` reads off them stop being comparable.
 */
const SEARCH_DEPTH = 10

/**
 * The wall-clock cap on a move.
 *
 * Generous on purpose. It never binds on a machine that finishes in 150ms, so its only effect is on
 * a slow device, where waiting is cheaper than the mixed-depth scores a cut-off search produces.
 */
const MOVE_BUDGET_MS = 2000

/**
 * How many ranked moves every weakened rung sees, as `MultiPV`.
 *
 * The supply side of [Profile.meanLoss]: a level cannot give away 200cp from a list that does not
 * contain a move costing 200cp. Fixed rather than scaled to the level, which is how it was first
 * written — scaling made the *tail* a function of where the truncation happened to fall, so two
 * adjacent rungs differed by 470cp in their worst single move for no reason anyone intended.
 */
const RANKED_MOVES = 32

/** 0 at the bottom of the ladder, 1 at the top. */
function position(elo: number): number {
  const clamped = Math.max(WEAKEST, Math.min(STRONGEST, elo))
  return (clamped - WEAKEST) / (STRONGEST - WEAKEST)
}

/**
 * The ladder, fitted to games.
 *
 * `meanLoss` is what a level *asks* to give away; what it actually gives away is about 0.7 of that,
 * because `pickByLoss` can only play a move that exists — it picks the nearest available loss to its
 * target, and in most positions nothing sits exactly there. So the ask is not the loss, and neither
 * one is the strength: only games are.
 *
 * Each rung therefore played Stockfish's own `UCI_Elo` limiter — calibrated by people who measure it
 * — set to that rung's own number, 30 to 40 games, both colours, from a twelve-line opening book.
 * That is one pairing per rung, `level L` against `SF@L`, which is deliberate: it never assumes
 * Stockfish's *spacing* is true, only that each label it is given means something.
 *
 * The first run said the ladder was nowhere near its labels, and that the error grew with the rung:
 *
 * | level | played like, before | with this curve |
 * |---|---|---|
 * | 1000 | 610 | 1035 |
 * | 1400 | 1099 | 1347 |
 * | 1700 | 1348 | 1602 |
 * | 2000 | 1675 | 1956 |
 * | 2200 | — | 2156 |
 * | 2500 | 2118 | 2465 |
 *
 * Hence these constants rather than the old ones. It stays a curve and not a table for the reason it
 * always was — every term has a positive coefficient and grows with `remaining`, so no rung can come
 * out weaker than the one below it, and a hand-written table is exactly how this ladder went
 * non-monotonic the first time. What changed is only what the curve was fitted to.
 *
 * **What is left is the two ends.** Everything at or above 1400 was measured directly; 1000 was
 * measured against Stockfish's floor of 1320, which is as low as its limiter goes. Below 1000 the
 * curve is extrapolation, and a 40-game match carries about ±90 Elo of noise besides — so the rungs
 * are honest to roughly a hundred points, not to one.
 */
export function profileFor(elo: number): Profile {
  const remaining = 1 - position(elo)

  // The linear term is not fitted, it is resolution. Without it the power term collapses near the
  // top — 2400 and 2500 came out on identical constants, which is the "adjacent rungs nobody can
  // tell apart" failure this file exists to prevent, just moved to the other end of the ladder.
  const meanLoss = Math.round(22 + 14 * remaining + 210 * remaining ** 2.4)
  // The tail, and the thing that decides how a level *feels* rather than how it averages. It used to
  // be four times the mean, which was harmless against an engine that could not find a move that bad
  // and ruinous against one that can: level 1000 was throwing a whole rook away on 6% of its moves
  // while its average looked respectable. At 2.5x, a move costing 300cp or more disappears from
  // every rung above 1000 and stays only where a beginner belongs.
  const maxLoss = Math.round(2.5 * meanLoss) + 30

  return {
    elo,
    depth: SEARCH_DEPTH,
    timeMs: MOVE_BUDGET_MS,
    multiPv: RANKED_MOVES,
    meanLoss,
    maxLoss,
  }
}

/** The short label a level card carries under its number. */
export function nameFor(elo: number): string {
  return (NAMES.find(([limit]) => elo <= limit) ?? NAMES[NAMES.length - 1])[1]
}

/**
 * The analysis profile, which is not a playing profile.
 *
 * Never a blunder and never a near-best pick: an evaluation wants the truth of the position, not a
 * personality. One line, because ranking alternatives is a player's problem and not a reviewer's.
 *
 * Deeper than a playing rung and given more time, since this runs once per game rather than once per
 * move and everyone who opens the game afterwards reads the stored answer. A forty-move game is
 * eighty-one positions, so the budget here is what decides whether the progress bar takes twenty
 * seconds or two minutes.
 *
 * The quiescence tuning this used to carry is gone with the engine that needed it. Its noise floor
 * sat above the 75cp inaccuracy threshold it was being judged against, which is why a game nobody
 * erred in flagged half its moves; Stockfish's own search settles exchanges without being asked.
 */
export const ANALYSIS_PROFILE: Profile = {
  elo: 0,
  depth: 14,
  timeMs: 1500,
  multiPv: 1,
  meanLoss: 0,
  maxLoss: 0,
}

/**
 * What `analysisEngine` records, so a better engine later knows what to re-run.
 *
 * Changing this string is how every stored analysis from the old built-in engine is retired: a game
 * whose evaluations were produced by something else is re-analysed rather than trusted.
 */
export const ANALYSIS_ENGINE = `sf18-lite d${ANALYSIS_PROFILE.depth}`
