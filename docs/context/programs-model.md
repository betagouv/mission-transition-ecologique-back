# Modèle des collections Programs, Operators, OperatorGroups et GeographicAreas

Spec consolidée pour l'implémentation dans PayloadCMS (post-refonte du formulaire).
Voir aussi : `docs/adr/0001-programs-collection.md` (modèle initial), `docs/adr/0006-programs-form-refactor.md` (refonte 2026-04 : schéma actuel + collection `GeographicAreas`), `docs/adr/0013-operator-groups-and-media.md` (groupes et logos des opérateurs).

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
| `groups` | relationship → `operator-groups` | optional, hasMany (ordre amont) ; remplacé par la liste amont à chaque seed |
| `logo` | upload → `media` | optional ; médias de type `operator-logo` seulement ; un upload manuel n'est jamais écrasé par le seed |

Logo effectif (`OperatorLogoResolver`, `apps/cms/src/services/operators/`) : logo de l'opérateur, sinon celui du premier de ses groupes qui en a un, sinon aucun. Voir `docs/adr/0013-operator-groups-and-media.md`.

---

## Collection `OperatorGroups`

```
slug: 'operator-groups'
admin.useAsTitle: 'name'
admin.hidden: non admin
écriture : super-admin
```

| Champ | Type Payload | Contraintes |
|-------|-------------|-------------|
| `name` | text | required, unique (valeur de `filterCategories` amont) |
| `slug` | text | required, unique |
| `logo` | upload → `media` | optional ; médias de type `operator-logo` seulement ; logo de secours des opérateurs du groupe |

Seed : 12 groupes issus d'`operators.json` amont ; logo par défaut pour 5 d'entre eux (`OperatorGroupLogoDefaults`), jamais posé sur un groupe qui a déjà un logo.

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
| `linkedProjectsCounter` | `ui` field | Affiche "[x] projets possiblement liés" en live, puis une étiquette cliquable par projet suggéré (ajout ou retrait dans `linkedProjects`, projets déjà liés cochés) et un bouton « Tout ajouter » |
| `linkedProjects` | relationship → projects[], `virtual: true` | Même liaison que `Projects.programs`, seule à être stockée. Lu à l'ouverture du dispositif (pas dans les listes), écrit dans les projets à chaque enregistrement, brouillon compris. Modifiable par les admins seulement, non copié à la duplication |

### Éligibilité

| Champ | Type | Notes |
|-------|------|-------|
| `companySizes` | select hasMany | Enums : `0-9`, `10-19`, `20-49`, `50-249`, `250-499`, `500-4999`, `5000+`, `other`. Default = toutes sauf `other`. |
| `companySizeOther` | text | conditionnel : si `companySizes` ⊃ `other` |
| `openToPublicAdministration` | checkbox | « Ouvert aux administrations publiques », `false` par défaut. Alimenté par `eligibilityData.company.openToPublicAdministration` de l'amont, porté dans le pivot par `eligibilite.categorie_legale.structure.autorise: ['administration_publique']` |
| `geographicCoverage` | select | `national` (aucune zone), `regional`, `departemental`, `regional-departemental` (régions entières et départements d'autres régions) |
| `geographicAreas` | relationship → geographic-areas[] | Sélection multiple, filtrée sur les niveaux de la couverture. Un département et sa région ne peuvent pas être choisis ensemble : avertissement en direct, refus à l'enregistrement hors brouillon |
| `geographicAreaFeedback` | text | Pour signaler une zone manquante |
| `activitySectors` | select hasMany | Enums : `all`, `agriculture`, `industrie`, `tertiaire`, `commerce`, `artisanat`, `tourisme`, `other`. Default = `[all]`. |
| `activitySectorOther` | text | conditionnel : si `activitySectors` ⊃ `other` |
| `nafCodeOther` | text | conditionnel : idem |
| `otherCriteria` | array (RowLabel = "Autre critère d'éligibilité N") | `{ value: text required }[]` |

### Informations complémentaires

| Champ | Type | Notes |
|-------|------|-------|
| `additionalInfo` | richText | ex-`longDescription` |

### Workflow & sidebar (inchangé vs ADR 0001/0004)

`slug`, `workflowStatus`, `workflowHistory`, `_status`, `assignedContributors`, `metaTitle`, `metaDescription`.

### Textes requis

Un champ requis rempli seulement d'espaces est refusé hors brouillon avec « Ce champ est requis. », comme un champ vide : `title`, `promise` et `otherCriteria[].value` (`RequiredTextValidator`), `description` et `steps[].description` (`RequiredRichTextValidator`, qui refuse aussi un rich text fait de paragraphes vides). `url` et `slug` avaient déjà leur validateur (`UrlValidator`, `SlugValidator`). Les champs affichés sous condition (`aidType`, `contactMethod`...) ne sont pas requis et gardent leur comportement.

### Duplication

L'action « Dupliquer » (admin, `POST /api/programs/:id/duplicate`, `payload.duplicate`) crée une copie qui **repart en `en-creation`**, donc en brouillon, quel que soit l'état de l'original (publié, archivé, remplacé, en relecture...) :

| Champ | Dans la copie |
|---|---|
| `workflowStatus`, `_status` | `en-creation`, `draft` |
| `workflowHistory` | vide, comme à une création |
| `replacedBy` | vide |
| `canonicalId` | cuid2 neuf |
| `slug` | `<slug>-copy`, puis `<slug>-copy-2`, `<slug>-copy-3`... (kebab-case, publiable tel quel) |
| `assignedContributors` | le créateur qui duplique (`assignCreatorOnCreate`), vide pour un admin |
| `operator` | celui de l'original, ou celui du créateur qui duplique |
| `lastModifiedBy` | l'utilisateur qui duplique |
| `title` | celui de l'original suffixé de « (copie) » (`assignCopyTitle`) |
| `metaTitle`, `metaDescription` | repris pour un admin, vides pour un créateur (champs réservés aux admins) |
| autres champs | repris de l'original |

Les commentaires de relecture ne suivent pas la copie (collection `review-comments`). La copie n'entre dans le pivot qu'une fois publiée par le workflow, sous son propre identifiant ; la ligne pivot de l'original n'est pas touchée. Un créateur ne peut dupliquer qu'un dispositif qu'il peut lire. Mécanique : `disableDuplicate: true` sur les champs de workflow, hook `duplicateAsDraft` (force le brouillon, donc aucune validation à la copie), hook `assignCopySlug`.

`temporarilyUnavailable` (case à cocher, sidebar, feature 005) : aide publiée mais signalée comme indisponible ; exportée en `statut_dispositif: 'temporairement_indisponible'` tant que le dispositif est publié. Alimentée par `aide temporairement indisponible: "oui"` de l'amont.

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
