'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useDocumentInfo } from '@payloadcms/ui'

type RawAuthor = number | { id: number; email?: string } | null | undefined

type RawComment = {
  id: number
  text?: string
  author?: RawAuthor
  createdAt?: string
}

type Comment = {
  id: number | string
  text: string
  authorId: number | null
  authorEmail?: string
  createdAt: string | null
  pending?: boolean
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

const normalize = (raw: RawComment): Comment => {
  const author = raw.author
  const isObject = typeof author === 'object' && author !== null
  return {
    id: raw.id,
    text: raw.text ?? '',
    authorId: isObject ? author.id : (author ?? null),
    authorEmail: isObject ? author.email : undefined,
    createdAt: raw.createdAt ?? null,
  }
}

export const ReviewCommentsThread: React.FC = () => {
  const { user } = useAuth()
  const { id } = useDocumentInfo()
  const [comments, setComments] = useState<Comment[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [labels, setLabels] = useState<Record<number, string>>({})

  const canComment = Boolean(id)

  const load = useCallback(async () => {
    if (!id) {
      setComments([])
      return
    }
    const params = new URLSearchParams()
    params.set('where[program][equals]', id.toString())
    params.set('sort', 'createdAt')
    params.set('depth', '1')
    params.set('limit', '200')
    try {
      const res = await fetch(`/api/review-comments?${params.toString()}`, {
        credentials: 'include',
      })
      const data = (await res.json()) as { docs?: RawComment[] }
      setComments((data.docs ?? []).map(normalize))
    } catch {
      // keep whatever is shown; a transient read error shouldn't wipe the thread
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const authorIds = useMemo(() => {
    const ids = new Set<number>()
    comments.forEach((comment) => {
      if (comment.authorId != null && !comment.authorEmail) {
        ids.add(comment.authorId)
      }
    })
    return [...ids]
  }, [comments])

  useEffect(() => {
    const missing = authorIds.filter(
      (authorId) => !(authorId in labels) && authorId !== user?.id,
    )
    if (missing.length === 0) return
    const params = new URLSearchParams()
    params.set('depth', '0')
    params.set('limit', '0')
    missing.forEach((authorId, i) => {
      params.set(`where[id][in][${i.toString()}]`, authorId.toString())
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

  const labelFor = (comment: Comment): string => {
    if (comment.authorEmail) return comment.authorEmail
    if (comment.authorId == null || comment.authorId === user?.id) {
      return user?.email ?? 'Moi'
    }
    return labels[comment.authorId] ?? `Utilisateur ${comment.authorId.toString()}`
  }

  const persist = async (text: string) => {
    const optimistic: Comment = {
      id: `pending-${comments.length.toString()}`,
      text,
      authorId: typeof user?.id === 'number' ? user.id : null,
      authorEmail: user?.email,
      createdAt: null,
      pending: true,
    }
    setComments((prev) => [...prev, optimistic])
    setDraft('')
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/review-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ program: id, text }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status.toString()}`)
      await load()
    } catch {
      setComments((prev) => prev.filter((comment) => comment !== optimistic))
      setDraft(text)
      setError("Le commentaire n'a pas pu être enregistré. Réessayez.")
    } finally {
      setSending(false)
    }
  }

  const handleSend = () => {
    const text = draft.trim()
    if (!text || !id || sending) return
    void persist(text)
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
          background: comments.length === 0 ? 'transparent' : '#f6f6f6',
          borderRadius: 8,
        }}
      >
        {comments.length === 0 && (
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

        {comments.map((comment) => {
          const when = comment.createdAt ? new Date(comment.createdAt) : new Date()
          const day = dayFormatter.format(when)
          const showDay = day !== lastDay
          lastDay = day
          const label = labelFor(comment)
          const avatarSeed = comment.authorId ?? user?.id ?? 0

          return (
            <React.Fragment key={comment.id}>
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
                    opacity: comment.pending ? 0.6 : 1,
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
                      {comment.pending ? 'envoi…' : timeFormatter.format(when)}
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
                      opacity: comment.pending ? 0.6 : 1,
                    }}
                  >
                    {comment.text}
                  </div>
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {error && (
        <div style={{ color: '#e1000f', fontSize: '0.75rem', marginTop: '0.4rem' }}>
          {error}
        </div>
      )}

      {!canComment && (
        <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
          Enregistrez le dispositif pour pouvoir ajouter des commentaires.
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
        <textarea
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Commentaire"
          rows={2}
          disabled={!canComment || sending}
          style={{
            flex: 1,
            resize: 'vertical',
            borderRadius: 8,
            border: '1px solid #ccc',
            padding: '0.5rem',
            fontSize: '0.85rem',
            fontFamily: 'inherit',
            background: canComment ? '#fff' : '#f0f0f0',
          }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canComment || sending || draft.trim().length === 0}
          style={{
            flex: '0 0 auto',
            alignSelf: 'flex-end',
            background:
              !canComment || sending || draft.trim().length === 0
                ? '#cacafb'
                : '#000091',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0.5rem 0.9rem',
            fontSize: '0.85rem',
            cursor:
              !canComment || sending || draft.trim().length === 0
                ? 'default'
                : 'pointer',
          }}
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}
