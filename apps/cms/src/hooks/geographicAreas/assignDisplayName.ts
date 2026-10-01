import type { CollectionBeforeChangeHook } from 'payload'
import { AREA_TYPE_LABELS } from '@/constants/geographicCoverageOptions'

/**
 * Builds the title shown in area pickers, `Guadeloupe (région)`: an overseas
 * department has the name of its region, and a program can now pick both levels.
 */
export const assignDisplayName: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const name = (data.name ?? originalDoc?.name) as string | undefined
  const coverageType = (data.coverageType ?? originalDoc?.coverageType) as string | undefined
  if (!name) return data
  const level = coverageType ? AREA_TYPE_LABELS[coverageType] : undefined
  data.displayName = level ? `${name} (${level})` : name
  return data
}
