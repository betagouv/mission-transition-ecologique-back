'use client'

import React from 'react'
import { PopupList, useFormProcessing } from '@payloadcms/ui'
import { useWorkflowSubmit } from '@/components/programs/useWorkflowSubmit'

const TrashIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.5"
    viewBox="0 0 24 24"
    width="16"
  >
    <path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V6" />
  </svg>
)

export const WorkflowEditMenuItems: React.FC = () => {
  const { actions, runAction } = useWorkflowSubmit()
  const processing = useFormProcessing()

  const menuActions = actions.filter((action) => action.placement === 'menu')

  if (menuActions.length === 0) return null

  return (
    <React.Fragment>
      {menuActions.map((action) => (
        <PopupList.Button
          key={action.key}
          className="tee-workflow-menu-item"
          disabled={processing}
          onClick={() => runAction(action)}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'calc(var(--base) / 2)',
              color: action.variant === 'danger' ? 'var(--theme-error-500)' : undefined,
            }}
          >
            <TrashIcon />
            {action.label}
          </span>
        </PopupList.Button>
      ))}
    </React.Fragment>
  )
}
