# ADR 0003 — Collection Projects dans PayloadCMS

**Date :** 2026-03-16
**Statut :** Accepté
**Décideurs :** PO, SM, Tech Lead

> **Révision 2026-10-01 :** le §6 est remplacé et la collection reçoit des brouillons et un `canonicalId` : voir l'addendum en fin de document et l'[ADR 0014](0014-canonical-projects.md).
>
> **Révision 2026-09-28 :** le §5 est remplacé par l'[ADR 0013](0013-operator-groups-and-media.md). `image` est désormais un champ `upload` vers la collection `Media` ; le seed télécharge l'image depuis le front amont et la retrouve par `Media.sourcePath` (pas de doublon au seed suivant). La migration `20260928_150255_operator_groups_and_media` supprime l'ancienne colonne texte, les chemins étant restaurés en médias par le seed.

---

## Contexte

Le projet TEE POC Backoffice doit ingérer et exposer 83 projets thématiques (« parcours ») actuellement stockés dans `docs/sources/projects.json`. Ces projets agrègent des programmes d'aide (relation vers `Programs`) et peuvent se référencer entre eux (relation self-référentielle). L'objectif est identique à celui des programmes : import initial par seed et édition via l'interface d'administration PayloadCMS.

---

## Décisions

### 1. Collection `Projects` indépendante

**Décision :** Créer une collection `Projects` distincte de `Programs`.

**Justification :**
Les projets sont une abstraction de niveau supérieur aux programmes : ils représentent des thématiques ou des parcours (ex. « Plan d'action économies d'énergie »), pas des aides spécifiques. Leur modèle diffère significativement (thèmes, relations self-référentielles, SEO, etc.). Une collection séparée permet une gestion éditoriale autonome.

---

### 2. Relation Programs → relation Payload hasMany

**Décision :** Le champ `programs` est une relation Payload vers la collection `programs` (hasMany).

**Alternatives considérées :**
- Stocker les slugs comme tableau de texte (dénormalisé)

**Justification :**
La relation Payload garantit l'intégrité référentielle et permet de naviguer vers les fiches programmes depuis l'admin. Cohérent avec le pattern déjà établi dans `Programs` (operateur → Operators).

---

### 3. Relation self-référentielle `linkedProjects`

**Décision :** Le champ `linkedProjects` est une relation Payload vers la même collection `projects` (hasMany).

**Conséquence :** Le seed nécessite deux passes :
- Passe 1 : créer/mettre à jour tous les projets sans `linkedProjects` (pour obtenir les IDs Payload).
- Passe 2 : résoudre les IDs et mettre à jour `linkedProjects` sur chaque projet concerné.

La classe `LinkedProjectsUpdater` prend en charge cette deuxième passe.

---

### 4. Thèmes et secteurs : select enum

**Décision :** `mainTheme` (select) et `themes` (select hasMany) utilisent un enum fixe de 9 valeurs. `sectors` (select hasMany) utilise les sections NAF (A→U, 21 valeurs).

**Justification :**
Les valeurs sont stables dans le JSON source et connues à l'avance. Un `select` Payload offre un menu déroulant dans l'admin et permet le filtrage via l'API. Cohérent avec `aidType` dans Programs.

Valeurs `themes` / `mainTheme` :
- `energy` — Énergie
- `waste` — Déchets
- `mobility` — Mobilité
- `environmental` — Environnement
- `building` — Bâtiment
- `water` — Eau
- `eco-design` — Éco-conception
- `rh` — RH
- `biodiversite` — Biodiversité

---

### 5. Image comme chemin relatif (pas Media)

> ⚠️ Remplacé le 2026-09-28 par l'[ADR 0013](0013-operator-groups-and-media.md) : `image` est un upload vers `Media`.

**Décision :** Le champ `image` est un champ `text` stockant un chemin relatif (ex : `/images/projet/plan-action-eco-energie.webp`), non une relation vers la collection `Media`.

**Justification :**
Cohérent avec la décision identique prise pour `illustration` dans Programs (ADR 0001 §6). Les images sont servies statiquement depuis le frontend TEE, hors scope du POC.

---

### 6. Exclusion de `priority` et `faqs`

> ⚠️ Remplacé le 2026-10-01 par l'[ADR 0014](0014-canonical-projects.md) §5 : `priority` et `faqs` sont importés et éditables dans le CMS (voir l'addendum).

