/**
 * The app's home.
 *
 * Three tabs rather than one long column: starting a game, games you are in, and challenges going
 * begging are three different errands, and the one people arrive for is the first.
 */
import { Button, Card } from '@starhive/ui'
import { Center, Group, Stack, Tabs, Text } from '@mantine/core'
import { useState } from 'react'

import { Board } from '../components/Board'
import { EmptyState } from '../components/EmptyState'
import { GameSection, useGames } from '../components/GameList'
import { BoardIcon, HistoryIcon } from '../components/icons'
import { NewGame } from '../components/NewGame'
import { useGameType } from '../useGame'

/** A tab label that carries its count, so the badge and the word cannot disagree. */
function label(text: string, count: number): string {
  return count > 0 ? `${text} (${count})` : text
}

export function GlobalPage() {
  const { incomplete } = useGameType()
  const { buckets, isLoading, refetch, forget } = useGames()
  const [openGameId, setOpenGameId] = useState<string | undefined>(undefined)
  /**
   * Controlled, so leaving a board returns somewhere deliberate.
   *
   * An uncontrolled `Tabs` resets to its default every time this component swaps between the board
   * and the tabs — which is why "← All games" landed on the new-game screen instead of a list of
   * games, whatever it said on the button.
   */
  const [tab, setTab] = useState<string | null>('play')

  if (incomplete) {
    return (
      <Card>
        <Text size="sm">
          This install is missing some of the Chess app&apos;s attributes. Updating to the current
          version provisions them — new attributes are added to the existing type, so nothing you
          have played is lost.
        </Text>
      </Card>
    )
  }

  function close() {
    setOpenGameId(undefined)
    // Always the list, never back to the chooser: leaving a game — especially one that has just
    // ended — means going to look at your games.
    setTab('mine')
    refetch()
  }

  if (openGameId) {
    return (
      <Stack gap="md" p="md">
        <Group>
          <Button variant="quiet" onClick={() => close()}>
            ← Your games
          </Button>
        </Group>
        {/* The page is the one place with room for a proper board. */}
        <Board gameId={openGameId} maxBoard={720} onExit={close} onCancelled={forget} />
      </Stack>
    )
  }

  const mine = buckets.yourMove.length + buckets.waiting.length + buckets.myOpen.length

  return (
    <Tabs value={tab} onChange={setTab} p="md" keepMounted={false}>
      <Tabs.List>
        {/* No count here on purpose: this tab is where a game is started, never a list of work
            waiting on you. The badge belongs where the waiting is. */}
        <Tabs.Tab value="play">Play a game</Tabs.Tab>
        <Tabs.Tab value="mine">{label('Your games', buckets.yourMove.length)}</Tabs.Tab>
        <Tabs.Tab value="history">History</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="play" pt="md">
        <Stack gap="xl">
          {/* No heading and no card around it: the two choices are the whole screen. Opening the new
              game rather than returning to a list, because it is not in the search index yet. */}
          <Center mih={260}>
            <NewGame onCreated={setOpenGameId} openGames={buckets.open} />
          </Center>
          {/* Only when there is something to take. Picking a time control already pairs you with
              whoever is waiting, so this is a shortcut to a particular game, not the way in. */}
          <GameSection
            title="Or take an open seat"
            games={buckets.open}
            onOpen={setOpenGameId}
            onCancelled={forget}
          />
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="mine" pt="md">
        <Stack gap="lg">
          {isLoading && <Text size="sm">Loading your games…</Text>}
          {/* One list, not two: whose turn it is belongs on the row — which already says so — not in
              a heading that splits your games in half. Yours-to-move sort first. */}
          <GameSection
            title="In play"
            games={[...buckets.yourMove, ...buckets.waiting]}
            onOpen={setOpenGameId}
          />
          <GameSection
            title="Waiting for an opponent"
            games={buckets.myOpen}
            onOpen={setOpenGameId}
            onCancelled={forget}
          />
          {!isLoading && mine === 0 && (
            <EmptyState
              icon={<BoardIcon />}
              title="No games on the go"
              description="Start one and you'll be paired with anyone already waiting on that time control — or play the computer and begin straight away."
              actionLabel="Play a game"
              onAction={() => setTab('play')}
            />
          )}
        </Stack>
      </Tabs.Panel>

      <Tabs.Panel value="history" pt="md">
        <Stack gap="lg">
          {isLoading && <Text size="sm">Loading…</Text>}
          <GameSection title="Finished" games={buckets.finished} onOpen={setOpenGameId} />
          {!isLoading && buckets.finished.length === 0 && (
            <EmptyState
              icon={<HistoryIcon />}
              title="Nothing finished yet"
              description="Games you have played end up here, each one reviewable move by move with an evaluation bar."
              actionLabel="Play a game"
              onAction={() => setTab('play')}
            />
          )}
        </Stack>
      </Tabs.Panel>
    </Tabs>
  )
}
