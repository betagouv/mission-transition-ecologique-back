'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { WorkflowStatusPill } from '@/components/programs/WorkflowStatusPill'
import type { WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'

export const WorkflowStatusBadge: React.FC = () => {
  const { data } = useDocumentInfo()
  const status = (data?.workflowStatus ?? 'en-creation') as WorkflowStatus

  return (
    <div className="doc-controls__status">
      <span className="doc-controls__label">Statut:</span>&nbsp;
      <WorkflowStatusPill status={status} />
    </div>
  )
}
