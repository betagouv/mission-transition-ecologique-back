'use client'

import React from 'react'
import { useFormFields } from '@payloadcms/ui'
import { COMPANY_SIZE_LABELS, DUREE_BY_AID_TYPE, MONTANT_BY_AID_TYPE } from '@/services/canonical/canonicalMappings'
import { MODIFIABLE_FIELD_OPTIONS } from '@/constants/variantOptions'
import { parentFieldPath } from './variantFieldPath'
import { useGeographicAreaNames } from './useGeographicAreaNames'
import { useOperatorNames } from './useOperatorNames'

interface UiFieldProps {
  path: string
}

type AidType = keyof typeof MONTANT_BY_AID_TYPE

interface ConditionData {
  type: string
  sizes: string[]
  areaIds: (number | string)[]
}

interface ModificationData {
  field: string
  value: string
}

interface RawModification {
  field: string
  newValue?: string
  contactId?: number | string
  otherIds: (number | string)[]
}

const MODIFIABLE_FIELD_LABELS: Record<string, string> = Object.fromEntries(
  MODIFIABLE_FIELD_OPTIONS.map((option) => [option.value, option.label]),
)

// Lowercased, article-prefixed form for the running sentence ("alors le montant
// de l'aide passe de ..."), distinct from the select's capitalised label.
const FIELD_SUMMARY_LABELS: Record<string, string> = {
  montant: "le montant de l'aide",
  duree: 'la durée',
  urlSource: 'le lien du dispositif',
  contactOperateur: "l'opérateur de contact",
  autresOperateurs: 'les autres opérateurs',
  eligibiliteEffectif: "l'éligibilité de taille",
  autresCriteres: "les autres critères d'éligibilité",
}

const resolveBaseField = (field: string, aidType: AidType | undefined): string | undefined => {
  if (field === 'urlSource') return 'url'
  if (!aidType) return undefined
  if (field === 'montant') return MONTANT_BY_AID_TYPE[aidType].field as string
  if (field === 'duree') return DUREE_BY_AID_TYPE[aidType]?.field as string | undefined
  return undefined
}

const summaryStyle: React.CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.8rem 1rem',
  backgroundColor: '#fef7c3',
  border: '1px solid #f1d77a',
  borderRadius: '6px',
  fontSize: '0.875rem',
  lineHeight: 1.55,
}

const titleStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.35rem',
  color: '#8a6d00',
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const strongValue: React.CSSProperties = { fontWeight: 700 }
const struckValue: React.CSSProperties = { color: '#a3120a', textDecoration: 'line-through' }
const newValueStyle: React.CSSProperties = { color: '#18753c', fontWeight: 700 }

/**
 * Yellow "RÉSUMÉ DE LA RÈGLE" panel that reads back the whole variant as one
 * sentence: "Si <conditions ET ...>, alors <champ> passe de <ancienne> à
 * <nouvelle>". Hidden until at least one condition and one modification are
 * complete, so it never renders a half sentence.
 */
