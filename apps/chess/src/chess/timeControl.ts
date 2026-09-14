/**
 * Clocks.
 *
 * **What this platform can and cannot do with them.** A chess clock wants a trusted time source and
 * an opponent's move the instant it happens. There is no server here to hold either: every move is
 * an HTTP write, and the other side learns about it on its next poll, one to three seconds later.
 * Correspondence controls do not care — a day is a day whether news of it arrives now or in three
 * seconds. Faster ones care a great deal, which is why bullet is not offered at all: a one-minute
 * game where a move arrives two seconds late is not a one-minute game. Blitz is kept and is still
 * the roughest thing here.
 *
 * The clock is also *cooperative*, for the same reason move legality is: the client whose turn it is
 * subtracts its own elapsed time, and either player's client may write the flag when it sees one.
 * Nothing enforces it. A determined player can lie about a clock exactly as they can lie about a
 * position — see `verifyHistory` for the same problem and the same answer.
 */

export type ControlCategory = 'blitz' | 'rapid' | 'daily'

export type TimeControl = {
  /** Stored on the object. `3+2` is three minutes plus two seconds; `3d` is three days a move. */
  key: string
  label: string
  category: ControlCategory
  initialMs: number
  /** Added to the mover's clock after each move. */
  incrementMs: number
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function live(minutes: number, incrementSeconds: number, category: ControlCategory): TimeControl {
  return {
    key: `${minutes}+${incrementSeconds}`,
    label: incrementSeconds ? `${minutes}+${incrementSeconds}` : `${minutes} min`,
    category,
    initialMs: minutes * MINUTE,
    incrementMs: incrementSeconds * SECOND,
  }
}

/**
 * A daily control is a budget per *move*, not for the whole game.
 *
 * That is what correspondence players mean by "three days a move", and it is also the only shape
 * that survives this platform: a whole-game budget would need a clock ticking accurately across a
 * week of nobody having the page open.
 */
function daily(days: number): TimeControl {
  return {
    key: `${days}d`,
    label: days === 1 ? '1 day' : `${days} days`,
    category: 'daily',
    initialMs: days * DAY,
    // The budget is restored each move, which an increment equal to the whole budget expresses
    // exactly: spend what you like of it, and the next move starts full again.
    incrementMs: days * DAY,
  }
}

export const TIME_CONTROLS: TimeControl[] = [
  live(3, 0, 'blitz'),
  live(3, 2, 'blitz'),
  live(5, 0, 'blitz'),
  live(10, 0, 'rapid'),
  live(15, 10, 'rapid'),
  live(30, 0, 'rapid'),
  daily(1),
  daily(3),
  daily(7),
]

export const DEFAULT_CONTROL = '10+0'

export const CATEGORY_LABEL: Record<ControlCategory, string> = {
  blitz: 'Blitz',
  rapid: 'Rapid',
  daily: 'Daily',
}

export function controlFor(key: string | undefined): TimeControl | undefined {
  return TIME_CONTROLS.find((control) => control.key === key)
}

export function controlsIn(category: ControlCategory): TimeControl[] {
  return TIME_CONTROLS.filter((control) => control.category === category)
}

/**
 * How often a game waiting for an opponent re-reads itself.
 *
 * The control's pace is about moves, and no move is coming: the only thing that can change is
 * somebody taking the seat. A one-minute game has no business polling once a second for an hour
 * while nobody is there — but the person staring at the screen waiting is owed better than five
 * seconds when it finally happens.
 */
export const WAITING_POLL_MS = 2500

/**
 * How often a game on this control should re-read itself.
 *
 * Fast games need fast news, and slow games must not cost a request every three seconds for a week.
 */
export function pollMsFor(control: TimeControl | undefined): number {
  switch (control?.category) {
    case 'blitz':
      return 1500
    case 'rapid':
      return 2500
    case 'daily':
      return 10_000
    default:
      return 3000
  }
}

/** How often the displayed clock redraws. Tenths matter under a minute; days do not. */
export function tickMsFor(control: TimeControl | undefined): number {
  return control?.category === 'daily' ? 30_000 : 200
}

/**
 * `2:05`, `9.4`, `1d 6h`.
 *
 * Tenths below twenty seconds, because that is when they start to matter; days and hours above an
 * hour, because `28:44:03` is not a number anybody reads.
 */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms)
  if (clamped >= DAY) {
    const days = Math.floor(clamped / DAY)
    const hours = Math.floor((clamped % DAY) / HOUR)
    return hours ? `${days}d ${hours}h` : `${days}d`
  }
  if (clamped >= HOUR) {
    const hours = Math.floor(clamped / HOUR)
    const minutes = Math.floor((clamped % HOUR) / MINUTE)
    return `${hours}h ${String(minutes).padStart(2, '0')}m`
  }
  if (clamped < 20 * SECOND) return (clamped / SECOND).toFixed(1)
  const minutes = Math.floor(clamped / MINUTE)
  const seconds = Math.floor((clamped % MINUTE) / SECOND)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export type ClockState = {
  whiteMs: number
  blackMs: number
  /** Which side's clock is running, or undefined when nothing is ticking. */
  running?: 'w' | 'b'
  /** Set when the running side is out of time. */
  flagged?: 'w' | 'b'
}

/**
 * What the clocks read now.
 *
 * [stored] is what the object holds — each side's remaining time as of the last move — and
 * [turnStartedAt] is when the side to move started thinking. Only the running side's clock moves,
 * which is the whole idea of a chess clock and also why the stored values need writing only once a
 * move rather than continuously.
 *
 * `now` is passed in rather than read, both so this can be tested and so the caller decides which
 * clock to trust.
 */
export function clockState(
  stored: { whiteMs: number; blackMs: number },
  turn: 'w' | 'b',
  turnStartedAt: number | undefined,
  now: number,
  running: boolean,
): ClockState {
  if (!running || turnStartedAt === undefined) {
    return { whiteMs: stored.whiteMs, blackMs: stored.blackMs }
  }
  // A clock that started in the future is a clock skew between two people's machines, not time
  // travel; treating it as zero elapsed is the reading that never invents time for either side.
  const elapsed = Math.max(0, now - turnStartedAt)
  const remaining = Math.max(0, (turn === 'w' ? stored.whiteMs : stored.blackMs) - elapsed)
  const state: ClockState = {
    whiteMs: turn === 'w' ? remaining : stored.whiteMs,
    blackMs: turn === 'b' ? remaining : stored.blackMs,
    running: turn,
  }
  if (remaining <= 0) state.flagged = turn
  return state
}

/**
 * The mover's clock after they have moved: what they had, less what they took, plus the increment.
 *
 * Capped at the control's initial time for a daily game, where the "increment" is the whole budget —
 * three days a move must not accumulate into a fortnight for someone who answers quickly.
 */
export function clockAfterMove(
  remainingMs: number,
  startedAt: number | undefined,
  now: number,
  control: TimeControl,
): number {
  const elapsed = startedAt === undefined ? 0 : Math.max(0, now - startedAt)
  const left = Math.max(0, remainingMs - elapsed)
  return Math.min(control.initialMs, left + control.incrementMs)
}
