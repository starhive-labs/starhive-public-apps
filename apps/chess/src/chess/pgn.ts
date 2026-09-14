/**
 * PGN export.
 *
 * A game already holds everything a PGN needs — players, result, full history — so this is a string
 * concat, not a feature. It is worth having on day one for two reasons: it is the interchange format
 * every other chess tool reads, and it hands players real engine analysis (via Lichess) long before
 * this app grows its own.
 */
import { Chess } from 'chess.js'

import { type Game, START_FEN } from './game'

/** The history in algebraic notation, replayed from the start. Stops at the first illegal move. */
export function sanMoves(game: Game): string[] {
  const position = new Chess(START_FEN)
  const san: string[] = []
  for (const uci of game.moves) {
    try {
      const played = position.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.slice(4, 5) || undefined,
      })
      if (!played) break
      san.push(played.san)
    } catch {
      break
    }
  }
  return san
}

/** `1. e4 e5 2. Nf3 Nc6` — the movetext, wrapped the way PGN readers expect. */
function movetext(san: string[], result: string): string {
  const tokens: string[] = []
  san.forEach((move, index) => {
    if (index % 2 === 0) tokens.push(`${index / 2 + 1}.`)
    tokens.push(move)
  })
  tokens.push(result)

  const lines: string[] = []
  let line = ''
  for (const token of tokens) {
    if (line && line.length + token.length + 1 > 80) {
      lines.push(line)
      line = ''
    }
    line = line ? `${line} ${token}` : token
  }
  if (line) lines.push(line)
  return lines.join('\n')
}

/** Escape a value for a PGN tag: quotes and backslashes are the only two that matter. */
function tag(name: string, value: string): string {
  return `[${name} "${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`
}

/**
 * The game as PGN, with the Seven Tag Roster.
 *
 * `Date` is the export date rather than the date played: a phase-1 game stores no timestamps of its
 * own, and `????.??.??` is the honest PGN for a date nobody recorded.
 */
export function toPgn(game: Game): string {
  const header = [
    tag('Event', game.title),
    tag('Site', 'Starhive'),
    tag('Date', '????.??.??'),
    tag('Round', '-'),
    tag('White', game.white?.name ?? '?'),
    tag('Black', game.black?.name ?? '?'),
    tag('Result', game.result),
  ].join('\n')

  return `${header}\n\n${movetext(sanMoves(game), game.result)}\n`
}

/**
 * Open this game in Lichess's analysis board.
 *
 * `connect-src 'self'` stops the app fetching anything, but it does not stop a navigation, and the
 * iframe sandbox already grants `allow-popups` — so a plain `target="_blank"` link works where
 * `fetch` would be blocked with no error. Until the app analyses games itself, this is the analysis
 * feature.
 */
export function lichessAnalysisUrl(game: Game): string {
  return `https://lichess.org/analysis/pgn/${encodeURIComponent(toPgn(game))}`
}
