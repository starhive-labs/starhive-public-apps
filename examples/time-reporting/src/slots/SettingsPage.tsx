import { NumberInput, Stack, Text, Title } from '@mantine/core'
import { useConfig, useObjectQuery, useStarhiveContext, useToast, useTypes } from '@starhive/bridge'
import { Button, Card, Select } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import { readConfig, TIME_ENTRY_KEY, WORK_ITEM_KEY } from '../timeEntry'

/** Admin settings: which type the `workItem` reference targets + rounding. */
export function SettingsPage() {
  const { typeKeyToId } = useStarhiveContext()
  const { config, isLoading, setConfig } = useConfig()
  const { data: types, isLoading: typesLoading } = useTypes()
  // Any existing time log locks the work item type — changing it would orphan existing references.
  const { data: entries, isLoading: entriesLoading } = useObjectQuery('order by Created desc', {
    typeKey: TIME_ENTRY_KEY,
    limit: 1,
  })
  const toast = useToast()

  const defaultWorkItemTypeId = typeKeyToId[WORK_ITEM_KEY] ?? ''
  const [workItemType, setWorkItemType] = useState('')
  const [roundingMinutes, setRoundingMinutes] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    const parsed = readConfig(config)
    setWorkItemType(parsed.workItemType ?? defaultWorkItemTypeId)
    setRoundingMinutes(parsed.roundingMinutes)
  }, [config, isLoading, defaultWorkItemTypeId])

  const locked = (entries?.result.length ?? 0) > 0

  const typeOptions = useMemo(() => {
    const list = (types ?? []).map((type) => ({
      value: type.id,
      label: `${type.name}${type.id === defaultWorkItemTypeId ? ' (default)' : ''}`,
    }))
    // Keep the current selection visible even if it isn't in the fetched list (e.g. another space).
    if (workItemType && !list.some((type) => type.value === workItemType)) {
      list.unshift({ value: workItemType, label: `Selected type (${workItemType.slice(0, 8)}…)` })
    }
    return list
  }, [types, workItemType, defaultWorkItemTypeId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await setConfig({ workItemType, roundingMinutes })
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
        <Title order={3}>Time Reporting settings</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Time Reporting settings</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Work item type</Text>
          <Text size="sm" c="dimmed">
            Each time entry references an object of this type.
          </Text>
          <Select
            label="Type"
            data={typeOptions}
            value={workItemType || null}
            onChange={(next) => setWorkItemType(next ?? '')}
            disabled={locked || typesLoading || entriesLoading}
            allowDeselect={false}
          />
          {locked && (
            <Text size="sm" c="dimmed">
              The work item type can&rsquo;t be changed once time logs exist.
            </Text>
          )}
        </Stack>
      </Card>
      <Card>
        <NumberInput
          label="Rounding (minutes)"
          min={0}
          step={5}
          value={roundingMinutes}
          onChange={(value) => setRoundingMinutes(typeof value === 'number' ? value : 0)}
        />
      </Card>
      {error && (
        <Text size="sm" c="negative.6">
          {error}
        </Text>
      )}
      <Button onClick={save} variant="primary" loading={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </Stack>
  )
}
