'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

interface NumberedRowLabelProps {
  singular: string
}

export const NumberedRowLabel: React.FC<NumberedRowLabelProps> = ({ singular }) => {
  const { rowNumber } = useRowLabel<unknown>()
  return (
    <span>
      {singular} {(rowNumber ?? 0) + 1}
    </span>
  )
}
