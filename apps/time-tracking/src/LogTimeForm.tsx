import { Group, Stack, Text, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  useAttributes,
  useConfig,
  useObjects,
  useStarhiveContext,
  useToast,
} from '@starhive/bridge'
import { Button } from '@starhive/ui'
import dayjs from 'dayjs'
import { type FormEvent, useState } from 'react'

import {
  ATTR,
  entrySummary,
  formatHours,
  hoursToStored,
  type LoggedAgainst,
  localDateIso,
  MAX_HOURS_PER_ENTRY,
  parseDuration,
  readConfig,
  roundHours,
  TIME_ENTRY_KEY,
} from './timeEntry'
import { WorkItemPicker } from './WorkItemPicker'

/**
 * Log time.
 *
 * Three questions — how long, which day, what on — and the person is not one of them: an entry is
 * always the signed-in user's own, written from `context.user`. Nobody logs time for somebody else
 * here, which is what makes "who logged what" trustworthy.
 *
 * The duration is typed, not picked: `1h 30m`, `1:30` and `1.5` all mean the same thing and people
 * arrive with one of them in their head. What was understood is echoed under the field before the
 * button is pressed.
 *
 * With `workItem` given (the Time tab) the object is fixed and its name is the live one the panel
 * read. Without it (the app page) one is picked from any nominated type.
 */
export function LogTimeForm({
  workItem,
  onLogged,
}: {
  /** The object to log against. Omitted on a screen that asks which. */
  workItem?: LoggedAgainst
  onLogged?: () => void
}) {
  const { user } = useStarhiveContext()
  const { config } = useConfig()
  const { roundingMinutes } = readConfig(config)
  const objects = useObjects()
  const toast = useToast()

  const fields = useAttributes(TIME_ENTRY_KEY, [
    ATTR.summary,
    ATTR.workItemId,
    ATTR.workItemLabel,
    ATTR.workItemTypeId,
    ATTR.loggedBy,
    ATTR.date,
    ATTR.hours,
    ATTR.description,
  ])
  const idOf = (key: string) => fields.data.find((field) => field.key === key)?.id

  const [duration, setDuration] = useState('')
  const [date, setDate] = useState<Date | null>(() => new Date())
  const [description, setDescription] = useState('')
  const [picked, setPicked] = useState<LoggedAgainst | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseDuration(duration)
  const rounded = parsed === null ? null : roundHours(parsed, roundingMinutes)
  const preview =
    duration.trim() === ''
      ? null
      : parsed === null
        ? 'Try 1h 30m, 1:30 or 1.5'
        : rounded !== null && Math.abs(rounded - parsed) > 1e-9
          ? `${formatHours(parsed)}, rounded to ${formatHours(rounded)}`
          : formatHours(parsed)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const target = workItem ?? picked
    if (!target) return setError('Pick what the time was spent on')
    if (rounded === null) return setError('Enter how long — 1h 30m, 1:30 or 1.5')
    if (rounded > MAX_HOURS_PER_ENTRY)
      return setError(`One entry can hold at most ${MAX_HOURS_PER_ENTRY} hours`)
    if (!date) return setError('Pick a day')

    const ids = {
      summary: idOf(ATTR.summary),
      workItemId: idOf(ATTR.workItemId),
      workItemLabel: idOf(ATTR.workItemLabel),
      workItemTypeId: idOf(ATTR.workItemTypeId),
      loggedBy: idOf(ATTR.loggedBy),
      date: idOf(ATTR.date),
      hours: idOf(ATTR.hours),
      description: idOf(ATTR.description),
    }
    if (
      !ids.summary ||
      !ids.workItemId ||
      !ids.workItemLabel ||
      !ids.loggedBy ||
      !ids.date ||
      !ids.hours
    ) {
      return setError('The Time Entry type is missing an attribute — reinstall the app')
    }

    const dateIso = localDateIso(date)
    const note = description.trim()
    setSubmitting(true)
    try {
      await objects.create(TIME_ENTRY_KEY, [
        {
          attributeId: ids.summary,
          values: [
            entrySummary({ hours: rounded, dateIso, userName: user.name, description: note }),
          ],
        },
        { attributeId: ids.workItemId, values: [target.id] },
        // Written every time, so the name a report shows is the one the object had at the most
        // recent log against it rather than the one it had the first time anybody logged.
        { attributeId: ids.workItemLabel, values: [target.label] },
        ...(target.typeId && ids.workItemTypeId
          ? [{ attributeId: ids.workItemTypeId, values: [target.typeId] }]
          : []),
        { attributeId: ids.loggedBy, values: [user.id] },
        { attributeId: ids.date, values: [dateIso] },
        { attributeId: ids.hours, values: [hoursToStored(rounded)] },
        ...(note && ids.description ? [{ attributeId: ids.description, values: [note] }] : []),
      ])
      toast(`Logged ${formatHours(rounded)}`, 'success')
      setDuration('')
      setDescription('')
      onLogged?.()
    } catch (caught) {
      // The API's message names the violation, which is more use than "could not log".
      setError(caught instanceof Error ? caught.message : 'Could not log time')
    } finally {
      setSubmitting(false)
    }
  }

  if (fields.isLoading) {
    return (
      <Text size="sm" c="dimmed">
        Loading…
      </Text>
    )
  }

  return (
    <form onSubmit={submit}>
      <Stack gap="sm">
        {!workItem && <WorkItemPicker value={picked} onChange={setPicked} disabled={submitting} />}
        <Group gap="sm" align="flex-start" grow>
          <TextInput
            label="Duration"
            placeholder="1h 30m"
            value={duration}
            onChange={(event) => setDuration(event.currentTarget.value)}
            /*
             * What we understood, under the box rather than over it.
             *
             * Mantine's default order puts the description between the label and the input, so this
             * line appearing as you type pushed the box down and left it sitting lower than the Day
             * picker beside it. Below the input, the two fields keep their tops level whatever this
             * says. The non-breaking space holds the line's height while the field is empty, so the
             * fields underneath don't jump on the first keystroke either.
             */
            inputWrapperOrder={['label', 'input', 'description', 'error']}
            description={preview ?? ' '}
            error={duration.trim() !== '' && parsed === null ? true : undefined}
            disabled={submitting}
            autoComplete="off"
            data-autofocus
          />
          <DatePickerInput
            label="Day"
            value={date}
            onChange={setDate}
            valueFormat="ll"
            maxDate={dayjs().add(1, 'day').toDate()}
            disabled={submitting}
          />
        </Group>
        <TextInput
          label="What did you work on?"
          placeholder="Optional"
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          disabled={submitting}
        />
        {error && (
          <Text size="sm" c="negative.6">
            {error}
          </Text>
        )}
        <Group justify="flex-end">
          <Button type="submit" variant="primary" loading={submitting}>
            Log time
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
