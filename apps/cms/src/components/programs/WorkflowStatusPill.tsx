'use client'

import React from 'react'
import {
  WORKFLOW_STATUS_LABELS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'

type BadgeVariant = 'info' | 'success' | 'warning' | 'error' | 'neutral' | 'purple'

const WORKFLOW_BADGE_VARIANTS: Record<WorkflowStatus, BadgeVariant> = {
  'en-creation': 'neutral',
  'en-relecture': 'warning',
  'en-cours-publication': 'warning',
  publie: 'success',
  'en-cours-modification': 'info',
  importe: 'info',
  annule: 'error',
  archive: 'neutral',
  remplace: 'purple',
}

type Props = {
  status: WorkflowStatus
}

export const WorkflowStatusPill: React.FC<Props> = ({ status }) => {
  const variant = WORKFLOW_BADGE_VARIANTS[status] ?? 'neutral'
  return (
    <span className={`tee-badge tee-badge--${variant}`}>
      {WORKFLOW_STATUS_LABELS[status] ?? status}
    </span>
  )
}
