'use client'

import React, { useEffect, useState } from 'react'
import { useAuth, useField, useFormFields } from '@payloadcms/ui'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

interface SuggestedProject {
  id: number
  title: string
}

type LinkedProject = number | { id: number }

const chipStyle = (linked: boolean, editable: boolean): React.CSSProperties => ({
  fontFamily: 'inherit',
  fontSize: 'var(--tee-font-size-sm)',
  padding: 'var(--tee-space-1) var(--tee-space-2)',
  border: '1px solid var(--tee-blue-france)',
  borderRadius: 'var(--tee-radius-none)',
  background: linked ? 'var(--tee-blue-france)' : 'var(--tee-white)',
  color: linked ? 'var(--tee-white)' : 'var(--tee-blue-france)',
  cursor: editable ? 'pointer' : 'default',
})

/**
 * Published projects sharing a theme with the program: their count, then one
 * chip per project. A chip adds the project to `linkedProjects` or takes it
 * out; the select below still offers every project, whatever its themes.
 * Only admins may change the field, the others see which suggestions are linked.
 */
export const LinkedProjectsCounter: React.FC = () => {
  const { user } = useAuth()
  const themes = useFormFields(([fields]) => fields?.themes?.value as string[] | undefined)
  const { value, setValue } = useField<LinkedProject[]>({ path: 'linkedProjects' })
  const [suggestions, setSuggestions] = useState<SuggestedProject[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!themes || themes.length === 0) {
      setSuggestions([])
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const params = new URLSearchParams()
    params.set('limit', '0')
    params.set('depth', '0')
    params.set('sort', 'title')
    params.set('select[title]', 'true')
    // Drafts are served neither by the pivot nor by AGIR.
    params.set('where[_status][equals]', 'published')
    themes.forEach((theme, i) => {
      params.set(`where[themes][in][${i.toString()}]`, theme)
    })
    fetch(`/api/projects?${params.toString()}`, {
      signal: controller.signal,
      credentials: 'include',
    })
      .then((res) => res.json())
      .then((data: { docs?: SuggestedProject[] }) => {
        setSuggestions(data.docs ?? [])
      })
      .catch(() => undefined)
      .finally(() => {
        setLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [themes])

  const editable = UserRole.isAdmin(user as unknown as { role: UserRoleValue } | null)
  const linkedIds = (value ?? []).map((project) => (typeof project === 'object' ? project.id : project))
  const linked = new Set(linkedIds)
  const missing = suggestions.filter((project) => !linked.has(project.id))

  const toggle = (id: number): void => {
    setValue(linked.has(id) ? linkedIds.filter((linkedId) => linkedId !== id) : [...linkedIds, id])
  }

  const count = loading ? '…' : suggestions.length.toString()

  return (
    <details open style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
      <summary style={{ fontStyle: 'italic', cursor: 'pointer' }}>
        {count} projets possiblement liés à ce dispositif
        {suggestions.length > 0 && ` (mêmes thématiques), dont ${(suggestions.length - missing.length).toString()} déjà liés`}
      </summary>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--tee-space-2)', marginTop: 'var(--tee-space-2)' }}>
          {suggestions.map((project) => {
            const isLinked = linked.has(project.id)
            return (
              <button
                key={project.id}
                type="button"
                style={chipStyle(isLinked, editable)}
                disabled={!editable}
                aria-pressed={isLinked}
                title={isLinked ? 'Retirer des projets liés' : 'Ajouter aux projets liés'}
                onClick={() => {
                  toggle(project.id)
                }}
              >
                {isLinked ? '✓' : '+'} {project.title}
              </button>
            )
          })}
          {editable && (
            <button
              type="button"
              className="btn btn--style-secondary btn--size-small"
              style={{ margin: 0 }}
              disabled={missing.length === 0}
              onClick={() => {
                setValue([...linkedIds, ...missing.map((project) => project.id)])
              }}
            >
              Tout ajouter
            </button>
          )}
        </div>
      )}
    </details>
  )
}
