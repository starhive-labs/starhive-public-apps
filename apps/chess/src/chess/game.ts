/**
 * The game, as this app understands it.
 *
 * One object carries a whole game: the position as a FEN, the history as UCI, the seats as USER
 * values. Everything else — whose turn it is, whether the game is over, who may move — is *derived*
 * here rather than stored, which is what keeps a move to a single `objects.update`.
 */
import type { BridgeObject, BridgeType } from '@starhive/bridge'
import { attributeBy, rawValueOf, valuesOf } from '@starhive/bridge'
import { Chess, DEFAULT_POSITION, type Square } from 'chess.js'

/** The manifest's type key. */
export const TYPE_KEY = 'game'

/** The manifest's workflow state keys, as `context.stateKeyToId` names them. */
export const STATE = {
  open: 'game.open',
  playing: 'game.playing',
  finished: 'game.finished',
  cancelled: 'game.cancelled',
} as const

/** Where a game is in its life, resolved from the workflow state the object carries. */
export type GameStatus = keyof typeof STATE

const STATUSES = Object.keys(STATE) as GameStatus[]

/**
 * Attribute keys, exactly as the manifest declares them.
 *
 * Addressed by key and never by display name: a name is a string an admin can rename, a key is
 * identity.
 */
export const ATTR = [
  'title',
  'white',
  'black',
  'fen',
  'moves',
  'result',
  'status',
  'cancelled',
  'opponent',
  'level',
  'evals',
  'analysisEngine',
  'timeControl',
  'whiteMs',
  'blackMs',
  'turnStartedAt',
] as const

export type AttrKey = (typeof ATTR)[number]

/** Manifest key -> provisioned attribute id, for the one type this app has. */
export type AttrIds = Record<AttrKey, string>

/**
 * Resolve every attribute id at once, or nothing.
 *
 * All-or-nothing on purpose: a half-resolved map means silently writing to the wrong field, and the
 * only way to be missing one is an install that did not provision cleanly — which the app should
 * say out loud rather than paper over.
 */
export function attrIds(type: BridgeType): AttrIds | undefined {
  const entries = ATTR.map((key) => [key, attributeBy(type, key)?.id] as const)
  if (entries.some(([, id]) => !id)) return undefined
  return Object.fromEntries(entries) as AttrIds
}

export type Seat = 'w' | 'b'

/** PGN-standard result values — the same strings the manifest's OPTION offers. */
export type GameResult = '*' | '1-0' | '0-1' | '1/2-1/2'

export type Player = { id: string; name: string }

/** Who holds the other seat. `computer` means nobody will ever take it. */
export type Opponent = 'human' | 'computer'

export type Game = {
  id: string
  title: string
  white?: Player
  black?: Player
  /** The current position. Carries side to move, castling rights, en passant and both clocks. */
  fen: string
  /** Full history in UCI (`e2e4`, `e7e8q`). Never truncate it — phase 2's analysis is built on it. */
  moves: string[]
  result: GameResult
  /** The workflow state id, as stored. `status` is the same thing, resolved. */
  statusStateId?: string
  /**
   * Undefined when the object is in a state this app does not know — including, on an install that
   * predates a state, one the manifest declares but provisioning never created. Never decide
   * anything on it; it is here to display.
   */
  status?: GameStatus
  /** Called off before anyone took the seat. An attribute, not a workflow state — see the manifest. */
  cancelled: boolean
  opponent: Opponent
  /** The rating a computer opponent is playing at. Undefined for a human game. */
  level?: number
  /** Raw stored evaluations, one per position. Parsed by `analysis.parseEvals`. */
  evals?: string
  /** What produced [evals], e.g. `builtin d2 q3`. Absent when the game has never been analysed. */
  analysisEngine?: string
  /** The time control's key, or undefined for an untimed game. */
  timeControl?: string
  /** Each side's remaining milliseconds as of the last move. */
  whiteMs?: number
  blackMs?: number
  /** Epoch milliseconds at which the side to move started thinking. */
  turnStartedAt?: number
}

