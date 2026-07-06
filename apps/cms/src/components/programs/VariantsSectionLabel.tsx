'use client'

import React from 'react'

const SECTION_TITLE = "Conditions d'éligibilité variables selon le type de profil"

/**
 * Variants collapsible header: the title inherits Payload's native label styling
 * (like « Éligibilité »); only the " - facultatif" marker gets a subdued italic
 * treatment, which the native label cannot render on its own.
 */
export const VariantsSectionLabel: React.FC = () => (
  <span>
    {SECTION_TITLE}
    <span style={{ fontStyle: 'italic', fontWeight: 400, opacity: 0.7, marginLeft: '0.4rem' }}>
      - facultatif
    </span>
  </span>
)
