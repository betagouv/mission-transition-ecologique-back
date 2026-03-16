# ADR 0003 — Collection Projects dans PayloadCMS

**Date :** 2026-03-16
**Statut :** Accepté
**Décideurs :** PO, SM, Tech Lead

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

**Décision :** Le champ `image` est un champ `text` stockant un chemin relatif (ex : `/images/projet/plan-action-eco-energie.webp`), non une relation vers la collection `Media`.

**Justification :**
Cohérent avec la décision identique prise pour `illustration` dans Programs (ADR 0001 §6). Les images sont servies statiquement depuis le frontend TEE, hors scope du POC.

---

### 6. Exclusion de `priority` et `faqs`

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
- Si `faqs` ou `priority` doivent être gérables dans le CMS, une ADR dédiée sera nécessaire.
