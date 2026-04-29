'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

export const StepRowLabel: React.FC = () => {
  const { rowNumber } = useRowLabel<unknown>()
  return <span>Étape {(rowNumber ?? 0) + 1}</span>
}
