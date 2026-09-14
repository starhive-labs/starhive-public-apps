import { NumberInput, Stack, Text, Title } from '@mantine/core'
import { useConfig, useObjectQuery, useStarhiveContext, useToast, useTypes } from '@starhive/bridge'
import { Button, Card, Select } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import { NEW_HIRE_KEY, readConfig, TASK_KEY } from '../onboarding'

/** Admin settings: which type the `newHire` reference targets + the default due window. */
export function SettingsPage() {
  const { typeKeyToId } = useStarhiveContext()
  const { config, isLoading, setConfig } = useConfig()
  const { data: types, isLoading: typesLoading } = useTypes()
  // Any existing task locks the new-hire type — changing it would orphan existing references.
  const { data: tasks, isLoading: tasksLoading } = useObjectQuery('order by Created desc', {
    typeKey: TASK_KEY,
    limit: 1,
  })
  const toast = useToast()

  const defaultNewHireTypeId = typeKeyToId[NEW_HIRE_KEY] ?? ''
  const [newHireType, setNewHireType] = useState('')
  const [defaultDueDays, setDefaultDueDays] = useState(7)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    const parsed = readConfig(config)
    setNewHireType(parsed.newHireType ?? defaultNewHireTypeId)
    setDefaultDueDays(parsed.defaultDueDays)
  }, [config, isLoading, defaultNewHireTypeId])

  const locked = (tasks?.result.length ?? 0) > 0

  const typeOptions = useMemo(() => {
    const list = (types ?? []).map((type) => ({
      value: type.id,
      label: `${type.name}${type.id === defaultNewHireTypeId ? ' (default)' : ''}`,
    }))
    // Keep the current selection visible even if it isn't in the fetched list (e.g. another space).
    if (newHireType && !list.some((type) => type.value === newHireType)) {
      list.unshift({ value: newHireType, label: `Selected type (${newHireType.slice(0, 8)}…)` })
    }
    return list
  }, [types, newHireType, defaultNewHireTypeId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await setConfig({ newHireType, defaultDueDays })
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
        <Title order={3}>Employee Onboarding settings</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Employee Onboarding settings</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>New hire type</Text>
          <Text size="sm" c="dimmed">
            Each onboarding task references an object of this type.
          </Text>
          <Select
            label="Type"
            data={typeOptions}
            value={newHireType || null}
            onChange={(next) => setNewHireType(next ?? '')}
            disabled={locked || typesLoading || tasksLoading}
            allowDeselect={false}
          />
          {locked && (
            <Text size="sm" c="dimmed">
              The new hire type can&rsquo;t be changed once tasks exist.
            </Text>
          )}
        </Stack>
      </Card>
      <Card>
        <NumberInput
          label="Default due in (days)"
          min={0}
          step={1}
          value={defaultDueDays}
          onChange={(value) => setDefaultDueDays(typeof value === 'number' ? value : 0)}
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