/**
 * The starting position, taken from chess.js rather than typed out.
 *
 * It matters that this is exactly the FEN chess.js produces: `verifyHistory` compares a replayed
 * position against the stored one string-for-string, so a hand-written start FEN that differs by a
 * halfmove clock makes every new game fail its own integrity check.
 */
export const START_FEN = DEFAULT_POSITION

const RESULTS: readonly string[] = ['*', '1-0', '0-1', '1/2-1/2']

function asResult(value: string | undefined): GameResult {
  return value && RESULTS.includes(value) ? (value as GameResult) : '*'
}

/** The seat's occupant, from a USER value the host already resolved to a name. */
function playerAt(object: BridgeObject, attributeId: string): Player | undefined {
  const [first] = valuesOf(object, attributeId)
  if (!first) return undefined
  // Identity comes from the raw stored value, because that is literally what this app wrote
  // (`context.user.id`). The host's resolved `user.id` is its own record's id and is not promised to
  // be the same one — preferring it would silently stop `seatOf` recognising the person playing.
  const id = first.value || first.user?.id
  if (!id) return undefined
  return { id, name: first.user?.name ?? first.display ?? 'Someone' }
}

/** A stored number, or undefined for anything that is not one. */
function finiteOrUndefined(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

/** Which of this app's states [stateId] is, if any. */
export function statusOf(
  stateId: string | undefined,
  stateKeyToId: Record<string, string>,
): GameStatus | undefined {
  if (!stateId) return undefined
  return STATUSES.find((status) => stateKeyToId[STATE[status]] === stateId)
}

export function readGame(
  object: BridgeObject,
  ids: AttrIds,
  stateKeyToId: Record<string, string>,
): Game {
  const moves = (rawValueOf(object, ids.moves) ?? '').trim()
  const statusStateId = valuesOf(object, ids.status)[0]?.state?.id
  const level = Number(rawValueOf(object, ids.level))
  // Tolerant of however the host encodes a boolean: the app never sees space-manager's wire format
  // directly, and guessing wrong would silently un-cancel every cancelled game.
  const cancelled = ['true', '1', 'yes'].includes((rawValueOf(object, ids.cancelled) ?? '').toLowerCase())
  return {
    id: object.id,
    title: rawValueOf(object, ids.title) ?? 'Untitled game',
    white: playerAt(object, ids.white),
    black: playerAt(object, ids.black),
    fen: rawValueOf(object, ids.fen) || START_FEN,
    moves: moves ? moves.split(/\s+/) : [],
    result: asResult(rawValueOf(object, ids.result)),
    statusStateId,
    status: statusOf(statusStateId, stateKeyToId),
    cancelled,
    // A game written before the field existed is a human game — that is all there was.
    opponent: rawValueOf(object, ids.opponent) === 'Computer' ? 'computer' : 'human',
    level: Number.isFinite(level) && level > 0 ? level : undefined,
    evals: rawValueOf(object, ids.evals) || undefined,
    analysisEngine: rawValueOf(object, ids.analysisEngine) || undefined,
    timeControl: rawValueOf(object, ids.timeControl) || undefined,
    whiteMs: finiteOrUndefined(rawValueOf(object, ids.whiteMs)),
    blackMs: finiteOrUndefined(rawValueOf(object, ids.blackMs)),
    turnStartedAt: finiteOrUndefined(rawValueOf(object, ids.turnStartedAt)),
  }
}

// ---------------------------------------------------------------------------
// Derived state
// ---------------------------------------------------------------------------

/** The position as chess.js sees it. Throws on a FEN that is not a position at all. */
export function positionOf(game: Game): Chess {
  return new Chess(game.fen)
}

export function turnOf(game: Game): Seat {
  return positionOf(game).turn()
}

/** Which seat this user holds, if either. */
export function seatOf(game: Game, userId: string): Seat | undefined {
  if (game.white?.id === userId) return 'w'
  if (game.black?.id === userId) return 'b'
  return undefined
}

/** The empty seat, if there is one. A game with both seats filled has none. */
export function openSeat(game: Game): Seat | undefined {
  if (!game.white) return 'w'
  if (!game.black) return 'b'
  return undefined
}

export function isOver(game: Game): boolean {
  return game.result !== '*'
}

export function isCancelled(game: Game): boolean {
  // The attribute, not the workflow state: the state may not exist on this install at all.
  return game.cancelled || game.status === 'cancelled'
}

/** Still being played: not finished, not called off. */
export function isActive(game: Game): boolean {
  return !isOver(game) && !isCancelled(game)
}

/**
 * Waiting for a second person.
 *
 * A computer game also has an empty seat, and is not this: nobody is coming, and the game is already
 * under way. That is the distinction `opponent` exists to record.
 */
export function isWaitingForOpponent(game: Game): boolean {
  return game.opponent === 'human' && Boolean(openSeat(game)) && isActive(game)
}

/**
 * A coin flip for the seats.
 *
 * Injectable so a test is not at the mercy of the coin. The creator used to take White every time,
 * which meant one player never had to answer 1.e4 and the other never opened a game in their life.
 */
export function randomSeat(random: () => number = Math.random): Seat {
  return random() < 0.5 ? 'w' : 'b'
}

/**
 * What to call a game against the computer, given which seat the person took.
 *
 * White first, as a scoresheet is written — so a person playing Black reads "Computer vs Ada", not a
 * title that quietly implies they had the first move.
 */
export function computerGameTitle(personName: string, personSeat: Seat, level: number): string {
  const machine = `Computer (${level})`
  return personSeat === 'w' ? `${personName} vs ${machine}` : `${machine} vs ${personName}`
}

/** The seat the computer plays, for a computer game. */
export function computerSeat(game: Game): Seat | undefined {
  if (game.opponent !== 'computer') return undefined
  return game.white ? 'b' : 'w'
}

/** True when it is the computer's move and something should go and think. */
export function isComputerTurn(game: Game): boolean {
  const seat = computerSeat(game)
  return Boolean(seat) && isActive(game) && turnOf(game) === seat
}

export function isMyTurn(game: Game, userId: string): boolean {
  if (!isActive(game)) return false
  const seat = seatOf(game, userId)
  return Boolean(seat) && seat === turnOf(game)
}

export function opponentOf(game: Game, userId: string): Player | undefined {
  const seat = seatOf(game, userId)
  if (!seat) return undefined
  if (game.opponent === 'computer') {
    return { id: 'computer', name: `Computer${game.level ? ` (${game.level})` : ''}` }
  }
  return seat === 'w' ? game.black : game.white
}

/** The PGN result the position implies, or `*` while the game is still running. */
export function resultOf(position: Chess): GameResult {
  if (!position.isGameOver()) return '*'
  if (position.isCheckmate()) return position.turn() === 'w' ? '0-1' : '1-0'
  return '1/2-1/2'
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

/**
 * Does the stored position actually follow from the stored history?
 *
 * Nothing validates a move server-side: apps are frontend-only and the host writes whatever the
 * iframe asks using the player's own session. So a position is not trusted because it was stored —
 * it is trusted because it replays. Anyone can recompute this, which turns tampering from something
 * invisible into something the board refuses to draw.
 *
 * Detection, not prevention. Preventing it needs app-owned server code, which the platform does not
 * have yet.
 */
export function verifyHistory(game: Game): boolean {
  const replay = new Chess(START_FEN)
  for (const move of game.moves) {
    if (!playUci(replay, move)) return false
  }
  return replay.fen() === game.fen
}

/** UCI onto a position. False when the move is not legal there. */
function playUci(position: Chess, uci: string): boolean {
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const promotion = uci.slice(4, 5) || undefined
  try {
    return Boolean(position.move({ from, to, promotion }))
  } catch {
    // chess.js throws on an illegal move rather than returning null.
    return false
  }
}

// ---------------------------------------------------------------------------
// Moving
// ---------------------------------------------------------------------------

export type Move = { from: string; to: string; promotion?: string }

/** What a legal move changes about the game. The write is assembled from this, never guessed. */
export type MoveOutcome = {
  fen: string
  moves: string[]
  result: GameResult
  /** The move in algebraic notation, for the move list and toasts. */
  san: string
}

/**
 * Apply a move to a game, or `undefined` when it is not legal in this position.
 *
 * Pure: it computes the next values and writes nothing. The caller decides whether to persist them,
 * which is what lets the board show a move optimistically and still have one place that knows the
 * rules.
 */
export function applyMove(game: Game, move: Move): MoveOutcome | undefined {
  const position = positionOf(game)
  let uci: string
  let san: string
  try {
    const played = position.move(move)
    if (!played) return undefined
    san = played.san
    // Built from what chess.js actually played, not from what was asked. The board offers
    // `promotion: 'q'` on every drag because it cannot know in advance whether a move is a
    // promotion; echoing that back would record `e2e4q` and put non-standard UCI in the history
    // that every other chess tool — and phase 2's analysis — has to read.
    uci = `${played.from}${played.to}${played.promotion ?? ''}`
  } catch {
    return undefined
  }
  return {
    fen: position.fen(),
    moves: [...game.moves, uci],
    result: resultOf(position),
    san,
  }
}

/** The squares a piece on [square] may legally reach, for highlighting. */
export function legalTargets(game: Game, square: string): string[] {
  try {
    return positionOf(game)
      .moves({ square: square as Square, verbose: true })
      .map((move) => move.to)
  } catch {
    return []
  }
}

/**
 * Every position the game passed through, and the moves in algebraic notation.
 *
 * `fens[n]` is the position *before* ply `n`, so a game of N plies has N+1 positions — the last of
 * them the final position. That off-by-one is the whole basis of the review: a move's cost is the
 * difference between the evaluation of the position it was played in and the one it produced.
 */
export function replay(game: Game): { fens: string[]; sans: string[] } {
  const position = new Chess(START_FEN)
  const fens = [position.fen()]
  const sans: string[] = []
  for (const uci of game.moves) {
    try {
      const played = position.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || undefined,
      })
      if (!played) break
      sans.push(played.san)
      fens.push(position.fen())
    } catch {
      break
    }
  }
  return { fens, sans }
}

