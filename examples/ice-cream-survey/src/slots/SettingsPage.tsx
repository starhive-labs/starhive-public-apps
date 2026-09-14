import { NumberInput, Stack, Text, Title } from '@mantine/core'
import { useConfig, useObjectQuery, useStarhiveContext, useToast, useTypes } from '@starhive/bridge'
import { Button, Card, Select } from '@starhive/ui'
import { useEffect, useMemo, useState } from 'react'

import { FLAVOR_KEY, readConfig, RESPONSE_KEY } from '../survey'

/** Admin settings: which type the `flavor` reference targets + the star scale. */
export function SettingsPage() {
  const { typeKeyToId } = useStarhiveContext()
  const { config, isLoading, setConfig } = useConfig()
  const { data: types, isLoading: typesLoading } = useTypes()
  // Any existing response locks the flavor type — changing it would orphan existing references.
  const { data: responses, isLoading: responsesLoading } = useObjectQuery('order by Created desc', {
    typeKey: RESPONSE_KEY,
    limit: 1,
  })
  const toast = useToast()

  const defaultFlavorTypeId = typeKeyToId[FLAVOR_KEY] ?? ''
  const [flavorType, setFlavorType] = useState('')
  const [maxRating, setMaxRating] = useState(5)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoading) return
    const parsed = readConfig(config)
    setFlavorType(parsed.flavorType ?? defaultFlavorTypeId)
    setMaxRating(parsed.maxRating)
  }, [config, isLoading, defaultFlavorTypeId])

  const locked = (responses?.result.length ?? 0) > 0

  const typeOptions = useMemo(() => {
    const list = (types ?? []).map((type) => ({
      value: type.id,
      label: `${type.name}${type.id === defaultFlavorTypeId ? ' (default)' : ''}`,
    }))
    // Keep the current selection visible even if it isn't in the fetched list (e.g. another space).
    if (flavorType && !list.some((type) => type.value === flavorType)) {
      list.unshift({ value: flavorType, label: `Selected type (${flavorType.slice(0, 8)}…)` })
    }
    return list
  }, [types, flavorType, defaultFlavorTypeId])

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await setConfig({ flavorType, maxRating })
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
        <Title order={3}>Ice Cream Survey settings</Title>
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      </Stack>
    )
  }

  return (
    <Stack gap="md" p="lg">
      <Title order={3}>Ice Cream Survey settings</Title>
      <Card>
        <Stack gap="sm">
          <Text fw={600}>Flavor type</Text>
          <Text size="sm" c="dimmed">
            Each rating references an object of this type.
          </Text>
          <Select
            label="Type"
            data={typeOptions}
            value={flavorType || null}
            onChange={(next) => setFlavorType(next ?? '')}
            disabled={locked || typesLoading || responsesLoading}
            allowDeselect={false}
          />
          {locked && (
            <Text size="sm" c="dimmed">
              The flavor type can&rsquo;t be changed once ratings exist.
            </Text>
          )}
        </Stack>
      </Card>
      <Card>
        <NumberInput
          label="Max rating (stars)"
          min={1}
          max={10}
          step={1}
          value={maxRating}
          onChange={(value) => setMaxRating(typeof value === 'number' ? value : 5)}
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
