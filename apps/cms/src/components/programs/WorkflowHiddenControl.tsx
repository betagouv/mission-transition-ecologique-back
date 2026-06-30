'use client'

import type { FC } from 'react'

/**
 * Renders nothing. Used to suppress Payload's native doc-control buttons
 * (Save Draft, Unpublish) whose behaviour is fully owned by `WorkflowActionBar`.
 */
export const WorkflowHiddenControl: FC = () => null
