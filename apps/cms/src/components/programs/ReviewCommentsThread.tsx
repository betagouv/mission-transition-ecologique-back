'use client'

import type { ArrayFieldClientComponent } from 'payload'
import React, { useEffect, useMemo, useState } from 'react'
import { useAuth, useForm, useFormFields } from '@payloadcms/ui'

type ThreadRow = {
  index: number
  text: string
  author: number | null
  date: string | null
}

const AVATAR_COLORS = [
  '#000091',
  '#0063cb',
  '#27a658',
  '#e1000f',
  '#ff732c',
  '#a558a0',
]

const initialsOf = (label: string): string => {
  const local = label.split('@')[0] ?? label
  const parts = local.split(/[._-]+/).filter(Boolean)
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return letters.toUpperCase()
}

const colorOf = (seed: number | string): string => {
  const numeric =
    typeof seed === 'number'
      ? seed
      : seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return AVATAR_COLORS[Math.abs(numeric) % AVATAR_COLORS.length]
}

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})
const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
})

export const ReviewCommentsThread: ArrayFieldClientComponent = ({
  path,
  schemaPath,
}) => {
  const { user } = useAuth()
  const { addFieldRow } = useForm()
  const [draft, setDraft] = useState('')
  const [labels, setLabels] = useState<Record<number, string>>({})

  const rows = useFormFields(([fields]) => {
    const out: ThreadRow[] = []
    for (let i = 0; ; i++) {
      const textField = fields[`${path}.${i}.text`]
      if (textField === undefined) break
      out.push({
        index: i,
        text: (textField.value as string) ?? '',
        author: (fields[`${path}.${i}.author`]?.value as number) ?? null,
        date: (fields[`${path}.${i}.date`]?.value as string) ?? null,
      })
    }
    return out
  })

  const authorIds = useMemo(() => {
    const ids = new Set<number>()
    rows.forEach((row) => {
      if (typeof row.author === 'number') ids.add(row.author)
    })
    return [...ids]
  }, [rows])

  // Resolve author ids to their email once: form state only carries the id,
  // and the current user is already known from useAuth.
  useEffect(() => {
    const missing = authorIds.filter(
      (id) => !(id in labels) && id !== user?.id,
    )
    if (missing.length === 0) return
    const params = new URLSearchParams()
    params.set('depth', '0')
    params.set('limit', '0')
    missing.forEach((id, i) => {
      params.set(`where[id][in][${i.toString()}]`, id.toString())
    })
    fetch(`/api/users?${params.toString()}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data: { docs?: { id: number; email: string }[] }) => {
        setLabels((prev) => {
          const next = { ...prev }
          data.docs?.forEach((doc) => {
            next[doc.id] = doc.email
          })
          return next
        })
      })
      .catch(() => undefined)
  }, [authorIds, labels, user?.id])

  const labelFor = (author: number | null): string => {
    if (author == null || author === user?.id) return user?.email ?? 'Moi'
    return labels[author] ?? `Utilisateur ${author.toString()}`
  }

  const handleSend = () => {
    const text = draft.trim()
    if (!text) return
    addFieldRow({
      path,
      schemaPath: schemaPath ?? path,
      subFieldState: { text: { value: text, initialValue: text, valid: true } },
    })
    setDraft('')
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  let lastDay: string | null = null

  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div
        style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          marginBottom: '0.5rem',
          color: '#3a3a3a',
        }}
      >
        Commentaires de relecture
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: 360,
          overflowY: 'auto',
          padding: '0.75rem',
          background: rows.length === 0 ? 'transparent' : '#f6f6f6',
          borderRadius: 8,
        }}
      >
        {rows.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '1.5rem 0.5rem',
              textAlign: 'center',
              color: '#000091',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#000091" aria-hidden="true">
              <path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H8l-4 4V5a1 1 0 0 1 1-1Z" />
            </svg>
            <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
              Il n’y a pas encore de commentaire.
              <br />
              Utilisez le formulaire ci-dessous pour ajouter un commentaire.
            </div>
          </div>
        )}

        {rows.map((row) => {
          const when = row.date ? new Date(row.date) : new Date()
          const day = dayFormatter.format(when)
          const showDay = day !== lastDay
          lastDay = day
          const label = labelFor(row.author)
          const avatarSeed = row.author ?? user?.id ?? 0

          return (
            <React.Fragment key={row.index}>
              {showDay && (
                <div
                  style={{
                    alignSelf: 'center',
                    fontSize: '0.7rem',
                    color: '#666',
                    background: '#e5e5e5',
                    borderRadius: 12,
                    padding: '0.1rem 0.6rem',
                  }}
                >
                  {day}
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div
                  style={{
                    flex: '0 0 auto',
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: colorOf(avatarSeed),
                    color: '#fff',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {initialsOf(label)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.4rem',
                      alignItems: 'baseline',
                      marginBottom: 2,
                    }}
                  >
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {label}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: '#888' }}>
                      {timeFormatter.format(when)}
                      {row.date ? '' : ' · non enregistré'}
                    </span>
                  </div>
                  <div
                    style={{
                      background: '#e3e3fd',
                      color: '#161616',
                      borderRadius: '0 8px 8px 8px',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.85rem',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    {row.text}
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Commentaire"
          rows={2}
          style={{
            flex: 1,
            resize: 'vertical',
            borderRadius: 8,
            border: '1px solid #ccc',
            padding: '0.5rem',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={draft.trim().length === 0}
          style={{
            flex: '0 0 auto',
            alignSelf: 'flex-end',
            background: draft.trim().length === 0 ? '#cacafb' : '#000091',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.5rem 0.9rem',
            fontSize: '0.85rem',
            cursor: draft.trim().length === 0 ? 'default' : 'pointer',
          }}
        >
          Envoyer
        </button>
      </div>
    </div>
  )
}
