'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

export const LinkRowLabel: React.FC = () => {
  const { rowNumber } = useRowLabel<unknown>()
  const index = rowNumber ?? 0
  return <span>{index === 0 ? 'Lien' : `Lien ${index + 1}`}</span>
}
