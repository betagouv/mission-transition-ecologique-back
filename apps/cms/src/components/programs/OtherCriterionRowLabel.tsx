'use client'

import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

export const OtherCriterionRowLabel: React.FC = () => {
  const { rowNumber } = useRowLabel<unknown>()
  return <span>Autres critère d&apos;éligibilité {(rowNumber ?? 0) + 1}</span>
}
