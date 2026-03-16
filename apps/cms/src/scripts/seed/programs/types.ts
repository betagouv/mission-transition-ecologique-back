export interface SourceObjective {
  description: string
  liens?: Array<{ lien: string; texte?: string }>
}

export interface SourceEligibilityConditions {
  'taille de l\'entreprise'?: string[]
  'secteur géographique'?: string[]
  'secteur d\'activité'?: string[]
  "nombre d'années d'activité"?: string[]
  "autres critères d'éligibilité"?: string[]
}

export interface SourceEligibilityData {
  company?: {
    allowedNafSections?: string[]
    minEmployees?: string | number
    maxEmployees?: string | number
    excludeMicroentrepreneur?: boolean
  }
  validity?: {
    start?: string
    end?: string
  }
  priorityObjectives?: string[]
}

export interface SourceProgram {
  id: string
  titre: string
  promesse: string
  "nature de l'aide": string
  description: string
  'description longue'?: string
  'opérateur de contact': string
  'autres opérateurs'?: string[]
  illustration?: string
  'contact question': string
  url?: string
  'début de validité'?: string
  'fin de validité'?: string
  'aide temporairement indisponible'?: string
  'montant du financement'?: string
  "coût de l'accompagnement"?: string
  "durée de l'accompagnement"?: string
  'montant du prêt'?: string
  'durée du prêt'?: string
  "montant de l'avantage fiscal"?: string
  'activable en autonomie'?: string
  objectifs?: SourceObjective[]
  "conditions d'éligibilité"?: SourceEligibilityConditions
  eligibilityData?: SourceEligibilityData
  metaTitre?: string
  metaDescription?: string
}
