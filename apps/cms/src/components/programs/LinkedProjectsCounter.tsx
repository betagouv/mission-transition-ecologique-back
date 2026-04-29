'use client'

import React, { useEffect, useState } from 'react'
import { useFormFields } from '@payloadcms/ui'

export const LinkedProjectsCounter: React.FC = () => {
  const themes = useFormFields(([fields]) => fields?.themes?.value as string[] | undefined)
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!themes || themes.length === 0) {
      setCount(0)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '0')
    params.set('depth', '0')
    themes.forEach((theme, i) => {
      params.set(`where[themes][in][${i.toString()}]`, theme)
    })
    fetch(`/api/projects?${params.toString()}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { totalDocs?: number }) => {
        setCount(data.totalDocs ?? 0)
      })
      .catch(() => undefined)
      .finally(() => {
        setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [themes])

  const value = loading ? '…' : (count ?? 0).toString()

  return (
    <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
      {value} projets possiblement liés à ce dispositif
    </div>
  )
}
