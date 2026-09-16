import { MultiSelect, NumberInput, Stack, Text, Title } from '@mantine/core'
import { useConfig, useStarhiveContext, useToast, useTypes } from '@starhive/bridge'
import { Button, Card } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import { readConfig, WORK_ITEM_KEY } from '../timeEntry'

/** Admin settings: which types time is logged on, and how durations are rounded. */
export function SettingsPage() {
  const { typeKeyToId } = useStarhiveContext()
  const { config, isLoading, setConfig } = useConfig()
  const { data: types, isLoading: typesLoading } = useTypes()
  const toast = useToast()

  const defaultWorkItemTypeId = typeKeyToId[WORK_ITEM_KEY] ?? ''
  const [workItemTypes, setWorkItemTypes] = useState<string[]>([])
  const [roundingMinutes, setRoundingMinutes] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * Show what is saved, and nothing else.
   *
   * There is deliberately no "fall back to the app's own type when the list is empty" here, though
   * it reads as a helpful default: the effect re-runs when `setConfig` updates `config`, so an admin
   * who cleared the list and saved watched the type they had just removed reappear in the field —
   * and saving again would write it back into the install. It also made the empty-list warning below
   * unreachable. The manifest's `default` is seeded into the install at provisioning, which is where
   * a default belongs; by the time this page loads, a fresh install already says so.
   */
  useEffect(() => {
    if (isLoading) return
    const parsed = readConfig(config)
    setWorkItemTypes(parsed.workItemTypes)
    setRoundingMinutes(parsed.roundingMinutes)
  }, [config, isLoading])

  const typeOptions = useMemo(() => {
    const list = types.map((type) => ({
      value: type.id,
      label: `${type.name}${type.id === defaultWorkItemTypeId ? ' (this app’s own)' : ''}`,
    }))
    // Keep a current selection visible even if it isn't in the fetched list (e.g. another space).
    for (const selected of workItemTypes) {
      if (!list.some((type) => type.value === selected)) {
        list.unshift({ value: selected, label: `Selected type (${selected.slice(0, 8)}…)` })
      }
    }
    return list
  }, [types, workItemTypes, defaultWorkItemTypeId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await setConfig({ workItemTypes, roundingMinutes })
      toast('Settings saved', 'success')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Stack gap="md" p="lg">
        <Title order={3}>Time Tracking settings</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Time Tracking settings</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Work item types</Text>
          <Text size="sm" c="dimmed">
            The types time is logged on. A <b>Time</b> tab appears on every object of these types,
            and on objects of the types that extend them. Pick as many as you like — a project type
            and a ticket type need nothing in common.
          </Text>
          <MultiSelect
            label="Types"
            placeholder={workItemTypes.length === 0 ? 'Pick one or more types' : undefined}
            data={typeOptions}
            value={workItemTypes}
            onChange={setWorkItemTypes}
            disabled={typesLoading}
            searchable
            clearable
          />
          {/*
            Nothing locks here, unlike a setting that a REFERENCE hangs off: an entry stores the id
            of the object it was logged against, which belongs to no type as far as this app's data
            model is concerned. So the list decides where the tab appears and what the app may read,
            and never invalidates anything already written.
          */}
          <Text size="sm" c="dimmed">
            Safe to change at any time. Time already logged keeps its object and stays in the
            reports; removing a type only stops the tab being offered on it.
          </Text>
          {workItemTypes.length === 0 && (
            <Text size="sm" c="warning.6">
              With no types picked, the Time tab appears nowhere and nothing can be logged.
            </Text>
          )}
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Rounding</Text>
          <Text size="sm" c="dimmed">
            Round every logged duration to a number of minutes. 0 keeps what was typed; 15 turns 1h
            10m into 1h 15m.
          </Text>
          <NumberInput
            label="Round to (minutes)"
            min={0}
            max={60}
            step={5}
            value={roundingMinutes}
            onChange={(value) => setRoundingMinutes(typeof value === 'number' ? value : 0)}
            w={200}
          />
        </Stack>
      </Card>
      {error && (
        <Text size="sm" c="negative.6">
          {error}
        </Text>
      )}
      <Button onClick={save} variant="primary" loading={saving} w="fit-content">
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </Stack>
  )
}
