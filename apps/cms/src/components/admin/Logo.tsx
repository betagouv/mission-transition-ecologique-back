import React from 'react'

export const Logo: React.FC = () => (
  <div className="tee-logo">
    <div className="tee-logo__republic">
      <span className="tee-logo__republic-line">République</span>
      <span className="tee-logo__republic-line">Française</span>
    </div>
    <div className="tee-logo__separator" aria-hidden="true" />
    <div className="tee-logo__service">
      <span className="tee-logo__service-name">Transition Écologique</span>
      <span className="tee-logo__service-name">des Entreprises</span>
      <span className="tee-logo__service-ministry">
        Ministère de la Transition écologique
      </span>
    </div>
  </div>
)
