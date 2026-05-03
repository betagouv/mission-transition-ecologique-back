# ADR 0001 — Collections Programs, Operators et GeographicAreas

**Date initiale :** 2026-03-11
**Dernière révision :** 2026-04-29 (refonte du formulaire des dispositifs)
**Statut :** Accepté
**Décideurs :** PO, SM, Tech Lead

---

## Contexte

Le projet TEE POC Backoffice ingère et expose des dispositifs d'aide à la transition écologique (la collection `Programs` ; "dispositifs" côté métier). L'objectif est double : permettre l'édition de ces dispositifs via l'interface d'administration PayloadCMS, et exposer les données via API à un frontend public.

Cette ADR documente le modèle de données **dans son état actuel**, après la refonte du formulaire menée en avril 2026 sur la base d'une nouvelle spec produit.

---

## Décisions

### 1. Trois collections : `Programs`, `Operators`, `GeographicAreas`

- **`Operators`** : opérateurs (ADEME, BPI France, CCI…). Collection séparée pour déduplication, cohérence des noms et édition centralisée. Lien via `operator` (relationship requis) et `otherOperators` (hasMany) sur `Programs`.
- **`Programs`** : les dispositifs eux-mêmes. Voir §3 pour le détail.
- **`GeographicAreas`** : zones géographiques (régions, départements, communes, EPCI). Référencées par `Programs.geographicAreas` (hasMany) — voir §5.

### 2. Exclusion de `publicodes` du modèle CMS

Le moteur de règles métier `publicodes` (DSL YAML/JSON) reste géré hors-CMS. Sa structure est complexe et évolutive ; risque de corruption élevé via un formulaire d'admin. Le moteur de calcul d'éligibilité consomme `publicodes` depuis sa propre source de vérité.

### 3. Modèle de la collection `Programs`

Le formulaire est organisé en sections (collapsibles Payload) qui suivent la spec métier.

#### En-tête

| Champ | Type | Contraintes |
|---|---|---|
| `title` | text | required — "Titre" |
| `operator` | relationship → operators | required — "Opérateur principal" |
| `otherOperators` | relationship → operators[] | hasMany — "Autres opérateurs" |
| `url` | text | required — "Lien du dispositif" |
| `aidType` | select | required — `financement` / `pret` / `avantage-fiscal` / `formation` / `diagnostic-etude` |

Champs conditionnels par `aidType` (montants/durées spécifiques) :

| `aidType` | Champs visibles |
|---|---|
| `financement` | `fundingAmount` |
| `pret` | `loanAmount` |
| `avantage-fiscal` | `taxBenefitAmount` |
| `formation` | `formationRemainingCost`, `formationDuration` |
| `diagnostic-etude` | `studyRemainingCost`, `studyDuration` |

Pitch : `promise` (text required), `description` (richText required).

#### Section "Étapes pour en bénéficier"

```
steps: array (RowLabel = "Étape N")
  ├─ description: text required
  └─ links: array (RowLabel = "Lien" / "Lien 2" / …)
       ├─ url: text
       └─ linkLabel: text
```

Default à la création : 3 étapes, dont les 2 premières contiennent un lien vide.

#### Section "Mode de contact"

| Champ | Type | Notes |
|---|---|---|
| `contactMethods` | select hasMany | `advisor` / `email` / `url` |
| `contactEmail` | email | conditionnel — affiché si `contactMethods` ⊃ `email` |
| `contactPageUrl` | text | conditionnel — affiché si `contactMethods` ⊃ `url` |

Puis hors section, à la racine : `validityStart`, `validityEnd` (date, optional).

#### Section "Projet"

| Champ | Type | Notes |
|---|---|---|
| `themes` | select hasMany | `THEMES_OPTIONS` ; sert à filtrer les projets associables |
| `linkedProjectsCounter` | `type: 'ui'` | Compteur live "[x] projets possiblement liés à ce dispositif" |
| `linkedProjects` | relationship → projects[] | Liaison explicite |

#### Section "Éligibilité"

| Champ | Type | Notes |
|---|---|---|
| `companySizes` | select hasMany | Enums : `0-9` … `5000+` + `other`. Default = toutes sauf `other`. |
| `companySizeOther` | text | conditionnel si `companySizes` ⊃ `other` |
| `geographicAreas` | relationship → geographic-areas[] | Voir §5 |
| `geographicAreaFeedback` | text | Pour signaler une zone manquante |
| `activitySectors` | select hasMany | Enums : `all`, `agriculture`, `industrie`, `tertiaire`, `commerce`, `artisanat`, `tourisme`, `other`, `naf-code`. Default = `[all]`. |
| `activitySectorOther` | text | conditionnel si `activitySectors` ⊃ `other` |
| `nafCodeOther` | text | conditionnel si `activitySectors` ⊃ `naf-code` |
| `otherCriteria` | array (RowLabel = "Autres critère d'éligibilité N") | `{ value: text required }[]` |

