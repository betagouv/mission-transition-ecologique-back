'use client'

import React, { useEffect, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'
import { GeographicAreaOverlap, type OverlapArea } from '@/services/geography/GeographicAreaOverlap'

/**
 * Live warning under the `geographicAreas` field: tells the editor, before
 * saving, that a selected department is already covered by a selected region.
 * The save validation (`GeographicAreasValidator`) enforces the same rule.
 */
export const GeographicAreaOverlapWarning: React.FC = () => {
  const selected = useFormFields(([fields]) => fields?.geographicAreas?.value as (number | string)[] | undefined)
  const [areas, setAreas] = useState<OverlapArea[]>([])
  // Stable dependency: the value array identity changes on every render.
  const key = (selected ?? []).join(',')

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (ids.length < 2) {
      setAreas([])
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams()
    params.set('limit', '0')
    params.set('depth', '0')
    ids.forEach((id, i) => {
      params.set(`where[id][in][${i.toString()}]`, id)
    })
    fetch(`/api/geographic-areas?${params.toString()}`, { signal: controller.signal, credentials: 'include' })
      .then((res) => res.json())
      .then((data: { docs?: OverlapArea[] }) => {
        setAreas(data.docs ?? [])
      })
      .catch(() => undefined)
    return () => {
      controller.abort()
    }
  }, [key])

  const covered = GeographicAreaOverlap.find(areas)
  if (covered.length === 0) return null

  return (
    <div
      role="alert"
      className="tee-geographic-overlap-warning"
      style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        borderLeft: '4px solid var(--theme-warning-500)',
        background: 'var(--theme-warning-100)',
        color: 'var(--theme-warning-900, var(--theme-text))',
      }}
    >
      <strong>Zones en doublon</strong>
      <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1.25rem' }}>
        {covered.map((item) => (
          <li key={String(item.area.id)}>
            {GeographicAreaOverlap.describe(item)} : retirez le département ou sa région.
          </li>
        ))}
      </ul>
    </div>
  )
}
