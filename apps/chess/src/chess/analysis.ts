/**
 * Reading a finished game.
 *
 * All of it is arithmetic over one array of evaluations — one per position the game passed through,
 * in centipawns, always from **White's** point of view. Nothing here runs an engine; producing the
 * numbers is `useAnalysis`, and everything a review shows is derived from them afterwards, which is
 * why a reviewed game costs nothing to reopen.
 */

/** What the engine returns for a forced mate, before distance is subtracted. */
export const MATE_SCORE = 100_000

/** Anything past this is a mate score rather than a material one. */
const MATE_THRESHOLD = 50_000

/** Where the bar tops out. Beyond a rook up, "more winning" is not a useful distinction. */
const BAR_CLAMP = 1000

export function isMate(centipawns: number): boolean {
  return Math.abs(centipawns) > MATE_THRESHOLD
}

/** Moves until mate, for a mate score. */
export function mateIn(centipawns: number): number {
  return Math.max(1, Math.ceil((MATE_SCORE - Math.abs(centipawns)) / 2))
}

/** `+1.2`, `-0.5`, `M3`, `-M2`. White-relative, like every engine output people have seen. */
export function formatEval(centipawns: number): string {
  if (isMate(centipawns)) return `${centipawns < 0 ? '-' : ''}M${mateIn(centipawns)}`
  const pawns = centipawns / 100
  return `${pawns > 0 ? '+' : pawns === 0 ? '' : ''}${pawns.toFixed(1)}`
}

/**
 * White's share of the bar, 0–100.
 *
 * A sigmoid rather than a straight scale: the difference between +0.3 and +1.0 matters and the
 * difference between +7 and +9 does not, and a linear bar spends most of its length on the second.
 * Clamped away from the ends so the losing side always keeps a sliver — a bar with nothing in it
 * reads as broken rather than as lost.
 */
export function advantagePercent(centipawns: number): number {
  if (isMate(centipawns)) return centipawns > 0 ? 99 : 1
  const clamped = Math.max(-BAR_CLAMP, Math.min(BAR_CLAMP, centipawns))
  const share = 100 / (1 + Math.exp(-0.004 * clamped))
  return Math.max(2, Math.min(98, share))
}

/** The two sides, as the bar paints them. Not themed: White is white in every chess program. */
export const BAR_WHITE = '#f0f0f0'
export const BAR_BLACK = '#2b2b2b'

export type EvalBarLayout = {
  /** How much of the bar the *bottom* side fills, 0–100. */
  bottomPercent: number
  /** The colour of that fill, and of the ground behind it. */
  bottomColour: string
  groundColour: string
  /** Which end the score sits at, and what colour it has to be to be read there. */
  labelEdge: 'top' | 'bottom'
  labelColour: string
}

/**
 * How to paint the evaluation bar for a board at [orientation].
 *
 * Two independent flips, which is exactly why this is a function with tests rather than an
 * expression in a component. The bar had one of them: playing Black it correctly drew *Black's*
 * share at the bottom, and then drew it in white — so a winning black position filled the bar with
 * White. The side at the bottom of the bar is the side at the bottom of the board, and its fill has
 * to be that side's colour.
 */
export function evalBarLayout(centipawns: number, orientation: 'white' | 'black'): EvalBarLayout {
  const bottomIsWhite = orientation === 'white'
  const whiteShare = advantagePercent(centipawns)

  const leaderIsWhite = centipawns >= 0
  // The score belongs at the leader's end, where there is fill to write it on.
  const leaderAtBottom = leaderIsWhite === bottomIsWhite

  return {
    bottomPercent: bottomIsWhite ? whiteShare : 100 - whiteShare,
    bottomColour: bottomIsWhite ? BAR_WHITE : BAR_BLACK,
    groundColour: bottomIsWhite ? BAR_BLACK : BAR_WHITE,
    labelEdge: leaderAtBottom ? 'bottom' : 'top',
    // Ink against the fill it sits on, which is the leader's colour.
    labelColour: leaderIsWhite ? BAR_BLACK : BAR_WHITE,
  }
}

export type Judgement = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder'

/** Centipawns thrown away, and what that is called. The thresholds are the familiar ones. */
export function judge(loss: number): Judgement {
  if (loss >= 300) return 'blunder'
  if (loss >= 150) return 'mistake'
  if (loss >= 75) return 'inaccuracy'
  if (loss >= 25) return 'good'
  return 'best'
}

