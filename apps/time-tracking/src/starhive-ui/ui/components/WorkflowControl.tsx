import { Menu, Text, UnstyledButton } from '@mantine/core'
import {
  StateBadge,
  stateFor,
  type AttributeValueView,
  type AttributeView,
  type WorkflowStateView,
} from '@starhive/attributes'
import { useObjects, useToast, useTransitions } from '@starhive/bridge'
import { useState } from 'react'

export type WorkflowControlProps = {
  objectId: string
  /** The `WORKFLOW` attribute being moved. */
  attribute: AttributeView
  /** The object's current value for it, or undefined when it has no state yet. */
  value?: AttributeValueView
  /** Called with the state the object landed in, so a caller can show it without re-reading. */
  onMoved?: (stateId: string) => void
}

/**
 * An object's status, and the moves it can make from here.
 *
 * A `WORKFLOW` value is the one value that cannot simply be written: Starhive refuses a new state
 * that does not name the transition that reached it (`TRANSITION_NOT_SUPPLIED`), because the
 * transition is where the rules live. So this is always two steps — ask what is available, then write
 * the target state and the transition together in one update.
 *
 * **Transitions are fetched only when the menu opens.** The answer is per *object*, not per type: it
 * depends on the state this object is in and on conditions that can involve the current user. A table
 * of 200 rows would otherwise be 200 bridge calls just to draw itself. The badge needs no call at all
 * — the state's name comes off the value and its colour off the attribute's schema.
 */
export function WorkflowControl({ objectId, attribute, value, onMoved }: WorkflowControlProps) {
  const [opened, setOpened] = useState(false)
  // The state this control moved the object into, shown until the caller re-reads. Null while the
  // object still shows what it was read with.
  const [moved, setMoved] = useState<WorkflowStateView | null>(null)

  const state = moved ?? value?.state
  const color = moved ? moved.color : value ? stateFor(attribute, value)?.color : undefined
  const isEndState = moved ? moved.isEndState : value?.state?.isEndState

  return (
    <Menu opened={opened} onChange={setOpened} position="bottom-start" shadow="md" withinPortal>
      <Menu.Target>
        <UnstyledButton
          aria-label={state ? `Change status — currently ${state.name}` : 'Set status'}
        >
          {state ? (
            <StateBadge name={state.name} color={color} isEndState={isEndState} />
          ) : (
            <Text size="sm" c="dimmed">
              —
            </Text>
          )}
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {/* Mounted only while open — that is what makes the fetch lazy. */}
        {opened && (
          <TransitionItems
            objectId={objectId}
            attributeId={attribute.id}
            states={attribute.configuration?.states}
            onMoved={(stateId, landed) => {
              setOpened(false)
              // Only show the new state when the schema actually named it. Falling back to the
              // transition's name would put "Complete" where the status should read "Done".
              if (landed) setMoved(landed)
              onMoved?.(stateId)
            }}
          />
        )}
      </Menu.Dropdown>
    </Menu>
  )
}

function TransitionItems({
  objectId,
  attributeId,
  states,
  onMoved,
}: {
  objectId: string
  attributeId: string
  /** The workflow's states, off the attribute's schema — how a landed state gets its name. */
  states?: WorkflowStateView[]
  onMoved: (stateId: string, landed: WorkflowStateView | undefined) => void
}) {
  const { data, isLoading, error } = useTransitions(objectId, attributeId)
  const objects = useObjects()
  const toast = useToast()
  const [moving, setMoving] = useState(false)

  if (isLoading) return <Menu.Item disabled>Loading…</Menu.Item>
  if (error) return <Menu.Item disabled>Could not load moves.</Menu.Item>

  // A transition with a screen expects that screen's attributes in the same update, which this
  // control has no way to collect. A workflow provisioned from a manifest never has one, so this only
  // skips moves added in Starhive itself.
  const moves = (data?.transitions ?? []).filter((transition) => !transition.requiresScreen)

  if (moves.length === 0) return <Menu.Item disabled>No moves from here.</Menu.Item>

  return moves.map((move) => (
    <Menu.Item
      key={move.id}
      disabled={moving}
      onClick={async () => {
        setMoving(true)
        try {
          // The target state goes in `attributes`; the move that gets there goes in `transitions`.
          // One update, applied and validated together.
          await objects.update(objectId, [{ attributeId, values: [move.toStateId] }], {
            transitions: { [attributeId]: move.id },
          })
          // The state it landed in, not the move that got there: a transition called "Complete"
          // lands in a state called "Done", and the badge shows the state.
          onMoved(
            move.toStateId,
            states?.find((state) => state.id === move.toStateId),
          )
        } catch (caught) {
          // The message names the violation — condition not met, transition not found — so the user
          // is told why rather than "something went wrong".
          toast(caught instanceof Error ? caught.message : 'Could not change status', 'error')
        } finally {
          setMoving(false)
        }
      }}
    >
      {move.name}
    </Menu.Item>
  ))
}
