/**
 * A small chess engine: negamax with alpha-beta, quiescence, and a material + piece-square
 * evaluation. Pure and synchronous — it runs in a worker (see `engine.worker.ts`) so a search never
 * blocks the board.
 *
 * chess.js does move generation. That makes this short and correct at the cost of speed: a
 * bitboard engine searches orders of magnitude more positions per second, which is the real ceiling
 * on how strong the top of the ladder can be. See `levels.ts`.
 */
import { Chess } from 'chess.js'

import type { Profile } from './levels'

const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 }

const MATE = 100_000

/** Michniewski's simplified-evaluation tables, white's perspective, index 0 = a8. */
const PST: Record<string, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5,
    10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20,
    -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10,
    0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10,
    5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0,
    -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0,
    0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0,
    5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0,
    0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
    -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30,
    -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0,
    10, 30, 20,
  ],
}

/**
 * The king wants the corner in a middlegame and the centre in an endgame, and the difference is
 * most of what stands between mating with a queen and shuffling forever.
 */
const KING_ENDGAME = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30,
  20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10,
  20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
]

/** Below this much non-pawn material for both sides together, the king should come out. */
const ENDGAME_MATERIAL = 1300

/**
 * White-positive evaluation, in centipawns.
 *
 * `chess.board()` already hands back rank 8 first, which is the order the tables are written in, so
 * white reads straight off and black reads off the mirrored row.
 */
export function evaluate(position: Chess): number {
  const board = position.board()

  let material = 0
  for (const row of board) {
    for (const square of row) {
      if (square && square.type !== 'p' && square.type !== 'k') material += VALUE[square.type]
    }
  }
  const endgame = material <= ENDGAME_MATERIAL

  let score = 0
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 8; column++) {
      const square = board[row][column]
      if (!square) continue
      const table = square.type === 'k' && endgame ? KING_ENDGAME : PST[square.type]
      const index = square.color === 'w' ? row * 8 + column : (7 - row) * 8 + column
      const value = VALUE[square.type] + table[index]
      score += square.color === 'w' ? value : -value
    }
  }
  return score
}

type Candidate = { from: string; to: string; promotion?: string; san: string; score: number }

/** Most-valuable-victim / least-valuable-attacker, so captures are tried first. */
function orderingScore(move: { captured?: string; piece: string; promotion?: string }): number {
  let score = 0
  if (move.captured) score += 10 * VALUE[move.captured] - VALUE[move.piece]
  if (move.promotion) score += VALUE[move.promotion]
  return score
}

function generate(position: Chess, capturesOnly = false) {
  const moves = position.moves({ verbose: true })
  const usable = capturesOnly ? moves.filter((move) => Boolean(move.captured)) : moves
  // Sorting one move is pure overhead, and quiescence hits that case constantly.
  return usable.length > 1 ? usable.sort((a, b) => orderingScore(b) - orderingScore(a)) : usable
}

/** Ran out of time. Thrown rather than returned so it unwinds the whole search at once. */
class Timeout extends Error {}

function checkDeadline(deadline: number): void {
  if (Date.now() > deadline) throw new Timeout()
}

/**
 * Search on past the horizon until the position is quiet.
 *
 * Without it the engine happily "wins" a queen on the last ply of its search and never sees the
 * recapture — the single most visible way a shallow engine looks stupid.
 */
function quiesce(
  position: Chess,
  alpha: number,
  beta: number,
  deadline: number,
  ply: number,
  maxPly: number,
): number {
  checkDeadline(deadline)
  const sign = position.turn() === 'w' ? 1 : -1
  const standPat = sign * evaluate(position)
  if (ply >= maxPly || standPat >= beta) return standPat
  let best = Math.max(alpha, standPat)

  for (const move of generate(position, true)) {
    position.move(move)
    const score = -quiesce(position, -beta, -best, deadline, ply + 1, maxPly)
    position.undo()
    if (score >= beta) return score
    if (score > best) best = score
  }
  return best
}

function negamax(
  position: Chess,
  depth: number,
  alpha: number,
  beta: number,
  deadline: number,
  ply: number,
  quiescence: number,
): number {
  checkDeadline(deadline)

  const moves = generate(position)
  if (moves.length === 0) {
    // Mate scored by distance, so the engine prefers mate in one to mate in five.
    return position.isCheckmate() ? -MATE + ply : 0
  }
  if (depth === 0) return quiesce(position, alpha, beta, deadline, 0, quiescence)

  let best = -Infinity
  let window = alpha
  for (const move of moves) {
    position.move(move)
    const score = -negamax(position, depth - 1, -beta, -window, deadline, ply + 1, quiescence)
    position.undo()
    if (score > best) best = score
    if (best > window) window = best
    if (window >= beta) break
  }
  return best
}

