'use client'

import React from 'react'
import { Pill } from '@payloadcms/ui'
import {
  WORKFLOW_STATUS_LABELS,
  type WorkflowStatus,
} from '@/services/workflow/WorkflowTransitionPolicy'

type PillStyle =
  | 'always-white'
  | 'dark'
  | 'error'
  | 'light'
  | 'light-gray'
  | 'success'
  | 'warning'
  | 'white'

const WORKFLOW_PILL_STYLES: Record<WorkflowStatus, PillStyle> = {
  'en-creation': 'light-gray',
  'en-relecture': 'warning',
  'en-cours-publication': 'warning',
  publie: 'success',
  'en-cours-modification': 'light',
  importe: 'light',
  annule: 'error',
  archive: 'light-gray',
  remplace: 'dark',
}

type Props = {
  status: WorkflowStatus
}

export const WorkflowStatusPill: React.FC<Props> = ({ status }) => (
  <Pill pillStyle={WORKFLOW_PILL_STYLES[status] ?? 'light'} size="small" rounded>
    {WORKFLOW_STATUS_LABELS[status] ?? status}
  </Pill>
)
