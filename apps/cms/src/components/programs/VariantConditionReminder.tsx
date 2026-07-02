'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { COMPANY_SIZE_LABELS } from '@/services/canonical/canonicalMappings'
import { parentFieldPath } from './variantFieldPath'
import { useGeographicAreaNames } from './useGeographicAreaNames'

interface UiFieldProps {
  path: string
}

const reminderStyle: React.CSSProperties = {
  marginTop: '0.5rem',
  marginBottom: '0.5rem',
  padding: '0.4rem 0.7rem',
  border: '1px dashed #9a9a9a',
  borderRadius: '4px',
  color: '#555',
  fontSize: '0.8125rem',
  fontStyle: 'italic',
}

/**
 * Dotted reminder under a condition, echoing the dispositif's generic value for
 * the chosen condition type (company size or geographic area). It shows the base
 * value the variant will override, not the variant's own selection.
 */
export const VariantConditionReminder: React.FC<UiFieldProps> = ({ path }) => {
  const rowPrefix = parentFieldPath(path)
  const conditionType = useFormFields(
    ([fields]) => fields[`${rowPrefix}.conditionType`]?.value as string | undefined,
  )
  const companySizes = useFormFields(
    ([fields]) => fields.companySizes?.value as string[] | undefined,
  )
  const geographicAreaIds = useFormFields(
    ([fields]) => fields.geographicAreas?.value as (number | string)[] | undefined,
  )

  const areaNames = useGeographicAreaNames(
    conditionType === 'geographicArea' ? (geographicAreaIds ?? []) : [],
  )

  if (!conditionType) return null

  let valeur: string
  if (conditionType === 'companySize') {
    valeur = describeCompanySizes(companySizes)
  } else if (conditionType === 'geographicArea') {
    const names = Object.values(areaNames)
    valeur = names.length > 0 ? names.join(', ') : 'Toute la France'
  } else {
    return null
  }

  return (
    <div style={reminderStyle}>
      Valeur générique actuelle : <strong>{valeur}</strong>
    </div>
  )
}

// Every known size except the "other" bucket. When the base dispositif covers
// all of them, the reminder reads "toutes tailles" instead of listing each one.
const ALL_COMPANY_SIZES = Object.keys(COMPANY_SIZE_LABELS).filter((size) => size !== 'other')

const describeCompanySizes = (sizes: string[] | undefined): string => {
  if (!sizes || sizes.length === 0) return 'toutes tailles'
  if (ALL_COMPANY_SIZES.every((size) => sizes.includes(size))) return 'toutes tailles'
  return sizes
    .map((size) => COMPANY_SIZE_LABELS[size as keyof typeof COMPANY_SIZE_LABELS] ?? size)
    .join(', ')
}