**Décision :** Les champs `priority` (objet de scores par secteur) et `faqs` (tableau de Q&A) du JSON source ne sont pas importés.

**Justification :**
- `priority` est un objet de scoring calculé dynamiquement côté frontend. Il n'a pas vocation à être édité dans le CMS.
- `faqs` représente du contenu dont la gestion éditoriale dans le scope du POC n'est pas priorisée. Une ADR dédiée sera nécessaire si ce besoin émerge.

---

### 7. Stratégie de seed : deux passes

**Décision :** Le seed de `Projects` s'effectue en deux passes distinctes via `ProjectImporter` puis `LinkedProjectsUpdater`.

**Justification :**
La relation self-référentielle `linkedProjects` requiert que tous les projets existent en base avant de pouvoir résoudre les IDs. Une seule passe ne peut pas garantir l'ordre de création. La Map `jsonId → payloadId` construite lors de la première passe permet la résolution en deuxième passe.

---

### 8. Idempotence du seed

**Décision :** Le seed est idempotent par `slug` (upsert).

**Justification :**
Cohérent avec `ProgramImporter`. Permet des ré-exécutions sans duplication.

---

## Conséquences

- Le seed de Projects doit être exécuté après le seed de Programs (pour résoudre les relations `programs`).
- `payload-types.ts` sera régénéré automatiquement après la migration de la nouvelle collection.
- Si `faqs` ou `priority` doivent être gérables dans le CMS, une ADR dédiée sera nécessaire. C'est fait : ADR 0014 (voir l'addendum ci-dessous).

---

## Addendum du 2026-10-01 : brouillons, FAQ, priorité par secteur, `canonicalId`

Décidé par l'[ADR 0014](0014-canonical-projects.md) (format pivot, persistance et API des projets), mis en œuvre par la [feature 008](../features/008-canonical-projects.md). Cet addendum ne résume que ce qui change dans la collection ; les raisons et les options écartées sont dans l'ADR 0014.

- **Brouillons** : `versions: { drafts: true }`. Un projet porte un `_status` (`draft` ou `published`) et un historique de versions. Seuls les projets publiés sont transmis au format pivot et à l'API AGIR ; un brouillon enregistré par-dessus une version publiée laisse la version publiée en ligne. Le workflow à neuf états des dispositifs (ADR 0005) n'est pas repris.
- **`canonicalId`** : identité stable du projet dans le pivot (cuid2, unique, masqué dans l'admin, verrouillé par l'API), posée par le hook `assignCanonicalId` partagé avec les dispositifs (`apps/cms/src/hooks/shared/`). Le seed impose l'identifiant dérivé du slug (`SlugCanonicalId.forProject`).
- **FAQ** (remplace le §6) : `titleFaq` (texte) et `faqs` (array : `question` texte requis, `answer` rich text requis).
- **Priorité par secteur** (remplace le §6) : `defaultPriority` (nombre facultatif) et `sectorPriorities` (array : `nafCode` texte requis, section ou code NAF validé par `NafCodeValidator` ; `priority` nombre requis). `highlightPriority` garde son rôle et son type, mais reçoit la même validation que les deux autres priorités : entier positif ou nul (`IntegerValidator.nonNegative`), comme l'exige le pivot. L'argument du §6 (« scoring calculé côté frontend ») ne tient plus dès lors que le pivot, alimenté par le CMS, doit porter cette donnée pour AGIR.
- **Hooks** : `syncProjectCanonicalOnChange` (afterChange) et `removeProjectCanonicalOnDelete` (afterDelete) tiennent le store pivot à jour, sans jamais bloquer l'écriture CMS.
- **Seed** (révise les §7 et §8) : toujours deux passes et un upsert par slug, mais `projects.json` est lu par `TeeProjectImporter` puis transformé par `CanonicalProjectToPayloadMapper` ; `ProjectMapper` et `types.ts` sont supprimés. La table de la première passe est `canonicalId → payloadId`, et non plus `jsonId → payloadId`. Les projets sont écrits publiés.
- **Migration** `20261001_092812_canonical_projects` : tables de versions, colonnes et arrays nouveaux ; les projets existants passent en `published`, reçoivent leur `canonical_id` dérivé du slug et une version publiée (sans elle, ils disparaîtraient de la liste de l'admin, qui lit les versions).
