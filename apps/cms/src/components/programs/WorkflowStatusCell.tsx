'use client'

import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import {
  WORKFLOW_STATUS_LABELS,
  WORKFLOW_STATUS_COLORS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'

export const WorkflowStatusCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const status = (cellData ?? 'brouillon') as WorkflowStatus
  const label = WORKFLOW_STATUS_LABELS[status] ?? status
  const colorClass = WORKFLOW_STATUS_COLORS[status] ?? ''

  return (
    <span
      className={colorClass}
      style={{
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
