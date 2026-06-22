# ADR 0006 — Refonte du formulaire des dispositifs et collection `GeographicAreas`

**Date :** 2026-05-04
**Statut :** Accepté
**Décideurs :** PO, Tech Lead
**Supersede :** [ADR 0001 — Collection Programs](0001-programs-collection.md) (sections schéma — § Modèle d'éligibilité, Cycle de vie éditorial conservés)

---

## Contexte

L'ADR 0001 a fixé le schéma initial de la collection `Programs`, calé sur la structure JSON de `docs/sources/programs.json` héritée du POC. Ce schéma s'est révélé inadapté à l'usage métier :

- Champs alignés sur le format d'export (`accompanyingCost`, `accompanyingDuration`, `loanDuration`, `objectives`, `eligibilityConditions`, `eligibilityData`) au lieu d'être pensés pour la saisie par un opérateur.
- Pas de séparation visuelle dans le formulaire admin — tous les champs à plat, ce qui rend l'édition de 234 dispositifs difficile.
- Pas de modèle structuré pour les zones géographiques : ancien `eligibilityConditions.geographicArea` en texte libre, sans cohérence inter-dispositifs.
- Pas d'aide à la saisie (compteurs, labels de lignes, conditionnels par type d'aide).

Une nouvelle spec produit (avril 2026) a redéfini le formulaire. Cet ADR documente la refonte effectuée.

---

## Décisions

### 1. Réorganisation du formulaire en sections collapsibles

**Décision :** Le formulaire `Programs` est restructuré en sections via le type `collapsible` de Payload, dans cet ordre :

| Section | Contenu |
|---|---|
| **Sidebar** | `slug`, workflow (cf. ADR 0005), `_status`, `assignedContributors`, `metaTitle`, `metaDescription` |
| **Main** (à plat) | `title`, `operator`, `otherOperators`, `url`, `aidType` + montants/durées conditionnels, `promise`, `description` |
| Étapes pour en bénéficier | `steps[]` (array de `{ description, links[] }`) |
| Mode de contact | `contactMethods` (multi), `contactEmail` / `contactPageUrl` (conditionnels), `validityStart`, `validityEnd` |
| Projet | `themes` (multi), `linkedProjectsCounter` (UI), `linkedProjects` |
| Éligibilité | `companySizes` + `companySizeOther`, `geographicAreas` (relation) + `geographicAreaFeedback`, `activitySectors` + `activitySectorOther` + `nafCodeOther`, `otherCriteria[]` |
| `additionalInfo` (richText) | hors section, juste après Éligibilité |

**Justification :**
- Les sections collapsibles guident l'éditeur dans une saisie séquentielle (header → étapes → contact → projet → éligibilité).
- Les champs à plat de l'ancien schéma sont conservés à l'identique de leur usage métier réel quand ils restent pertinents (`fundingAmount`, `loanAmount`, etc.) — voir §3.
- Les champs hérités `temporarilyUnavailable`, `selfActivatable` et `excludeMicroentrepreneur` (anciennement regroupés dans une section « Champs à arbitrer ») sont supprimés du schéma — décision PO actée, leur utilité n'a pas été confirmée.

---

### 2. Nouveau type d'aide `diagnostic-etude` (remplace `etude`)

**Décision :** Renommer la valeur de `aidType` `etude` → `diagnostic-etude`, et faire passer `aidType` à 5 valeurs :

| Valeur | Label |
|---|---|
| `financement` | Financement |
| `pret` | Prêt |
| `avantage-fiscal` | Avantage fiscal |
| `formation` | Formation |
| `diagnostic-etude` | Diagnostic ou étude |

Chaque valeur active des champs de montant/durée spécifiques :

| `aidType` | Champs visibles |
|---|---|
| `financement` | `fundingAmount` |
| `pret` | `loanAmount` |
| `avantage-fiscal` | `taxBenefitAmount` |
| `formation` | `formationRemainingCost`, `formationDuration` |
| `diagnostic-etude` | `studyRemainingCost`, `studyDuration` |

**Justification :** Le terme `étude` seul est ambigu (audit, diagnostic, étude technique). `diagnostic-etude` correspond à l'intitulé produit. Les champs `accompanyingCost` / `accompanyingDuration` / `loanDuration` de l'ancien schéma sont supprimés au profit de paires explicites par type d'aide.

---

### 3. Nouvelle collection `GeographicAreas`

**Décision :** Créer une collection dédiée `geographic-areas` (slug Payload), référencée par `Programs.geographicAreas` (`relationship`, `hasMany`).

**Schéma :**

