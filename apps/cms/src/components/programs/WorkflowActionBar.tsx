'use client'

import React from 'react'
import { Button, useFormProcessing } from '@payloadcms/ui'
import { useWorkflowSubmit } from '@/components/programs/useWorkflowSubmit'
import type { WorkflowActionVariant } from '@/services/workflow/WorkflowActionPresenter'

const BUTTON_STYLE: Record<WorkflowActionVariant, 'primary' | 'secondary' | 'error'> = {
  primary: 'primary',
  secondary: 'secondary',
  danger: 'error',
}

export const WorkflowActionBar: React.FC = () => {
  const { actions, runAction } = useWorkflowSubmit()
  const processing = useFormProcessing()

  const barActions = actions.filter((action) => action.placement === 'bar')

  if (barActions.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 'var(--base)', flexWrap: 'wrap', alignItems: 'center' }}>
      {barActions.map((action) => (
        <Button
          key={action.key}
          buttonStyle={BUTTON_STYLE[action.variant]}
          size="medium"
          disabled={processing}
          onClick={() => runAction(action)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  )
}