Puis `additionalInfo` (richText) — "Informations complémentaires".

#### Sidebar / workflow

`slug`, `workflowStatus`, `workflowHistory`, `_status`, `assignedContributors`, `metaTitle`, `metaDescription`. Voir ADR 0004 pour le workflow éditorial.

#### Section "Champs à arbitrer"

Section collapsible (repliée par défaut) regroupant les champs hérités qui ne figurent plus dans la spec produit mais restent en BDD pour permettre une décision PO future :

| Champ | Type | Notes |
|---|---|---|
| `temporarilyUnavailable` | checkbox | Default `false` |
| `selfActivatable` | select `oui` / `non` | |
| `excludeMicroentrepreneur` | checkbox | Default `false` — extrait de l'ancien groupe `eligibilityData.company` pour réduire la profondeur visuelle |

### 4. Le formulaire est dérivé du schéma — comment plier la forme

PayloadCMS génère simultanément le formulaire admin, le schéma SQL et les types TypeScript à partir du tableau `fields` de la collection. On ne sépare donc pas "formulaire" et "données". Pour obtenir une ergonomie spécifique sans dédoubler le modèle :

- `type: 'collapsible'` pour les sections.
- `admin.condition` pour l'affichage conditionnel.
- `admin.description` pour les exemples sous chaque champ.
- `type: 'ui'` pour les composants purement visuels (`LinkedProjectsCounter`).
- `admin.components.RowLabel` pour les labels de lignes auto-numérotés (`StepRowLabel`, `LinkRowLabel`, `OtherCriterionRowLabel`).

Tous les composants custom vivent dans `apps/cms/src/components/programs/`.

### 5. Collection `GeographicAreas`

Les valeurs des zones géographiques étaient autrefois en texte libre, ce qui empêchait tout filtrage/scoring fiable. Une collection dédiée centralise les zones de référence.

| Champ | Type | Notes |
|---|---|---|
| `name` | text required | Nom officiel |
| `coverageType` | select required | `region` / `departement` / `commune` / `epci` / `autre` |
| `inseeCode` | text | Code INSEE officiel |
| `parentArea` | relationship → geographic-areas | Hiérarchie (commune → EPCI → département → région) |

**Seed initial** : 18 régions + 101 départements (codes INSEE officiels) — fixtures dans le code de seed. Les communes (~35 000) et EPCI (~1 240) ne sont pas seedés au POC : volume trop important, ajout à la demande par les admins.

Visibilité : `hidden: true` sauf super-admin. C'est de la donnée de référence, pas un objet métier édité au quotidien.

### 6. Modèle d'éligibilité simplifié

L'ancien double modèle (`eligibilityConditions` texte + `eligibilityData` machine-readable) est remplacé par des champs typés directement (enums, relations, arrays). Ce qui ne rentre pas dans les enums (libellés libres reçus du métier) est capturé dans des champs `*Other` jumeaux. Ce design supprime la duplication au prix d'une exigence : les nouvelles entrées doivent être mappées sur les enums dès la saisie.

Le seul rescapé du groupe `eligibilityData` est `excludeMicroentrepreneur`, désormais champ booléen à plat dans la section "Champs à arbitrer" (cf. §3) — sera tranché lorsque le moteur de scoring sera réintégré.

### 7. Cycle de vie éditorial

Cf. ADR 0004 pour le détail. En résumé : `versions: { drafts: true }` natif Payload + champ `workflowStatus` séparé qui pilote `_status` via le hook `beforeChangeWorkflow`. La validation des transitions est centralisée dans `WorkflowTransitionPolicy`.

### 8. Champs Date natifs Payload

`validityStart`, `validityEnd` utilisent le type `date` de Payload pour bénéficier du date-picker admin et des requêtes par plage.

---

## Conséquences

- `payload-types.ts` est régénéré automatiquement par Payload au build/dev — ne pas modifier manuellement.
- L'ancien JSON source (`docs/sources/programs.json`) n'est plus la référence : son shape est obsolète. Le seed canonique du POC est à reconstruire (cf. README de la PR de refacto pour les outils de migration utilisés une fois).
- Si `publicodes` doit un jour être éditable dans le CMS, une ADR dédiée devra évaluer l'approche (JSON Editor custom, champ code, etc.).
- Le couple `companySizes` + `companySizeOther` (et symétrique pour `activitySectors`) doit être pris en compte par tout consommateur API : un dispositif "tagué" peut avoir des contraintes en plus dans le champ texte libre.
