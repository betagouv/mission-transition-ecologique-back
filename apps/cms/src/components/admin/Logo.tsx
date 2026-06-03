import React from 'react'

// Placeholder logo — neutral, no official branding yet.
// The definitive service logo is undecided, so we render an explicit
// "logo placeholder" until it is provided. Registered in payload.config.ts
// via `admin.components.graphics.Logo` (shown in the nav + on the login page).
export const Logo: React.FC = () => (
  <svg
    className="tee-logo"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 48"
    role="img"
    aria-label="Logo placeholder"
  >
    <rect
      x="1"
      y="1"
      width="198"
      height="46"
      fill="#f6f6f6"
      stroke="#929292"
      strokeWidth="1"
      strokeDasharray="4 3"
    />
    <text
      x="100"
      y="28"
      textAnchor="middle"
      fontFamily="Marianne, Arial, sans-serif"
      fontWeight="700"
      fontSize="15"
      letterSpacing="0.5"
      fill="#3a3a3a"
    >
      logo placeholder
    </text>
  </svg>
)
