# Modèle des collections Programs, Operators et GeographicAreas

Spec consolidée pour l'implémentation dans PayloadCMS (post-refonte du formulaire).
Voir aussi : `docs/adr/0001-programs-collection.md` (modèle initial), `docs/adr/0005-programs-form-refactor.md` (refonte 2026-04), `docs/adr/0006-geographic-areas-collection.md`.

---

## Collection `Operators`

```
slug: 'operators'
admin.useAsTitle: 'name'
```

| Champ | Type Payload | Contraintes |
|-------|-------------|-------------|
| `name` | text | required, unique |
| `slug` | text | unique, auto-généré depuis `name` |
| `contactUrl` | text | optional |

---

## Collection `GeographicAreas`

```
slug: 'geographic-areas'
admin.useAsTitle: 'name'
admin.hidden: non super-admin
```

| Champ | Type Payload | Contraintes |
|-------|-------------|-------------|
| `name` | text | required |
| `coverageType` | select | required — `region` / `departement` / `commune` / `epci` / `autre` |
| `inseeCode` | text | optional |
| `parentArea` | relationship → `geographic-areas` | optional |

Seed initial : 18 régions + 101 départements (cf. `apps/cms/src/scripts/seed/geographic-areas/fixtures.ts`).

---

## Collection `Programs`

```
slug: 'programs'
admin.useAsTitle: 'title'
labels: { singular: 'Dispositif', plural: 'Dispositifs' }
versions: { drafts: true }
```

### Identité (en-tête de formulaire)

| Champ | Type | Contraintes |
|-------|------|-------------|
| `title` | text | required |
| `operator` | relationship → operators | required |
| `otherOperators` | relationship → operators[] | optional, hasMany |
| `url` | text | required — "Lien du dispositif" |
| `aidType` | select | required — `financement` / `pret` / `avantage-fiscal` / `formation` / `diagnostic-etude` |

### Champs conditionnels par `aidType`

| `aidType` | Champs visibles |
|---|---|
| `financement` | `fundingAmount` |
| `pret` | `loanAmount` |
| `avantage-fiscal` | `taxBenefitAmount` |
| `formation` | `formationRemainingCost`, `formationDuration` |
| `diagnostic-etude` | `studyRemainingCost`, `studyDuration` |

### Pitch

| Champ | Type | Contraintes |
|-------|------|-------------|
| `promise` | text | required |
| `description` | richText (Lexical) | required |

### Étapes pour en bénéficier

```
steps: array (RowLabel = "Étape N")
  ├─ description: text required
  └─ links: array (RowLabel = "Lien" / "Lien 2" / …)
       ├─ url: text
       └─ linkLabel: text
```

Default à la création : 3 étapes (les 2 premières contiennent un lien vide).

### Mode de contact

| Champ | Type | Contraintes |
|-------|------|-------------|
| `contactMethods` | select hasMany | `advisor` / `email` / `url` |
| `contactEmail` | email | conditionnel : si `contactMethods` ⊃ `email` |
| `contactPageUrl` | text | conditionnel : si `contactMethods` ⊃ `url` |
| `validityStart` | date | optional |
| `validityEnd` | date | optional |

### Projet

| Champ | Type | Notes |
|-------|------|-------|
| `themes` | select hasMany | `THEMES_OPTIONS` ; sert à filtrer les projets |
| `linkedProjectsCounter` | `ui` field | Affiche "[x] projets possiblement liés" en live |
| `linkedProjects` | relationship → projects[] | Liaison explicite |

### Éligibilité

| Champ | Type | Notes |
|-------|------|-------|
| `companySizes` | select hasMany | Enums : `0-9`, `10-19`, `20-49`, `50-249`, `250-499`, `500-4999`, `5000+`, `other`. Default = toutes sauf `other`. |
| `companySizeOther` | text | conditionnel : si `companySizes` ⊃ `other` |
| `geographicAreas` | relationship → geographic-areas[] | Sélection multiple |
| `geographicAreaFeedback` | text | Pour signaler une zone manquante |
| `activitySectors` | select hasMany | Enums : `all`, `agriculture`, `industrie`, `tertiaire`, `commerce`, `artisanat`, `tourisme`, `other`. Default = `[all]`. |
| `activitySectorOther` | text | conditionnel : si `activitySectors` ⊃ `other` |
| `nafCodeOther` | text | conditionnel : idem |
| `otherCriteria` | array (RowLabel = "Autres critère d'éligibilité N") | `{ value: text required }[]` |

### Informations complémentaires

| Champ | Type | Notes |
|-------|------|-------|
| `additionalInfo` | richText | ex-`longDescription` |

### Workflow & sidebar (inchangé vs ADR 0001/0004)

`slug`, `workflowStatus`, `workflowHistory`, `_status`, `assignedContributors`, `metaTitle`, `metaDescription`.

### Champs conservés en sursis (à arbitrer)

`temporarilyUnavailable` (checkbox), `selfActivatable` (select), `eligibilityData` (groupe machine-readable). Ne figurent pas dans la nouvelle spec mais sont conservés pour ne pas perdre la donnée — voir ADR 0005 §5.

---

## Mapping export → restore (legacy → new)

Voir `apps/cms/src/scripts/seed/restore/ProgramExportMapper.ts` pour le code.

| Champ ancien export | Champ nouveau | Transformation |
|---|---|---|
| `aidType: 'etude'` | `aidType: 'diagnostic-etude'` | Renommage de la valeur |
| `accompanyingCost` | `studyRemainingCost` | — |
| `accompanyingDuration` | `studyDuration` | — |
| `loanDuration` | — | dropped (pas dans la spec) |
| `longDescription` | `additionalInfo` | — |
| `illustration`, `contactUrl` (top-level) | — | dropped |
| `objectives[].description` | `steps[].description` | — |
| `objectives[].links[].url` | `steps[].links[].url` | — |
| `objectives[].links[].label` | `steps[].links[].linkLabel` | — |
| `eligibilityConditions.companySize[].value` | `companySizes` (enum) + `companySizeOther` | Match regex sur les libellés ; non-match → `other` + concat dans `companySizeOther` |
| `eligibilityConditions.activitySector[].value` | `activitySectors` (enum) + `activitySectorOther` | Idem |
| `eligibilityConditions.geographicArea[].value` | `geographicAreaFeedback` (concat) | Pas de match auto vers `geographic-areas` |
| `eligibilityConditions.activityYears[].value` | `otherCriteria[].value` | Fusion |
| `eligibilityConditions.otherCriteria[].value` | `otherCriteria[].value` | — |

Le mapping est **lossy** sur les enums (les libellés français libres ne matchent pas tous parfaitement). Les programmes dont `url` est manquant restent `_status: 'draft'` après restore (cf. publish pass dans `ProgramsRestore`).
