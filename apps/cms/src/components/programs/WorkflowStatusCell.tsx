'use client'

import React from 'react'
import type { DefaultCellComponentProps } from 'payload'
import { WorkflowStatusPill } from '@/components/programs/WorkflowStatusPill'
import type { WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'

export const WorkflowStatusCell: React.FC<DefaultCellComponentProps> = ({ cellData }) => {
  const status = (cellData ?? 'en-creation') as WorkflowStatus
  return <WorkflowStatusPill status={status} />
}
