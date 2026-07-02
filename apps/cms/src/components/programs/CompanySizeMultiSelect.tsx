'use client'

import React, { useCallback } from 'react'
import type { OptionObject } from 'payload'
import { SelectInput, useField } from '@payloadcms/ui'
import { COMPANY_SIZE_OPTIONS, COMPANY_SIZE_BUCKETS } from '@/constants/companySizeOptions'

interface UiFieldProps {
  path: string
}

// A variant size condition targets concrete buckets only: drop `all`/`specific`,
// which carry no numeric interval and would be silently ignored downstream.
const BUCKET_VALUES = new Set<string>(COMPANY_SIZE_BUCKETS)
const OPTIONS: OptionObject[] = COMPANY_SIZE_OPTIONS.filter((option) =>
  BUCKET_VALUES.has(option.value),
).map((option) => ({
  label: option.label,
  value: option.value,
}))

/**
 * Multi-select for company sizes backed by a JSON field. A native `select
 * hasMany` here would sit two arrays deep (variant → condition → value) and hit
 * a Payload version sub-table FK bug, so the values live in one JSON column and
 * this control reproduces the native chip picker on top of it.
 */
export const CompanySizeMultiSelect: React.FC<UiFieldProps> = ({ path }) => {
  const { value, setValue } = useField<string[]>({ path })
  const selected = Array.isArray(value) ? value : []

  const onChange = useCallback(
    (option: unknown) => {
      const options = Array.isArray(option) ? (option as { value: string }[]) : []
      setValue(options.map((entry) => entry.value))
    },
    [setValue],
  )

  return (
    <SelectInput
      name="companySizeValue"
      path={path}
      label="Valeur de la condition"
      hasMany
      options={OPTIONS}
      value={selected}
      onChange={onChange}
    />
  )
}