/**
 * Which move a weaker level plays.
 *
 * Two earlier models failed, and both failures were instructive. The first played a uniformly random
 * legal move some percentage of the time: that is not a weaker player, it is an erratic one, and it
 * produced 300–750cp disasters at levels that should never see them. The second ranked the moves and
 * picked by rank — better shaped, but far too strong, because at shallow depth the ranked moves
 * score within a few centipawns of each other, so wandering eight places down the list costs almost
 * nothing. Level 100 measured at an average loss of 41cp, which is expert play.
 *
 * The dial that works is the one in the same units as the thing it controls. [meanLoss] is the
 * average number of centipawns this level intends to give away per move; a target is drawn from an
 * exponential distribution around it, and the move whose actual loss sits nearest that target is
 * played. So most moves cost a little, some cost more, and [maxLoss] bounds the tail — which is what
 * separates "weaker" from "hangs the queen".
 *
 * Calibration is thendirect: to make a level lose 90cp a move on average, ask for 90.
 */
function pickByLoss(
  ranked: Candidate[],
  meanLoss: number,
  maxLoss: number,
  random: () => number,
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

export type SearchResult = {
  /** The chosen move in UCI, or undefined when the position has no legal move. */
  uci?: string
  san?: string
  /** Centipawns from the mover's point of view. */
  score: number
  /** The deepest ply that finished inside the time budget. */
  depth: number
}

/**
 * Pick a move for the side to move.
 *
 * Iterative deepening: each depth completes or is discarded, so a search cut off by the clock still
 * returns the best move from the last depth that finished rather than a half-considered one.
 *
 * [random] is injectable so the weak levels — which are mostly randomness — can be tested.
 */
export function search(fen: string, profile: Profile, random: () => number = Math.random): SearchResult {
  const position = new Chess(fen)
  const legal = generate(position)
  if (legal.length === 0) {
    // A game's last position is a terminal one, and scoring it 0 made a checkmate read as dead level
    // — so the mating move showed up in a review as the worst blunder in the game.
    return { score: position.isCheckmate() ? -MATE : 0, depth: 0 }
  }

  const uciOf = (move: { from: string; to: string; promotion?: string }) =>
    `${move.from}${move.to}${move.promotion ?? ''}`

  const deadline = Date.now() + profile.timeMs
  let candidates: Candidate[] = legal.map((move) => ({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    san: move.san,
    score: 0,
  }))
  let reached = 0

  /**
   * Whether root scores have to be exact.
   *
   * Narrowing alpha at the root is where most of the search's speed lives — without it the top level
   * produces no cutoffs at all — but it makes the score of every move that fails low an upper bound
   * rather than a value. Ranking moves against each other needs real values. So the levels that play
   * below their best search wide, and the levels that always play their best search narrow.
   */
  const exactScores = profile.meanLoss > 0

  let leader: Candidate | undefined
  for (let depth = 1; depth <= profile.depth; depth++) {
    const scored: Candidate[] = []
    let alpha = -Infinity
    try {
      // Best-first from the previous iteration: the more the first move is actually the best one,
      // the more the rest of them cut off.
      const order = depth === 1 ? legal : candidates.map((candidate) => candidate)
      for (const entry of order) {
        const move = legal.find(
          (candidate) =>
            candidate.from === entry.from &&
            candidate.to === entry.to &&
            candidate.promotion === entry.promotion,
        )
        if (!move) continue
        position.move(move)
        const score = -negamax(
          position,
          depth - 1,
          -Infinity,
          exactScores ? Infinity : -alpha,
          deadline,
          1,
          profile.quiescence,
        )
        position.undo()
        if (score > alpha) {
          alpha = score
          leader = { from: move.from, to: move.to, promotion: move.promotion, san: move.san, score }
        }
        scored.push({
          from: move.from,
          to: move.to,
          promotion: move.promotion,
          san: move.san,
          score,
        })
      }
    } catch (failure) {
      if (failure instanceof Timeout) break
      throw failure
    }
    scored.sort((a, b) => b.score - a.score)
    candidates = scored
    reached = depth
  }

  // Only compare moves against each other when their scores mean the same thing. A narrowed root
  // gives fail-low moves an upper bound, not a value, so the leader is the only trustworthy answer.
  if (!exactScores) {
    const best = leader ?? candidates[0]
    return { uci: uciOf(best), san: best.san, score: best.score, depth: reached }
  }

  const chosen = pickByLoss(candidates, profile.meanLoss, profile.maxLoss, random)
  return { uci: uciOf(chosen), san: chosen.san, score: chosen.score, depth: reached }
}
