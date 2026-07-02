'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { DUREE_BY_AID_TYPE, MONTANT_BY_AID_TYPE } from '@/services/canonical/canonicalMappings'
import { parentFieldPath } from './variantFieldPath'
import { useOperatorNames } from './useOperatorNames'

interface UiFieldProps {
  path: string
}

type AidType = keyof typeof MONTANT_BY_AID_TYPE

/** Resolves the base Payload field that a modification overrides, given aid type. */
const resolveBaseField = (
  field: string | undefined,
  aidType: AidType | undefined,
): string | undefined => {
  if (!field) return undefined
  if (field === 'urlSource') return 'url'
  if (!aidType) return undefined
  if (field === 'montant') return MONTANT_BY_AID_TYPE[aidType].field as string
  if (field === 'duree') return DUREE_BY_AID_TYPE[aidType]?.field as string | undefined
  return undefined
}

/**
 * Reminder under a modification: the generic value (struck through, red) the
 * variant overrides, plus a green confirmation once a new value is entered.
 */
export const VariantModificationReminder: React.FC<UiFieldProps> = ({ path }) => {
  const rowPrefix = parentFieldPath(path)
  const field = useFormFields(([fields]) => fields[`${rowPrefix}.field`]?.value as string | undefined)
  const newValue = useFormFields(
    ([fields]) => fields[`${rowPrefix}.newValue`]?.value as string | undefined,
  )
  const contactOperator = useFormFields(
    ([fields]) => fields[`${rowPrefix}.contactOperator`]?.value as number | string | undefined,
  )
  const otherOperators = useFormFields(
    ([fields]) => fields[`${rowPrefix}.otherOperators`]?.value as (number | string)[] | undefined,
  )
  const aidType = useFormFields(([fields]) => fields.aidType?.value as AidType | undefined)
  // Base operators of the dispositif (generic contact / co-funders), to show the
  // overridden value struck through for operator modifications.
  const baseContactId = useFormFields(
    ([fields]) => fields.operator?.value as number | string | undefined,
  )
  const baseOtherIds = useFormFields(
    ([fields]) => fields.otherOperators?.value as (number | string)[] | undefined,
  )

  const baseFieldName = resolveBaseField(field, aidType)
  const textBaseValue = useFormFields(([fields]) =>
    baseFieldName ? (fields[baseFieldName]?.value as string | undefined) : undefined,
  )

  const operatorIds = [
    ...(field === 'contactOperateur' && baseContactId ? [baseContactId] : []),
    ...(field === 'autresOperateurs' ? (baseOtherIds ?? []) : []),
  ]
  const operatorNames = useOperatorNames(operatorIds)

  if (!field) return null

  let baseValue: string | undefined
  if (field === 'contactOperateur') {
    baseValue = baseContactId ? operatorNames[String(baseContactId)] : undefined
  } else if (field === 'autresOperateurs') {
    const names = (baseOtherIds ?? []).map((id) => operatorNames[String(id)]).filter(Boolean)
    baseValue = names.length > 0 ? names.join(', ') : undefined
  } else {
    baseValue = textBaseValue
  }

  const hasBase = Boolean(baseValue && baseValue.trim().length > 0)
  const hasNew =
    Boolean(newValue && newValue.trim().length > 0) ||
    Boolean(contactOperator) ||
    (Array.isArray(otherOperators) && otherOperators.length > 0)
  if (!hasBase && !hasNew) return null

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '1rem',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
        fontSize: '0.8125rem',
      }}
    >
      <div style={{ flex: 1 }}>
        {hasBase && (
          <span>
            Valeur générique actuelle :{' '}
            <span style={{ color: '#a3120a', textDecoration: 'line-through' }}>{baseValue}</span>
          </span>
        )}
      </div>
      <div style={{ flex: 1, color: '#18753c', fontWeight: 600 }}>
        {hasNew && '✓ Remplacera la valeur générique pour ce profil'}
      </div>
    </div>
  )
}
