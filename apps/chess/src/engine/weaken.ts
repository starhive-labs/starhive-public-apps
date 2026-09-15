/**
 * How a level plays below its best.
 *
 * This is the one part of the old built-in engine worth keeping, and it survives the move to
 * Stockfish unchanged — because it was never about searching, only about choosing among moves whose
 * scores are already known. Stockfish supplies the scores now, through `MultiPV`, and supplies them
 * honestly; the choosing is the same arithmetic it always was.
 *
 * Two earlier models failed, and both failures were instructive. The first played a uniformly random
 * legal move some percentage of the time: that is not a weaker player, it is an erratic one, and it
 * produced 300–750cp disasters at levels that should never see them. The second ranked the moves and
 * picked by rank — better shaped, but far too strong, because at shallow depth the ranked moves
 * score within a few centipawns of each other, so wandering eight places down the list costs almost
 * nothing.
 *
 * The dial that works is the one in the same units as the thing it controls. [meanLoss] is the
 * average number of centipawns a level intends to give away per move; a target is drawn from an
 * exponential distribution around it, and the move whose actual loss sits nearest that target is
 * played. So most moves cost a little, some cost more, and [maxLoss] bounds the tail — which is what
 * separates "weaker" from "hangs the queen".
 *
 * **Stockfish has its own dials, and they are not used.** `UCI_LimitStrength` with `UCI_Elo` is
 * properly calibrated by people who measure it, which is more than can be said for the numbers here
 * — but it floors at 1320, and half this ladder is below that. Running Elo-limiting above 1320 and
 * loss-shaping below it would be two mechanisms meeting in the middle, which is precisely how the
 * ladder was non-monotonic the first time. One mechanism all the way up, or the rungs stop meaning
 * anything relative to each other.
 */

/** One move Stockfish returned a score for. */
export type Candidate = {
  /** Long algebraic, as UCI speaks it: `e2e4`, `e7e8q`. */
  uci: string
  /** Centipawns from the mover's point of view. */
  score: number
}

/**
 * Which of [ranked] this level plays. Best-first; the result is one of them.
 *
 * [random] is injectable so the weak levels — which are mostly randomness — can be tested.
 */
export function pickByLoss(
  ranked: Candidate[],
  meanLoss: number,
  maxLoss: number,
  random: () => number = Math.random,
): Candidate {
  const best = ranked[0]
  if (meanLoss <= 0 || ranked.length === 1) return best

  // Exponential: mostly small errors, occasionally a bigger one, never unbounded.
  const draw = -Math.log(1 - random()) * meanLoss
  const target = Math.min(draw, maxLoss)

  let chosen = best
  let nearest = Infinity
  for (const candidate of ranked) {
    const loss = best.score - candidate.score
    if (loss > maxLoss) continue
    const distance = Math.abs(loss - target)
    // Ties go to the move already chosen, which is the better one: `ranked` is best-first.
    if (distance < nearest) {
      nearest = distance
      chosen = candidate
    }
  }
  return chosen
}
