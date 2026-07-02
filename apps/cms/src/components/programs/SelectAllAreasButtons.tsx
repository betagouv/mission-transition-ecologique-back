'use client'

import React, { useState } from 'react'
import { useAuth, useField, useFormFields } from '@payloadcms/ui'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

type Coverage = 'regional' | 'departemental'

const COVERAGE_TYPE: Record<Coverage, 'region' | 'departement'> = {
  regional: 'region',
  departemental: 'departement',
}

const LABELS: Record<Coverage, { metropole: string; all: string }> = {
  regional: {
    metropole: 'Toutes les régions métropole',
    all: 'Toutes les régions (métropole + outre-mer)',
  },
  departemental: {
    metropole: 'Tous les départements métropole',
    all: 'Tous les départements (métropole + outre-mer)',
  },
}

/**
 * Bulk-selection helpers for the `geographicAreas` relationship field.
 * Renders only for admins (matching ProgramFieldAccessPolicy.adminOnly) and
 * only when coverage is regional/departemental.
 */
export const SelectAllAreasButtons: React.FC = () => {
  const { user } = useAuth()
  const coverage = useFormFields(
    ([fields]) => fields?.geographicCoverage?.value as Coverage | undefined,
  )
  const { setValue } = useField<number[]>({ path: 'geographicAreas' })
  const [loading, setLoading] = useState(false)

  const isAdmin = UserRole.isAdmin(
    user as unknown as { role: UserRoleValue } | null,
  )

  if (!isAdmin) return null
  if (coverage !== 'regional' && coverage !== 'departemental') return null

  const coverageType = COVERAGE_TYPE[coverage]
  const labels = LABELS[coverage]

  const selectAll = async (includeOverseas: boolean): Promise<void> => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '0')
    params.set('depth', '0')
    params.set('where[coverageType][equals]', coverageType)
    if (!includeOverseas) {
      params.set('where[isOverseas][not_equals]', 'true')
    }
    try {
      const res = await fetch(`/api/geographic-areas?${params.toString()}`, {
        credentials: 'include',
      })
      const data = (await res.json()) as { docs?: { id: number }[] }
      setValue((data.docs ?? []).map((doc) => doc.id))
    } catch {
      // Network error: leave the current selection untouched.
    } finally {
      setLoading(false)
    }
  }

  const buttonStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    padding: '0.25rem 0.6rem',
    cursor: loading ? 'wait' : 'pointer',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        marginBottom: '0.5rem',
      }}
    >
      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        style={buttonStyle}
        disabled={loading}
        onClick={() => void selectAll(false)}
      >
        {labels.metropole}
      </button>
      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        style={buttonStyle}
        disabled={loading}
        onClick={() => void selectAll(true)}
      >
        {labels.all}
      </button>
      <button
        type="button"
        className="btn btn--style-secondary btn--size-small"
        style={buttonStyle}
        disabled={loading}
        onClick={() => {
          setValue([])
        }}
      >
        Vider la sélection
      </button>
    </div>
  )
}
