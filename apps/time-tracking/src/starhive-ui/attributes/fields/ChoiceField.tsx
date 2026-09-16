import { Loader, MultiSelect, Select } from '@mantine/core'
import { useMemo } from 'react'

import { choiceFieldValues } from '../fieldKind'
import { optionNameFor } from '../model'
import { ChoiceOptionIcon, ChoiceOptionRow } from './ChoiceOptionRow'
import { allValues, firstValue, labelFor } from './shared'
import type { ChoiceOption, FieldProps } from './types'

/**
 * One field for every attribute that picks from candidates — `OPTION`, `REFERENCE`, `USER`.
 *
 * They differ only in where the candidates come from, not in how they behave: `OPTION` reads them off
 * the attribute's own configuration (no fetch), while `REFERENCE` and `USER` need the host to supply
 * them. So this is one control, and `<AttributeField>` decides which list to hand it.
 *
 * Single or multi follows `attribute.multiValue`, so a type that allows several references gets a
 * multi-select without the caller saying so.
 */
export function ChoiceField({
  attribute,
  values,
  onChange,
  options,
  optionsLoading,
  onSearch,
  disabled,
  error,
  label,
  density = 'default',
}: FieldProps) {
  const data = useMemo(() => toSelectData(attribute, values, options), [attribute, values, options])
  const byValue = useMemo(() => new Map(data.map((option) => [option.value, option])), [data])

  // Only reference and user candidates carry a picture; an OPTION is a word and rendering an
  // initials bubble beside it would be noise.
  const withPictures = data.some((option) => option.avatarUrl || option.iconUrl)
  const renderOption = withPictures
    ? ({ option }: { option: { value: string } }) => {
        const full = byValue.get(option.value)
        return full ? <ChoiceOptionRow option={full} density={density} /> : null
      }
    : undefined

  const selected = byValue.get(firstValue(values))
  const shared = {
    label: labelFor(attribute, label),
    withAsterisk: attribute.required,
    data,
    disabled,
    error,
    searchable: true,
    clearable: true,
    nothingFoundMessage: optionsLoading ? 'Loading…' : 'Nothing found',
    rightSection: optionsLoading ? <Loader size="xs" /> : undefined,
    onSearchChange: onSearch,
    ...(renderOption ? { renderOption } : {}),
  }

  if (attribute.multiValue) {
    return <MultiSelect {...shared} value={allValues(values)} onChange={(next) => onChange(next)} />
  }

  return (
    <Select
      {...shared}
      value={firstValue(values) || null}
      // The chosen value gets its picture too, so a filled field reads the same as the row that
      // filled it.
      leftSection={
        withPictures && selected ? (
          <ChoiceOptionIcon option={selected} density={density} />
        ) : undefined
      }
      onChange={(next) => onChange(choiceFieldValues(next))}
    />
  )
}

/**
 * The candidate list, with the current values guaranteed to be in it.
 *
 * A selected value missing from the candidates would be dropped by the control and silently cleared
 * on the next change — which is a real case, not a defensive one: a reference whose target is on page
 * two of the host's query, or a user who has since left. Its label comes from the value's own
 * enrichment, which is exactly what that enrichment is for.
 */
function toSelectData(
  attribute: Parameters<typeof optionNameFor>[0],
  values: FieldProps['values'],
  options: ChoiceOption[] | undefined,
): ChoiceOption[] {
  const supplied =
    options ??
    // OPTION carries its own choices; the id is stored, the name is shown.
    (attribute.configuration?.options ?? []).map((option) => ({
      value: option.id,
      label: option.name,
    }))

  const known = new Set(supplied.map((option) => option.value))
  const missing = values
    .filter((value) => value.value && !known.has(value.value))
    .map((value) => ({
      value: value.value,
      label: value.display ?? optionNameFor(attribute, value.value),
    }))

  return [...missing, ...supplied]
}
