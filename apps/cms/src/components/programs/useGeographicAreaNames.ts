'use client'

import { useEffect, useState } from 'react'

/**
 * Resolves geographic-area display names from their IDs. Form state carries
 * `geographic-areas` relationships as bare IDs (depth 0), so the names are
 * fetched from the REST API, mirroring the LinkedProjectsCounter pattern.
 */
export const useGeographicAreaNames = (ids: (number | string)[]): Record<string, string> => {
  const [names, setNames] = useState<Record<string, string>>({})
  // Stable dependency: the ids array identity changes on every render.
  const key = ids.join(',')

  useEffect(() => {
    if (ids.length === 0) {
      setNames({})
      return
    }
    const controller = new AbortController()
    const params = new URLSearchParams()
    params.set('limit', '0')
    params.set('depth', '0')
    ids.forEach((id, i) => {
      params.set(`where[id][in][${i.toString()}]`, String(id))
    })
    fetch(`/api/geographic-areas?${params.toString()}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { docs?: { id: number | string; name?: string }[] }) => {
        const resolved: Record<string, string> = {}
        for (const doc of data.docs ?? []) {
          if (doc.name) resolved[String(doc.id)] = doc.name
        }
        setNames(resolved)
      })
      .catch(() => undefined)
    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return names
}