/**
 * Which squares to light up, and how brightly.
 *
 * The last two plies, not one. In a correspondence game you come back hours later and the question
 * is not only "what did they just play" but "what did I play before it" — and since moves alternate,
 * the last two plies are exactly one move from each side. The most recent is drawn strongest, the
 * way a single highlight would be, so nothing is lost for someone watching a game live.
 */
export function moveHighlights(moves: string[]): Record<string, 'latest' | 'previous'> {
  const squares: Record<string, 'latest' | 'previous'> = {}
  const mark = (uci: string | undefined, weight: 'latest' | 'previous') => {
    if (!uci || uci.length < 4) return
    // A square already claimed by the newer move keeps its brighter mark: the two moves can share a
    // square (a recapture is the ordinary case) and the recapture is the one you are looking for.
    for (const square of [uci.slice(0, 2), uci.slice(2, 4)]) {
      if (!squares[square]) squares[square] = weight
    }
  }
  mark(moves[moves.length - 1], 'latest')
  mark(moves[moves.length - 2], 'previous')
  return squares
}

/**
 * The result in the second person, for the player looking at it.
 *
 * A result is `1-0`; what a person wants to read is whether they won. A spectator — anyone who holds
 * neither seat — gets the objective version, since "you lost" would be news to them.
 */
