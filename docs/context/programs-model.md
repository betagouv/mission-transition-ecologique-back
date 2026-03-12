# Modèle des collections Programs et Operators

Spec consolidée pour l'implémentation dans PayloadCMS.
Voir aussi : `docs/adr/0001-programs-collection.md`

---

## Collection `Operators`

```
slug: 'operators'
admin.useAsTitle: 'name'
```

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `name` | text | required, unique | `opérateur de contact` / `autres opérateurs[]` |
| `slug` | text | unique, auto-généré depuis name | — |
| `contactUrl` | text | optional | — |

---

## Collection `Programs`

```
slug: 'programs'
admin.useAsTitle: 'title'
```

### Identité

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `slug` | text | required, unique | `id` |
| `title` | text | required | `titre` |
| `promise` | text | required | `promesse` |
| `aidType` | select | required | `nature de l'aide` |

Valeurs `aidType` :
- `etude` ← `"étude"`
- `financement` ← `"financement"`
- `formation` ← `"formation"`
- `pret` ← `"prêt"`
- `avantage-fiscal` ← `"avantage fiscal"`

### Contenu

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `description` | richText | required | `description` |
| `longDescription` | richText | optional | `description longue` |

### Relations

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `operator` | relationship → Operators | required | `opérateur de contact` |
| `otherOperators` | relationship → Operators[] | optional, hasMany | `autres opérateurs` |
| `illustration` | text | optional | `illustration` (chemin relatif) |

### Contact & URL

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `contactUrl` | text | required | `contact question` |
| `url` | text | optional | `url` |

### Validité

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `validityStart` | date | optional | `début de validité` (conv. DD/MM/YYYY → ISO) |
| `validityEnd` | date | optional | `fin de validité` (conv. DD/MM/YYYY → ISO) |
| `temporarilyUnavailable` | checkbox | — | `aide temporairement indisponible` |

### Financier (conditionnel selon aidType)

| Champ | Type Payload | Contraintes | Affiché pour |
|-------|-------------|-------------|-------------|
| `fundingAmount` | text | optional | financement |
| `accompanyingCost` | text | optional | étude |
| `accompanyingDuration` | text | optional | étude |
| `loanAmount` | text | optional | pret |
| `loanDuration` | text | optional | pret |
| `taxBenefitAmount` | text | optional | avantage-fiscal |

Source JSON : `montant du financement`, `coût de l'accompagnement`, `durée de l'accompagnement`, `montant du prêt`, `durée du prêt`, `montant de l'avantage fiscal`

### Autonomie

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `selfActivatable` | select | optional | `activable en autonomie` |

Valeurs : `oui` | `non`

### Objectifs

```
objectives: array
  └─ description: text (required)
  └─ links: array
       ├─ url: text
       └─ label: text
```

Source JSON : `objectifs[].description`, `objectifs[].liens[].lien`, `objectifs[].liens[].texte`

### Éligibilité — texte lisible

```
eligibilityConditions: group
  ├─ companySize: array → { value: text }
  ├─ geographicArea: array → { value: text }
  ├─ activitySector: array → { value: text }
  ├─ activityYears: array → { value: text }
  └─ otherCriteria: array → { value: text }
```

Source JSON : `conditions d'éligibilité` → `taille de l'entreprise`, `secteur géographique`, `secteur d'activité`, `nombre d'années d'activité`, `autres critères d'éligibilité`

### Éligibilité — structurée machine

```
eligibilityData: group
  ├─ company: group
  │    ├─ allowedNafSections: array → { value: text }
  │    ├─ minEmployees: number (optional)
  │    ├─ maxEmployees: number (optional)
  │    └─ excludeMicroentrepreneur: checkbox
  ├─ validityStart: date (optional)
  ├─ validityEnd: date (optional)
  └─ priorityObjectives: array → { value: text }
```

Source JSON : `eligibilityData.company`, `eligibilityData.validity.start/end`, `eligibilityData.priorityObjectives`

Note : dans le JSON source, `minEmployees` est parfois une string (`"50"`) — conversion en number lors du seed.

### SEO (~6% des programmes)

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `metaTitle` | text | optional | `metaTitre` |
| `metaDescription` | textarea | optional | `metaDescription` |

---

## Mapping complet JSON → Payload

| Clé JSON | Champ Payload | Transformation |
|----------|--------------|----------------|
| `id` | `slug` | — |
| `titre` | `title` | — |
| `promesse` | `promise` | — |
| `nature de l'aide` | `aidType` | `étude`→`etude`, `prêt`→`pret`, `avantage fiscal`→`avantage-fiscal` |
| `description` | `description` | Texte → lexical richText |
| `description longue` | `longDescription` | Texte → lexical richText |
| `opérateur de contact` | `operator` | Nom → ID Operator |
| `autres opérateurs` | `otherOperators` | Noms[] → IDs Operators |
| `illustration` | `illustration` | — |
| `contact question` | `contactUrl` | — |
| `url` | `url` | — |
| `début de validité` | `validityStart` | DD/MM/YYYY → ISO 8601 |
| `fin de validité` | `validityEnd` | DD/MM/YYYY → ISO 8601 |
| `aide temporairement indisponible` | `temporarilyUnavailable` | `"oui"` → `true` |
| `montant du financement` | `fundingAmount` | — |
| `coût de l'accompagnement` | `accompanyingCost` | — |
| `durée de l'accompagnement` | `accompanyingDuration` | — |
| `montant du prêt` | `loanAmount` | — |
| `durée du prêt` | `loanDuration` | — |
| `montant de l'avantage fiscal` | `taxBenefitAmount` | — |
| `activable en autonomie` | `selfActivatable` | — |
| `objectifs[].description` | `objectives[].description` | — |
| `objectifs[].liens[].lien` | `objectives[].links[].url` | — |
| `objectifs[].liens[].texte` | `objectives[].links[].label` | — |
| `conditions d'éligibilité.taille de l'entreprise` | `eligibilityConditions.companySize` | String[] → `{value}[]` |
| `conditions d'éligibilité.secteur géographique` | `eligibilityConditions.geographicArea` | String[] → `{value}[]` |
| `conditions d'éligibilité.secteur d'activité` | `eligibilityConditions.activitySector` | String[] → `{value}[]` |
| `conditions d'éligibilité.nombre d'années d'activité` | `eligibilityConditions.activityYears` | String[] → `{value}[]` |
| `conditions d'éligibilité.autres critères d'éligibilité` | `eligibilityConditions.otherCriteria` | String[] → `{value}[]` |
| `eligibilityData.company.allowedNafSections` | `eligibilityData.company.allowedNafSections` | String[] → `{value}[]` |
| `eligibilityData.company.minEmployees` | `eligibilityData.company.minEmployees` | String → number |
| `eligibilityData.company.maxEmployees` | `eligibilityData.company.maxEmployees` | String → number |
| `eligibilityData.company.excludeMicroentrepreneur` | `eligibilityData.company.excludeMicroentrepreneur` | boolean |
| `eligibilityData.validity.start` | `eligibilityData.validityStart` | DD/MM/YYYY → ISO 8601 |
| `eligibilityData.validity.end` | `eligibilityData.validityEnd` | DD/MM/YYYY → ISO 8601 |
| `eligibilityData.priorityObjectives` | `eligibilityData.priorityObjectives` | String[] → `{value}[]` |
| `metaTitre` | `metaTitle` | — |
| `metaDescription` | `metaDescription` | — |
