'use client'

import React from 'react'

const SECTION_TITLE = "Conditions d'éligibilité variables selon le type de profil"

/**
 * Custom header for the variants collapsible: the native label renders neither
 * the italic " - facultatif" suffix nor the purple accent the maquette asks for,
 * so the title is rebuilt here with the optional marker spelled out.
 */
export const VariantsSectionLabel: React.FC = () => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: '0.4rem',
      color: '#4c2f92',
      fontWeight: 600,
    }}
  >
    {SECTION_TITLE}
    <span style={{ fontStyle: 'italic', fontWeight: 400, color: '#7a6aa8' }}>- facultatif</span>
  </span>
)
