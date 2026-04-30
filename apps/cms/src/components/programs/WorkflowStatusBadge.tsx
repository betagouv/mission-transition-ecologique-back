'use client'

import React from 'react'
import { useDocumentInfo } from '@payloadcms/ui'
import { WORKFLOW_STATUS_LABELS, type WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'

export const WorkflowStatusBadge: React.FC = () => {
  const { data } = useDocumentInfo();
  const currentStatus = (data?.workflowStatus ?? 'en-creation') as WorkflowStatus;

  return (
    <div className="doc-controls__status">
      <span className="doc-controls__label">Statut:</span>&nbsp;
      <span>{WORKFLOW_STATUS_LABELS[currentStatus]}</span>
    </div>
  )
}