| Champ | Type | Contraintes |
|---|---|---|
| `name` | text | required |
| `coverageType` | select | required — `region` / `departement` / `commune` / `epci` / `autre` |
| `inseeCode` | text | optional — code INSEE officiel |
| `parentArea` | relationship → geographic-areas | hiérarchie (commune → EPCI → département → région) |

**Accès :** collection masquée dans l'admin sauf pour `super-admin` (`admin.hidden`). L'édition centralisée évite la dérive des libellés.

**Seed :** `apps/cms/src/scripts/seed/geographic-areas/` — 18 régions + 101 départements (fixtures avec code INSEE et lien `parentArea`). Lancé via `pnpm seed`.

**Champ de feedback :** `geographicAreaFeedback` (text libre) sur `Programs` permet à l'éditeur de signaler une zone manquante sans bloquer la saisie.

**Justification :** Remplace l'ancien `eligibilityConditions.geographicArea` en texte libre. Permet de filtrer les dispositifs par zone côté frontend, et de garantir la cohérence des libellés.

---

### 4. Composants admin custom pour la saisie

**Décision :** Deux composants React injectés dans `admin.components` :

| Composant | Rôle |
|---|---|
| `NumberedRowLabel` | Auto-numérote les lignes d'un `array` Payload (ex : "Étape 1", "Lien 2", "Autre critère d'éligibilité 3"). Le libellé singulier est passé en `clientProps.singular` côté field config — un seul composant pour les trois usages (`steps`, `steps.links`, `otherCriteria`). |
| `LinkedProjectsCounter` | Champ `type: 'ui'` qui affiche en live le nombre de projets matchant les `themes` sélectionnés (avant que l'éditeur ne choisisse `linkedProjects`) |

**Justification :** Sans `NumberedRowLabel`, les arrays Payload affichent des labels génériques ("Item 1") qui rendent la relecture pénible. La factorisation via `clientProps` évite la prolifération de composants thin-wrapper. `LinkedProjectsCounter` aide l'éditeur à anticiper la liste de projets à lier sans avoir à ouvrir un autre onglet.

---

### 5. Modèle d'éligibilité — consolidation autour de champs structurés

**Décision :** Suppression du double modèle `eligibilityConditions` (texte) + `eligibilityData` (structuré) introduit par l'ADR 0001. Les critères deviennent des champs typés directement éditables :

| Avant (ADR 0001) | Après |
|---|---|
| `eligibilityConditions.companySize: string[]` (texte libre) | `companySizes: select hasMany` (enum) + `companySizeOther` (texte conditionnel) |
| `eligibilityConditions.geographicArea: string[]` | `geographicAreas: relationship → geographic-areas` + `geographicAreaFeedback` |
| `eligibilityConditions.activitySector: string[]` | `activitySectors: select hasMany` + `activitySectorOther` + `nafCodeOther` |
| `eligibilityConditions.activityYears: string[]` | fusionné dans `otherCriteria[]` |
| `eligibilityConditions.otherCriteria: string[]` | `otherCriteria: array of { value: text }` |
| `eligibilityData.company.allowedNafSections` | retiré — couvert par `activitySectors` + `nafCodeOther` |
| `eligibilityData.company.minEmployees` / `maxEmployees` | retiré — couvert par `companySizes` |
| `eligibilityData.validity.start` / `end` | déplacé dans la section "Mode de contact" comme `validityStart` / `validityEnd` (proches de la saisie de contact) |
| `eligibilityData.priorityObjectives` | retiré — non utilisé en pratique |
| `eligibilityData.company.excludeMicroentrepreneur` | retiré — décision PO actée |

**Justification :** Le double modèle de l'ADR 0001 supposait deux cycles de vie distincts (texte humain vs. données machine). En pratique, l'éditeur saisissait deux fois la même information avec des risques de désync. Des enums + champs `*Other` conditionnels couvrent les deux usages — l'enum est lisible humainement *et* exploitable programmatiquement.

---

### 6. Conséquences sur le seed

`ProgramMapper` (et `ProjectMapper`, inchangé) sont adaptés au nouveau schéma. `pnpm seed` orchestre désormais : `GeographicAreasSeed` → `ProgramsSeed` (operators + programs depuis `docs/sources/programs.json`) → `ProjectsSeed` (depuis `docs/sources/projects.json`) → `UsersSeed`.

Mapping legacy `programs.json` → nouveau schéma — perte assumée :

- `nature de l'aide` "étude" → `aidType: 'diagnostic-etude'`. Les champs `coût/durée de l'accompagnement` sont aiguillés vers `formationRemainingCost`/`formationDuration` ou `studyRemainingCost`/`studyDuration` selon `aidType`.
- `objectifs[].liens[]` → `steps[].links[]` (renommage `lien` → `url`, `texte` → `linkLabel`).
- `contact question` parsée : `mailto:` → `contactMethods: ['email']` + `contactEmail` ; URL HTTP → `contactMethods: ['url']` + `contactPageUrl`.
- Libellés libres `taille de l'entreprise` / `secteur d'activité` matchés via regex sur les nouveaux enums (`COMPANY_SIZE_KEYWORDS` / `ACTIVITY_SECTOR_KEYWORDS` dans `ProgramMapper.ts`), fallback dans `*Other`.
- `secteur géographique` (texte) reporté dans `geographicAreaFeedback` ; la relation `geographicAreas` reste à recâbler manuellement par l'éditeur.
- `nombre d'années d'activité` fusionné dans `otherCriteria`.
- `aide temporairement indisponible`, `activable en autonomie`, `eligibilityData.company.excludeMicroentrepreneur` : ignorés (champs retirés du schéma — décision PO).
- `illustration`, `eligibilityData.company.allowedNafSections / minEmployees / maxEmployees`, `eligibilityData.priorityObjectives`, `publicodes` : ignorés (non couverts par le nouveau schéma).
- Le seed ne publie un dispositif (`_status: published`, `workflowStatus: publie`) que si son `url` principal **et** tous ses liens d'étapes sont valides (`UrlValidator.isValid`, appelé dans `ProgramMapper`) ; sinon il reste en draft / `en-creation`. Cela rend visibles à l'éditeur les dispositifs sans `url` source comme ceux dont un lien est cassé (ex : `file:///` ou URL imbriquée dans la source), pour complétion manuelle via l'admin. Le seed écrit en `draft: true`, donc la validation des champs n'est pas levée à l'import : c'est ce calcul de statut qui assure la visibilité.

Le seed reste idempotent (upsert par `slug`) — relancer `pnpm seed` après une mise à jour des sources ne crée pas de doublons.

Les outils one-shot d'export/restore depuis l'ancienne base (utilisés pendant la phase de migration) restent dans `local/PR-program-refacto/scripts/` (gitignored). Voir `local/PR-program-refacto/README.md`.

### 7. Ajustements UX/UI (ticket #6, PR 1)

**Décision :** Affiner la saisie du formulaire suite aux retours produit de la semaine du 15 juin.

- **Dates de validité** (`validityStart` / `validityEnd`) : `displayFormat: 'dd/MM/yyyy'` ajouté pour afficher l'année au format JJ/MM/AAAA.
- **Étapes** : `steps[].description` passe de `text` à `richText` (saisie multiligne et enrichie). Le seed convertit la source via `convertMarkdownToLexical` (`ProgramMapper.toRichText`).
- **Étapes, liens** : ordre des sous-champs inversé, `linkLabel` (Titre du lien) avant `url`.
- **Validation des URL** : `UrlValidator.validate` (`src/utils/UrlValidator.ts`, basé sur zod) appliqué au lien principal `url` et aux liens d'étapes `steps[].links[].url`. Schémas autorisés : `http:`, `https:` et `mailto:` (les liens de contact des étapes sont des `mailto:`) ; les autres schémas (`ftp:`, `javascript:`…) sont rejetés. Pour `http(s)`, l'hôte doit être réel (`localhost` ou un domaine avec point), ce qui écarte les chemins `file:///` collés derrière `https://` (parsés avec l'hôte `file`). Valeur vide tolérée, espaces de bord ignorés via `trim`.
- **Projets liés** (`linkedProjects`) : `admin.sortOptions: 'title'` (liste alphabétique de tous les projets, sans filtrage par thématique) et `admin.allowCreate: false` (le workflow projet reste séparé du workflow dispositif).
- **SEO** (`metaTitle` / `metaDescription`) : réservé aux administrateurs sur deux niveaux complémentaires : `admin.condition` masque les champs en UI pour le rôle `creator`, et `access.create` / `access.update` (`UserRole.isAdmin`) verrouillent l'écriture côté API, la condition ne protégeant que l'affichage. Même pattern que `assignedContributors` et `_status`.
- **Typographie richText** : règle CSS dans `dsfr-fields.scss` forçant Marianne (`--tee-font-family-sans`) sur l'éditeur Lexical, pour l'aligner sur les autres champs.

---

## Conséquences

- L'ADR 0001 reste la référence pour les décisions encore valides (deux collections `Programs` + `Operators`, exclusion de `publicodes`, type `date` natif Payload, cycle de vie via `versions/drafts`). Ses sections sur le double modèle d'éligibilité et le schéma de champs sont remplacées par cet ADR.
- Les composants `*RowLabel` et `LinkedProjectsCounter` sont spécifiques à ce formulaire — ne pas les généraliser sans ADR.
