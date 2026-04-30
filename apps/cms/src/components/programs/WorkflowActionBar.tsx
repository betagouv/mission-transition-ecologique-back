'use client'

import React from 'react'
import { useDocumentInfo, useAuth, useForm, useFormModified, SelectInput } from '@payloadcms/ui'
import type { ReactSelectOption } from '@payloadcms/ui'
import {
  WorkflowTransitionPolicy,
  WORKFLOW_STATUS_LABELS,
  TRANSITION_LABELS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'
import type { UserRoleValue } from '@/utils/user/UserRole'

export const WorkflowActionBar: React.FC = () => {
  const { data } = useDocumentInfo()
  const { user } = useAuth()
  const { submit } = useForm()
  const isModified = useFormModified()

  const currentStatus = (data?.workflowStatus ?? 'en-creation') as WorkflowStatus
  const role = user?.role as UserRoleValue | undefined

  const availableTransitions = role
    ? WorkflowTransitionPolicy.getAllowedTransitions(currentStatus, role)
    : []

  if (availableTransitions.length === 0) return null

  const options = [currentStatus, ...availableTransitions].map((status) => ({
    label: TRANSITION_LABELS[status] ?? WORKFLOW_STATUS_LABELS[status],
    value: status,
  }))

  const handleChange = (option: ReactSelectOption | ReactSelectOption[]) => {
    if (Array.isArray(option)) return
    const to = option.value as WorkflowStatus
    if (to === currentStatus) return

    if (WorkflowTransitionPolicy.requiresReplacement(to)) {
      const replacementId = window.prompt(
        'ID du programme remplaçant (champ "id" du programme cible) :',
      )
      if (!replacementId) return
      void submit({ overrides: { workflowStatus: to, replacedBy: replacementId } })
      return
    }

    void submit({ overrides: { workflowStatus: to } })
  }

  return (
    <div style={{ minWidth: 150 }}>
      <SelectInput
        name="workflowStatusTransition"
        path="workflowStatusTransition"
        options={options}
        value={currentStatus}
        onChange={handleChange}
        isClearable={false}
        readOnly={isModified}
      />
    </div>
  )
}