/**
 * The move-annotation glyphs every chess player already reads.
 *
 * Standard notation, not an invention: `?!` dubious, `?` a mistake, `??` a blunder. Only the faults
 * get one. `!` in real notation means a *strong* move — a move worth praising — not merely the one
 * the engine happened to rank first, so marking every best move with it would be both wrong and
 * noisy in a list where most moves are unremarkable.
 */
export const JUDGEMENT_SYMBOL: Record<Judgement, string> = {
  best: '',
  good: '',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
}

/** The colours those glyphs are drawn in, which are the familiar ones too. */
export const JUDGEMENT_COLOUR: Record<Judgement, string> = {
  best: '#5a9e5a',
  good: '#7aa93c',
  inaccuracy: '#e0a32e',
  mistake: '#e07a2a',
  blunder: '#c8372d',
}

export const JUDGEMENT_LABEL: Record<Judgement, string> = {
  best: 'Best move',
  good: 'Good move',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
}

/** Only the three that are worth interrupting someone about. */
export function isFault(judgement: Judgement): boolean {
  return judgement === 'inaccuracy' || judgement === 'mistake' || judgement === 'blunder'
}

export type ReviewMove = {
  /** 0-based ply. */
  ply: number
  san: string
  /** 'w' for a white move. */
  side: 'w' | 'b'
  /** White-relative evaluation before and after the move. */
  before: number
  after: number
  /** Centipawns the mover threw away. Never negative: you cannot gain by the engine's reckoning. */
  loss: number
  judgement: Judgement
}

/**
 * Turn the raw evaluations into one row per move.
 *
 * The mover's loss, not White's: a black blunder is a *rise* in a white-relative evaluation, and
 * reporting that as a gain is how a review ends up congratulating someone for hanging their queen.
 */
export function reviewMoves(sans: string[], evals: number[]): ReviewMove[] {
  const moves: ReviewMove[] = []
  for (let ply = 0; ply < sans.length; ply++) {
    const before = evals[ply]
    const after = evals[ply + 1]
    if (before === undefined || after === undefined) break
    const side: 'w' | 'b' = ply % 2 === 0 ? 'w' : 'b'
    const swing = side === 'w' ? before - after : after - before
    const loss = Math.max(0, Math.round(swing))
    moves.push({ ply, san: sans[ply], side, before, after, loss, judgement: judge(loss) })
  }
  return moves
}

/** The sentence under the board. */
export function comment(move: ReviewMove): string {
  const label = JUDGEMENT_LABEL[move.judgement]
  if (isMate(move.after) && !isMate(move.before)) {
    return `${label}. ${move.side === 'w' ? 'White' : 'Black'} is mated in ${mateIn(move.after)}.`
  }
  if (!isFault(move.judgement)) return `${label}. The evaluation holds at ${formatEval(move.after)}.`
  const cost = (move.loss / 100).toFixed(1)
  return `${label}. It costs ${cost} — from ${formatEval(move.before)} to ${formatEval(move.after)}.`
}

// ---------------------------------------------------------------------------
// Storage — one TEXT attribute, comma-separated
// ---------------------------------------------------------------------------

export function serializeEvals(evals: number[]): string {
  return evals.map((value) => Math.round(value)).join(',')
}

export function parseEvals(raw: string | undefined): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value))
}

/**
 * Is the stored analysis usable for this game?
 *
 * Length is the check, because the two can drift apart honestly: a game analysed before its last
 * move was played has evaluations that no longer describe it, and silently pairing them with the
 * wrong moves would label the wrong move a blunder.
 */
export function analysisMatches(evals: number[], moveCount: number): boolean {
  return evals.length === moveCount + 1
}

/** Summary counts for the header of a review. */
export function faultCounts(moves: ReviewMove[], side: 'w' | 'b') {
  const mine = moves.filter((move) => move.side === side)
  return {
    blunders: mine.filter((move) => move.judgement === 'blunder').length,
    mistakes: mine.filter((move) => move.judgement === 'mistake').length,
    inaccuracies: mine.filter((move) => move.judgement === 'inaccuracy').length,
  }
}

/**
 * Accuracy as a percentage.
 *
 * A simple exponential decay on average centipawn loss — not Lichess's win-percentage integral, and
 * not claiming to be. It ranks games the same way and it is one line; when the engine gets good
 * enough for the number to be worth arguing about, this is the place to do it properly.
 */
export function accuracy(moves: ReviewMove[], side: 'w' | 'b'): number {
  const mine = moves.filter((move) => move.side === side)
  if (mine.length === 0) return 100
  const averageLoss = mine.reduce((total, move) => total + move.loss, 0) / mine.length
  return Math.round(100 * Math.exp(-averageLoss / 250))
}
