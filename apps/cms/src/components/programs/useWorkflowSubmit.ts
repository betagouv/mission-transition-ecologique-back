'use client'

import { useAuth, useConfig, useDocumentInfo, useForm, useLocale } from '@payloadcms/ui'
import { formatAdminURL } from 'payload/shared'
import { WorkflowActionPresenter, type WorkflowAction } from '@/services/workflow/WorkflowActionPresenter'
import { WORKFLOW_STATUS, type WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'
import type { UserRoleValue } from '@/utils/user/UserRole'

type UseWorkflowSubmit = {
  actions: WorkflowAction[]
  runAction: (action: WorkflowAction) => void
}

/**
 * Shared wiring between `WorkflowActionBar` (controls bar) and
 * `WorkflowEditMenuItems` (overflow menu): computes the available actions and
 * submits them with the right validation strategy.
 */
export function useWorkflowSubmit(): UseWorkflowSubmit {
  const { id, collectionSlug, data } = useDocumentInfo()
  const { user } = useAuth()
  const { submit } = useForm()
  const {
    config: {
      routes: { api },
    },
  } = useConfig()
  const { code: locale } = useLocale()

  const currentStatus = (data?.workflowStatus ?? WORKFLOW_STATUS.enCreation) as WorkflowStatus
  const role = user?.role as UserRoleValue | undefined
  const actions = role ? WorkflowActionPresenter.getActions(currentStatus, role) : []

  // Mirrors Payload's native "Save draft": hits the API with `draft=true` so the
  // server skips required-field validation, keeping client and server in sync.
  const draftSubmit = (overrides: Record<string, unknown>) => {
    const params = new URLSearchParams({ depth: '0', 'fallback-locale': 'null', draft: 'true' })
    if (locale) params.set('locale', locale)
    const action = formatAdminURL({
      apiRoute: api,
      path: `/${collectionSlug}${id ? `/${id}` : ''}?${params.toString()}`,
    })
    return submit({ action, method: id ? 'PATCH' : 'POST', overrides, skipValidation: true })
  }

  const runAction = (action: WorkflowAction) => {
    if (action.kind === 'save-draft') {
      void draftSubmit({ _status: 'draft' })
      return
    }

    if (action.requiresReplacement) {
      const replacementId = window.prompt(
        'ID du programme remplaçant (champ "id" du programme cible) :',
      )
      if (!replacementId) return
      void draftSubmit({ workflowStatus: action.to, replacedBy: replacementId })
      return
    }

    // Validated transitions go through the standard submit so client-then-server
    // validation runs; the rest stay as lenient as a draft save.
    if (action.validate) {
      void submit({ overrides: { workflowStatus: action.to } })
      return
    }

    void draftSubmit({ workflowStatus: action.to })
  }

  return { actions, runAction }
}
