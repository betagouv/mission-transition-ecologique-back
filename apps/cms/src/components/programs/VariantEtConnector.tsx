'use client'

import React from 'react'
import { rowIndexFromPath } from './variantFieldPath'

interface UiFieldProps {
  path: string
}

/**
 * Black "ET" pill shown between two cumulated conditions. Purely positional: it
 * renders nothing on the first condition (index 0) and the badge from the second
 * onward, so the conditions read as a logical AND.
 */
export const VariantEtConnector: React.FC<UiFieldProps> = ({ path }) => {
  const index = rowIndexFromPath(path)
  if (!Number.isFinite(index) || index <= 0) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        margin: '0.25rem 0 0.75rem',
      }}
    >
      <span style={{ flex: 1, height: 1, backgroundColor: '#d7d7d7' }} />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: '2.25rem',
          height: '1.5rem',
          padding: '0 0.5rem',
          borderRadius: '9999px',
          backgroundColor: '#1c1c1c',
          color: '#fff',
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
        }}
      >
        ET
      </span>
      <span style={{ flex: 1, height: 1, backgroundColor: '#d7d7d7' }} />
    </div>
  )
}