export function resultHeadline(game: Game, userId: string): string {
  if (game.result === '*') return ''
  if (game.result === '1/2-1/2') return 'Draw'
  const winner: Seat = game.result === '1-0' ? 'w' : 'b'
  const seat = seatOf(game, userId)
  if (!seat) return winner === 'w' ? 'White wins' : 'Black wins'
  return seat === winner ? 'You won' : 'You lost'
}

/** What a badge says, and what colour it says it in. */
export type ResultTone = 'default' | 'success' | 'warning' | 'critical'

/**
 * A finished game's result, as a badge.
 *
 * `1-0` is the right thing to write in a PGN and the wrong thing to put in a list: it asks the
 * reader to remember which colour they were before they can tell whether they won. So the badge is
 * relative to whoever is looking — and only objective for somebody who played neither side, to whom
 * "Lost" would be news.
 */
export function resultBadge(
  game: Game,
  userId: string,
): { label: string; tone: ResultTone } | undefined {
  if (game.result === '*') return undefined
  if (game.result === '1/2-1/2') return { label: 'Draw', tone: 'default' }

  const winner: Seat = game.result === '1-0' ? 'w' : 'b'
  const seat = seatOf(game, userId)
  if (!seat) return { label: winner === 'w' ? 'White won' : 'Black won', tone: 'default' }
  return seat === winner ? { label: 'Won', tone: 'success' } : { label: 'Lost', tone: 'critical' }
}

