/**
 * Starting a game: who against, and how strong.
 *
 * Two steps rather than one form, because the second question only exists for one answer to the
 * first — and because twenty level cards next to a "play a person" button reads as though the levels
 * applied to the person.
 *
 * Nobody names a game. A personal game is named after the people in it, which the app knows: the
 * creator's name now, and both names once somebody takes the seat (see `claim`). Names you type are
 * for tournaments, which do not exist yet.
 */
import { useStarhiveContext, useTheme, useToast } from '@starhive/bridge'
import { Button, Card } from '@starhive/ui'
import { Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { useState } from 'react'

import {
  computerGameTitle,
  type Game,
  type Opponent,
  pairingFor,
  randomSeat,
  seatOf,
} from '../chess/game'
import { DEFAULT_LEVEL, LEVELS, nameFor } from '../engine/levels'
import {
  CATEGORY_LABEL,
  type ControlCategory,
  controlsIn,
  type TimeControl,
} from '../chess/timeControl'
import { accent, CATEGORY_HUE, COMPUTER_HUE, levelHue, PERSON_HUE } from '../chess/palette'
import { ComputerIcon, PersonIcon } from './icons'
import { useGameActions } from '../useGame'

/** The side of the two opponent squares. */
const CHOICE_SIDE = 200

/** A Card that behaves like a button — keyboard included, since a Paper is not focusable. */
function ChoiceCard({
  onClick,
  children,
  square,
  hue,
  scheme,
}: {
  onClick: () => void
  children: React.ReactNode
  /** Fixed square, for the two opponent choices. Level cards stay as tall as their contents. */
  square?: boolean
  /** Tints the card. Undefined leaves it the plain surface. */
  hue?: number
  scheme?: 'light' | 'dark'
}) {
  const tint = hue === undefined ? undefined : accent(hue, scheme ?? 'light')
  // The button wrapper is a plain element on purpose: `Card` takes style props, not DOM ones, so the
  // interaction lives outside it and the Starhive surface stays exactly what it is elsewhere.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onClick()
        }
      }}
      className="chess-choice"
      style={{
        cursor: 'pointer',
        height: square ? CHOICE_SIDE : '100%',
        width: square ? CHOICE_SIDE : undefined,
      }}
    >
      <Card
        p="sm"
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: tint?.background,
          borderColor: tint?.border,
          color: tint?.foreground,
        }}
      >
        {children}
      </Card>
    </div>
  )
}

/**
 * The lift on hover.
 *
 * A style block rather than inline, because `:hover` has nowhere to live in a style attribute — and
 * the bundle CSP allows inline styles but no stylesheet of our own.
 */
function ChoiceStyles() {
  return (
    <style>{`
      .chess-choice > * { transition: transform 120ms ease, box-shadow 120ms ease; }
      .chess-choice:hover > * { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.14); }
      .chess-choice:active > * { transform: translateY(0); }
      .chess-choice:focus-visible > * { outline: 2px solid currentColor; outline-offset: 2px; }
    `}</style>
  )
}