export const VariantRuleSummary: React.FC<UiFieldProps> = ({ path }) => {
  const variantPrefix = parentFieldPath(path)
  const fields = useFormFields(([formFields]) => formFields)
  const aidType = fields.aidType?.value as AidType | undefined

  const conditionCount = (fields[`${variantPrefix}.conditions`]?.rows ?? []).length
  const conditions: ConditionData[] = []
  for (let i = 0; i < conditionCount; i++) {
    const base = `${variantPrefix}.conditions.${i.toString()}`
    const type = fields[`${base}.conditionType`]?.value as string | undefined
    if (!type) continue
    conditions.push({
      type,
      sizes: (fields[`${base}.companySizeValue`]?.value as string[] | undefined) ?? [],
      areaIds: (fields[`${base}.geographicAreaValue`]?.value as (number | string)[] | undefined) ?? [],
    })
  }

  const allAreaIds = conditions
    .filter((condition) => condition.type === 'geographicArea')
    .flatMap((condition) => condition.areaIds)
  const areaNames = useGeographicAreaNames(allAreaIds)

  const modificationCount = (fields[`${variantPrefix}.modifications`]?.rows ?? []).length
  const rawModifications: RawModification[] = []
  for (let i = 0; i < modificationCount; i++) {
    const base = `${variantPrefix}.modifications.${i.toString()}`
    const field = fields[`${base}.field`]?.value as string | undefined
    if (!field) continue
    rawModifications.push({
      field,
      newValue: (fields[`${base}.newValue`]?.value as string | undefined)?.trim() || undefined,
      contactId: fields[`${base}.contactOperator`]?.value as number | string | undefined,
      otherIds:
        (fields[`${base}.otherOperators`]?.value as (number | string)[] | undefined) ?? [],
    })
  }

  // Base operators (the dispositif's generic contact / co-funders) so the
  // sentence can read "passe de <ADEME> à <…>" instead of "prend la valeur".
  const baseContactId = fields.operator?.value as number | string | undefined
  const baseOtherOperatorIds =
    (fields.otherOperators?.value as (number | string)[] | undefined) ?? []

  const operatorIds = [
    ...rawModifications.flatMap((mod) =>
      mod.field === 'contactOperateur' && mod.contactId
        ? [mod.contactId]
        : mod.field === 'autresOperateurs'
          ? mod.otherIds
          : [],
    ),
    ...(baseContactId ? [baseContactId] : []),
    ...baseOtherOperatorIds,
  ]
  const operatorNames = useOperatorNames(operatorIds)

  const modifications: ModificationData[] = []
  for (const mod of rawModifications) {
    let value: string | undefined
    if (mod.field === 'contactOperateur') {
      value = mod.contactId ? operatorNames[String(mod.contactId)] : undefined
    } else if (mod.field === 'autresOperateurs') {
      const names = mod.otherIds.map((id) => operatorNames[String(id)]).filter(Boolean)
      value = names.length > 0 ? names.join(', ') : undefined
    } else {
      value = mod.newValue
    }
    if (value) modifications.push({ field: mod.field, value })
  }

  const conditionPhrases = conditions
    .map((condition, index) => {
      if (condition.type === 'companySize') {
        const labels = condition.sizes.map(
          (size) => COMPANY_SIZE_LABELS[size as keyof typeof COMPANY_SIZE_LABELS] ?? size,
        )
        if (labels.length === 0) return null
        return { lead: 'a ', value: labels.join(', '), key: index }
      }
      const names = condition.areaIds.map((id) => areaNames[String(id)]).filter(Boolean)
      if (names.length === 0) return null
      return { lead: 'se situe en ', value: names.join(', '), key: index }
    })
    .filter((phrase): phrase is { lead: string; value: string; key: number } => phrase !== null)

  if (conditionPhrases.length === 0 || modifications.length === 0) return null

  return (
    <div style={summaryStyle}>
      <span style={titleStyle}>Résumé de la règle</span>
      <span>
        {"Si l'entreprise "}
        {conditionPhrases.map((phrase, index) => (
          <React.Fragment key={phrase.key}>
            {index > 0 && ' ET '}
            {phrase.lead}
            <span style={strongValue}>{phrase.value}</span>
          </React.Fragment>
        ))}
        , alors{' '}
        {modifications.map((modification, index) => {
          const label =
            FIELD_SUMMARY_LABELS[modification.field] ??
            MODIFIABLE_FIELD_LABELS[modification.field] ??
            modification.field
          let baseValue: string | undefined
          if (modification.field === 'contactOperateur') {
            baseValue = baseContactId ? operatorNames[String(baseContactId)] : undefined
          } else if (modification.field === 'autresOperateurs') {
            const names = baseOtherOperatorIds
              .map((id) => operatorNames[String(id)])
              .filter(Boolean)
            baseValue = names.length > 0 ? names.join(', ') : undefined
          } else {
            const baseFieldName = resolveBaseField(modification.field, aidType)
            baseValue = baseFieldName
              ? (fields[baseFieldName]?.value as string | undefined)
              : undefined
          }
          const hasBase = Boolean(baseValue && baseValue.trim().length > 0)
          return (
            <React.Fragment key={index}>
              {index > 0 && ' ; '}
              <span style={strongValue}>{label}</span>{' '}
              {hasBase ? (
                <>
                  passe de <span style={struckValue}>{baseValue}</span> à{' '}
                </>
              ) : (
                'prend la valeur '
              )}
              <span style={newValueStyle}>{modification.value}</span>
            </React.Fragment>
          )
        })}
        .
      </span>
    </div>
  )
}
