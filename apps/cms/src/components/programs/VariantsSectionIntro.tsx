'use client'

import React from 'react'

const introStyle: React.CSSProperties = {
  marginBottom: '1rem',
  padding: '0.85rem 1rem',
  backgroundColor: '#f3eefc',
  border: '1px solid #e0d4f7',
  borderRadius: '6px',
}

/**
 * Intro banner at the top of the variants section. The native collapsible
 * renders its description at the bottom and offers no distinct subtitle, so the
 * "Les variantes" heading and its paragraph are rendered here on a purple block,
 * matching the maquette.
 */
export const VariantsSectionIntro: React.FC = () => (
  <div style={introStyle}>
    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Les variantes</div>
    <p style={{ margin: 0, color: '#555', fontSize: '0.875rem', lineHeight: 1.5 }}>
      Les variantes permettent d&apos;adapter automatiquement certains champs du dispositif selon
      le profil de l&apos;entreprise (taille, zone géographique), sans dupliquer le dispositif
      entier.
    </p>
  </div>
)