export function NewGame({
  onCreated,
  openGames = [],
}: {
  onCreated: (gameId: string) => void
  /** Games already waiting for somebody, so picking a control can pair rather than pile up. */
  openGames?: Game[]
}) {
  const { user } = useStarhiveContext()
  const theme = useTheme()
  const scheme = theme.colorScheme
  const actions = useGameActions()
  const toast = useToast()

  const [choosingLevel, setChoosingLevel] = useState(false)
  const [choosingControl, setChoosingControl] = useState(false)
  const [creating, setCreating] = useState(false)

  /**
   * Picking a time control pairs you with somebody already waiting on it, and only makes a new game
   * when nobody is.
   *
   * This is what "3 min" means everywhere else, and without it two people who both want a three
   * minute game and both press the obvious button end up sitting in two separate empty lobbies
   * waiting for each other — which is exactly what happened.
   */
  async function playPerson(control: TimeControl) {
    setCreating(true)
    try {
      const waiting = pairingFor(openGames, control.key, user.id)
      if (waiting) {
        await actions.claim(waiting)
        // Read it back before believing it. Two people can press the same button at the same moment
        // and there is no lock; the loser of that race must not be told they joined a game they are
        // not in.
        const joined = await actions.read(waiting.id)
        const seat = joined && seatOf(joined, user.id)
        if (seat) {
          void toast(`Joined — you play ${seat === 'w' ? 'White' : 'Black'}`, 'success')
          onCreated(waiting.id)
          return
        }
      }
      create('human', undefined, control.key)
    } catch (failure) {
      void toast((failure as Error).message, 'error')
      setCreating(false)
    }
  }

  function create(opponent: Opponent, level?: number, timeControl?: string) {
    const me = user.name ?? 'Someone'
    // Drawn, not assigned. Against the computer this also means it sometimes opens — and the engine
    // moves on its own as soon as the board is on screen, because it is White's turn.
    const seat = randomSeat()
    setCreating(true)
    actions
      // There is no way to invite a particular person — the bridge cannot list users — so a human
      // game is an open seat rather than an invitation.
      .create({
        title:
          opponent === 'computer'
            ? computerGameTitle(me, seat, level ?? DEFAULT_LEVEL)
            : `${me}'s game`,
        seat,
        opponent,
        level,
        timeControl,
      })
      .then((id) => {
        // The board is about to open from this side, but say it out loud: which colour you drew is
        // the first thing you want to know and the last thing you should have to infer.
        void toast(`You play ${seat === 'w' ? 'White' : 'Black'}`, 'info')
        onCreated(id)
      })
      .catch((failure: Error) => toast(failure.message, 'error'))
      .finally(() => setCreating(false))
  }

  if (choosingControl) {
    return (
      <Stack gap="sm">
        <ChoiceStyles />
        <Group justify="space-between" align="center">
          <Text fw={600}>How long?</Text>
          <Button variant="quiet" onClick={() => setChoosingControl(false)}>
            ← Back
          </Button>
        </Group>
        {(['blitz', 'rapid', 'daily'] as ControlCategory[]).map((category) => (
          <Stack key={category} gap={4}>
            <Text size="sm" fw={600}>
              {CATEGORY_LABEL[category]}
            </Text>
            <Group gap="xs">
              {controlsIn(category).map((control) => (
                <ChoiceCard
                  key={control.key}
                  hue={CATEGORY_HUE[category]}
                  scheme={scheme}
                  onClick={() => {
                    if (!creating) void playPerson(control)
                  }}
                >
                  <Stack gap={0} align="center" style={{ minWidth: 76 }}>
                    <Text fw={700}>{control.label}</Text>
                  </Stack>
                </ChoiceCard>
              ))}
            </Group>
          </Stack>
        ))}
      </Stack>
    )
  }

  if (choosingLevel) {
    return (
      <Stack gap="sm">
        <ChoiceStyles />
        <Group justify="space-between" align="center">
          <Text fw={600}>How strong?</Text>
          <Button variant="quiet" onClick={() => setChoosingLevel(false)}>
            ← Back
          </Button>
        </Group>
        <Text size="xs" c="dimmed">
          Stockfish runs in your browser, and every level searches it the same way. What changes is
          how much a level gives away when it chooses — tuned so each rung loses about what a player
          of that rating loses per move. It answers in well under a second either way.
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="xs">
          {LEVELS.map((level) => (
            <ChoiceCard
              key={level}
              hue={levelHue(level)}
              scheme={scheme}
              onClick={() => !creating && create('computer', level)}
            >
              <Stack gap={2} align="center">
                <Text fw={700} size="lg">
                  {level}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  {nameFor(level)}
                </Text>
              </Stack>
            </ChoiceCard>
          ))}
        </SimpleGrid>
      </Stack>
    )
  }

  return (
    <Stack gap="md" align="center">
      <ChoiceStyles />
      <Group gap="md" wrap="wrap" justify="center">
        <ChoiceCard
          square
          hue={PERSON_HUE}
          scheme={scheme}
          onClick={() => setChoosingControl(true)}
        >
          <Stack gap="sm" align="center">
            <PersonIcon size={40} />
            <Text fw={600}>Play a person</Text>
          </Stack>
        </ChoiceCard>
        <ChoiceCard
          square
          hue={COMPUTER_HUE}
          scheme={scheme}
          onClick={() => setChoosingLevel(true)}
        >
          <Stack gap="sm" align="center">
            <ComputerIcon size={40} />
            <Text fw={600}>Play the computer</Text>
          </Stack>
        </ChoiceCard>
      </Group>
      {creating && (
        <Text size="sm" c="dimmed">
          Creating…
        </Text>
      )}
    </Stack>
  )
}
