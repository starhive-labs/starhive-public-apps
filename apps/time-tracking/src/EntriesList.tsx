import { ActionIcon, Avatar, Box, Divider, Group, Menu, Stack, Table, Text } from '@mantine/core'
import { useObjects, useToast } from '@starhive/bridge'
import { formatDate } from '@starhive/ui'
import { type ReactNode, useState } from 'react'

import type { Entry } from './report'
import { formatHours } from './timeEntry'
import { useContainerWidth } from './useContainerWidth'

/**
 * Below this many pixels the table becomes a list.
 *
 * Five columns need roughly this much before the last of them starts being cut off. An object's
 * detail panel is around 260px wide, so the panel is always the list and a full-width page is
 * always the table — the threshold only decides what happens to the sizes in between.
 */
export const NARROW_WIDTH = 520

/**
 * The entries themselves — who, when, how long, on what.
 *
 * Presentational: the screen owns the fetch (its summaries are computed from the same rows), and
 * this draws them. A person may delete their own entries and nobody else's; the host would refuse
 * a write the viewer lacks permission for anyway, but a button that fails on press is worse than no
 * button, so only the author sees one.
 *
 * **Two layouts, chosen by the room available.** The same component is a full-width table on the app
 * page and a stacked list in an object's detail panel, where a table's later columns were simply cut
 * off at the card's edge — the hours, which is the one number the panel exists to show. Nothing about
 * the frame says which it is, so the container is measured; see `useContainerWidth`.
 */
export function EntriesList({
  entries,
  isLoading,
  error,
  showWorkItem = false,
  currentUserId,
  onDeleted,
  emptyMessage = 'No time logged yet.',
}: {
  entries: Entry[]
  isLoading: boolean
  error: Error | null
  /** Name the work item — for a list that spans more than one object. */
  showWorkItem?: boolean
  currentUserId: string
  /** Called with the id after a successful delete, so the owner of the rows can forget it. */
  onDeleted?: (id: string) => void
  emptyMessage?: string
}) {
  const [ref, width] = useContainerWidth<HTMLDivElement>()
  // Until the first measurement lands there is nothing to choose between; the list is the safer
  // guess, since it reads correctly at any width and the table does not.
  const narrow = width === 0 || width < NARROW_WIDTH

  let body: ReactNode
  if (isLoading && entries.length === 0) {
    body = (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  } else if (error) {
    body = (
      <Text size="sm" c="negative.6">
        {error.message}
      </Text>
    )
  } else if (entries.length === 0) {
    body = (
      <Text size="sm" c="dimmed">
        {emptyMessage}
      </Text>
    )
  } else if (narrow) {
    body = (
      <Stack gap={0}>
        {entries.map((entry, index) => (
          <Box key={entry.id}>
            {index > 0 && <Divider my="xs" />}
            <EntryRow
              entry={entry}
              showWorkItem={showWorkItem}
              currentUserId={currentUserId}
              onDeleted={onDeleted}
            />
          </Box>
        ))}
      </Stack>
    )
  } else {
    body = (
      <Table striped highlightOnHover verticalSpacing="xs" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Day</Table.Th>
            <Table.Th>Who</Table.Th>
            <Table.Th style={{ textAlign: 'right' }}>Time</Table.Th>
            {showWorkItem && <Table.Th>Work item</Table.Th>}
            <Table.Th>Description</Table.Th>
            <Table.Th aria-label="Actions" w={40} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {entries.map((entry) => (
            <Table.Tr key={entry.id}>
              <Table.Td style={{ whiteSpace: 'nowrap' }}>
                {formatDate(entry.date, { short: true })}
              </Table.Td>
              <Table.Td>
                <Group gap={6} wrap="nowrap">
                  <PersonAvatar name={entry.user.name} />
                  <Text size="sm" truncate title={entry.user.name}>
                    {entry.user.name}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td
                style={{
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatHours(entry.hours)}
              </Table.Td>
              {showWorkItem && (
                <Table.Td>
                  <Text size="sm" truncate maw={220} title={entry.workItem.label}>
                    {entry.workItem.label}
                  </Text>
                </Table.Td>
              )}
              <Table.Td>
                <Text size="sm" c={entry.description ? undefined : 'dimmed'} lineClamp={2}>
                  {entry.description ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                {entry.user.id === currentUserId && (
                  <EntryMenu entry={entry} onDeleted={onDeleted} />
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    )
  }

  return <div ref={ref}>{body}</div>
}

/**
 * One entry, stacked for a narrow column.
 *
 * Who and how long on the first line, because those are what the panel is read for; everything else
 * on a dimmed second line, joined by separators so that an entry with no description does not leave
 * a gap where one would have been.
 */
function EntryRow({
  entry,
  showWorkItem,
  currentUserId,
  onDeleted,
}: {
  entry: Entry
  showWorkItem: boolean
  currentUserId: string
  onDeleted?: (id: string) => void
}) {
  const meta = [
    formatDate(entry.date, { short: true }),
    ...(showWorkItem ? [entry.workItem.label] : []),
    ...(entry.description ? [entry.description] : []),
  ].join(' · ')

  return (
    <Stack gap={2}>
      <Group gap="xs" wrap="nowrap" align="center">
        <PersonAvatar name={entry.user.name} />
        <Text size="sm" truncate style={{ flex: 1, minWidth: 0 }} title={entry.user.name}>
          {entry.user.name}
        </Text>
        <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
          {formatHours(entry.hours)}
        </Text>
        {entry.user.id === currentUserId && <EntryMenu entry={entry} onDeleted={onDeleted} />}
      </Group>
      <Text size="xs" c="dimmed" lineClamp={2} title={meta}>
        {meta}
      </Text>
    </Stack>
  )
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <Avatar size={20} radius="xl" color="primary" variant="light">
      <Text fz={10} fw={600}>
        {initialsOf(name)}
      </Text>
    </Avatar>
  )
}

/** The row's actions. One item, behind a menu, so a stray click cannot delete an hour of work. */
function EntryMenu({ entry, onDeleted }: { entry: Entry; onDeleted?: (id: string) => void }) {
  const objects = useObjects()
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)

  async function remove() {
    setDeleting(true)
    try {
      await objects.remove(entry.id)
      toast(`Deleted ${formatHours(entry.hours)}`, 'success')
      onDeleted?.(entry.id)
    } catch (caught) {
      toast(caught instanceof Error ? caught.message : 'Could not delete the entry', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          variant="subtle"
          color="neutral"
          size="sm"
          loading={deleting}
          aria-label="Entry actions"
        >
          ⋯
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item color="negative" onClick={remove}>
          Delete entry
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

/** Up to two initials from a name; `?` when there is nothing to take them from. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const [first, last] = [parts[0], parts[parts.length - 1]]
  const initials = parts.length === 1 ? first.slice(0, 2) : `${first[0]}${last[0]}`
  return initials.toUpperCase()
}
