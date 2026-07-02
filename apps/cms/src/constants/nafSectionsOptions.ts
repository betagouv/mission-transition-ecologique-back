export const NAF_SECTIONS_OPTIONS = [
  { label: 'A : Agriculture, sylviculture et pêche', value: 'A' },
  { label: 'B : Industries extractives', value: 'B' },
  { label: 'C : Industrie manufacturière', value: 'C' },
  {
    label: "D : Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné",
    value: 'D',
  },
  {
    label:
      "E : Production et distribution d'eau ; assainissement, gestion des déchets et dépollution",
    value: 'E',
  },
  { label: 'F : Construction', value: 'F' },
  { label: "G : Commerce ; réparation d'automobiles et de motocycles", value: 'G' },
  { label: 'H : Transports et entreposage', value: 'H' },
  { label: 'I : Hébergement et restauration', value: 'I' },
  { label: 'J : Information et communication', value: 'J' },
  { label: "K : Activités financières et d'assurance", value: 'K' },
  { label: 'L : Activités immobilières', value: 'L' },
  { label: 'M : Activités spécialisées, scientifiques et techniques', value: 'M' },
  { label: 'N : Activités de services administratifs et de soutien', value: 'N' },
  { label: 'O : Administration publique', value: 'O' },
  { label: 'P : Enseignement', value: 'P' },
  { label: 'Q : Santé humaine et action sociale', value: 'Q' },
  { label: 'R : Arts, spectacles et activités récréatives', value: 'R' },
  { label: 'S : Autres activités de services', value: 'S' },
  { label: "T : Activités des ménages en tant qu'employeurs", value: 'T' },
  { label: 'U : Activités extra-territoriales', value: 'U' },
] as const

export type NafSection = (typeof NAF_SECTIONS_OPTIONS)[number]['value']