/**
 * The game to pair with for [controlKey], if anybody is already waiting on one.
 *
 * [openGames] arrives newest-first, the order the lobby query returns, and the match taken is the
 * *last* of them — whoever has been waiting longest goes first, which is the only fair reading of a
 * queue and the one people expect from a "3 min" button.
 *
 * Defensive about what it is handed: the caller's list is already filtered, but a pairing decides
 * who somebody plays against and is not the place to rely on that staying true.
 */
export function pairingFor(
  openGames: Game[],
  controlKey: string,
  userId: string,
): Game | undefined {
  const matches = openGames.filter(
    (game) =>
      game.timeControl === controlKey &&
      game.opponent === 'human' &&
      isWaitingForOpponent(game) &&
      !seatOf(game, userId),
  )
  return matches[matches.length - 1]
}

/**
 * May this person call this game off?
 *
 * Only your own challenge, and only while nobody has taken the other seat. Once a game is under way
 * it is not yours alone to end — that is what resigning is for.
 */
export function canCancel(game: Game, userId: string): boolean {
  return isWaitingForOpponent(game) && Boolean(seatOf(game, userId))
}

/**
 * The one badge a game's row carries.
 *
 * One, not four: a row that can show several at once ends up showing two words for the same fact,
 * and the words have to be chosen against each other rather than in isolation. `Open` was the
 * casualty — it sat next to a button also labelled Open, meaning something else entirely.
 *
 * So the vocabulary here is deliberately parallel: **Your move** and **Their move** are the two
 * halves of one question, and a game nobody has joined says what it actually needs rather than
 * describing itself as open. Nothing is "running" in that state — that is the point of it.
 */
export function gameStatusBadge(
  game: Game,
  userId: string,
): { label: string; tone: ResultTone } | undefined {
  const result = resultBadge(game, userId)
  if (result) return result
  if (isCancelled(game)) return { label: 'Cancelled', tone: 'default' }
  if (isWaitingForOpponent(game)) return { label: 'Needs a player', tone: 'warning' }
  if (isMyTurn(game, userId)) return { label: 'Your move', tone: 'success' }
  if (seatOf(game, userId)) return { label: 'Their move', tone: 'default' }
  // A game between two other people, which the lobby can show but nobody is waiting on you for.
  return { label: turnOf(game) === 'w' ? 'White to move' : 'Black to move', tone: 'default' }
}

/** Why the game ended, in words, for a finished game. Empty while it runs. */
export function outcomeText(game: Game): string {
  if (!isOver(game)) return ''
  const position = positionOf(game)
  const winner = game.result === '1-0' ? 'White' : game.result === '0-1' ? 'Black' : undefined
  if (position.isCheckmate()) return `Checkmate — ${winner} wins`
  if (position.isStalemate()) return 'Draw by stalemate'
  if (position.isInsufficientMaterial()) return 'Draw — insufficient material'
  if (position.isThreefoldRepetition()) return 'Draw by repetition'
  if (position.isDraw()) return 'Draw'
  return winner ? `${winner} wins` : 'Game over'
}
