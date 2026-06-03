import React from 'react'

// Placeholder square icon — neutral, no official branding yet.
// Registered in payload.config.ts via `admin.components.graphics.Icon`
// (small icon shown in the admin nav). The browser-tab favicon is set
// separately through `admin.meta.icons` (see public/favicon.svg).
export const Icon: React.FC = () => (
  <svg
    className="tee-icon"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
    role="img"
    aria-label="Logo placeholder"
  >
    <rect
      x="1"
      y="1"
      width="30"
      height="30"
      fill="#f6f6f6"
      stroke="#929292"
      strokeWidth="1"
      strokeDasharray="3 2"
    />
    <text
      x="16"
      y="21"
      textAnchor="middle"
      fontFamily="Marianne, Arial, sans-serif"
      fontWeight="700"
      fontSize="12"
      letterSpacing="0.5"
      fill="#3a3a3a"
    >
      LP
    </text>
  </svg>
)
