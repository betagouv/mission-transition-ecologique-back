# ADR 0001 — Collection Programs dans PayloadCMS

**Date :** 2026-03-11
**Statut :** Accepté
**Décideurs :** PO, SM, Tech Lead

---

## Contexte

Le projet TEE POC Backoffice doit ingérer et exposer 234 programmes d'aide à la transition écologique, actuellement stockés dans `docs/sources/programs.json`. L'objectif est double : importer les données existantes (seed initial) et permettre leur édition via l'interface d'administration PayloadCMS.

---

## Décisions

### 1. Deux collections distinctes : `Programs` + `Operators`

**Décision :** Créer une collection `Operators` séparée de `Programs`, liée par une relation Payload.

**Alternatives considérées :**
- Collection plate (opérateur comme simple champ texte dans Programs)
- Collection plate avec duplication des données opérateur

**Justification :**
Le JSON source contient ~40 opérateurs distincts référencés par plusieurs programmes. Une collection dédiée permet la déduplication, la cohérence des noms, et l'édition centralisée d'un opérateur (URL de contact, nom canonique). La relation Payload garantit l'intégrité référentielle.

---

### 2. Exclusion de `publicodes` du modèle CMS

**Décision :** Le champ `publicodes` du JSON source n'est pas importé dans PayloadCMS.

**Justification :**
- `publicodes` est un moteur de règles métier (DSL YAML/JSON) géré par une équipe dédiée et un outillage spécifique.
- Sa structure est complexe, évolutive, et non adaptée à l'édition manuelle dans un formulaire CMS.
- Le moteur de calcul d'éligibilité consomme `publicodes` depuis sa propre source de vérité — le CMS n'est pas cette source.
- Risque élevé de corruption si édité via l'admin Payload.

**Conséquence :** Les règles `publicodes` restent dans le fichier JSON source ou dans un système dédié. Le CMS stocke uniquement `eligibilityData`, qui est la représentation structurée machine-readable des critères d'éligibilité sans logique de règles.

---

### 3. Double modèle d'éligibilité conservé

**Décision :** Conserver à la fois `eligibilityConditions` (texte lisible humain) et `eligibilityData` (données structurées machine-readable).

**Justification :**
- `eligibilityConditions` est rédigé pour l'affichage à l'utilisateur final (ex : « Plus de 50 salariés »).
- `eligibilityData` est consommé programmatiquement pour le filtrage/scoring (ex : `minEmployees: 50`).
- Ces deux représentations ont des cycles de vie différents : le texte peut évoluer sans changer la logique, et vice versa.
- Supprimer l'un forcerait une transformation coûteuse à chaque lecture ou écriture.

---

### 4. Champs Date natifs Payload

**Décision :** Utiliser le type `date` de Payload pour `validityStart`, `validityEnd` (et leurs équivalents dans `eligibilityData`).

**Justification :**
- Les dates du JSON source sont au format `DD/MM/YYYY` (ex : `"06/02/2023"`).
- Le script de seed convertit ces dates en ISO 8601 avant insertion.
- Le type `date` de Payload offre un date-picker dans l'admin et facilite les requêtes par plage de dates via l'API.

---

### 5. Stratégie de migration : script de seed

**Décision :** Fournir un script `apps/cms/src/seed/programs.ts` utilisant la Local API Payload pour l'import initial.

**Justification :**
- La Local API Payload bypasse HTTP, est typée, et respecte les hooks/validations Payload.
- Le script est idempotent (upsert par slug) pour permettre des ré-exécutions sans duplication.
- Ordre d'import : Operators d'abord (déduplication), puis Programs (résolution des relations).

---

### 6. Illustration comme chemin relatif (pas Media)

**Décision :** Le champ `illustration` est un champ `text` stockant un chemin relatif (ex : `"images/TEE_energie_verte.webp"`), non une relation vers la collection `Media`.

**Justification :**
- Les illustrations ne sont pas gérées dans PayloadCMS — elles sont servies statiquement depuis le projet frontend TEE.
- Ajouter les assets à Media nécessiterait un upload manuel de ~234 fichiers, hors scope du POC.
- Un champ texte permet l'édition simple du chemin sans blocage.

---

## Conséquences

- Le script de seed doit être exécuté une fois après la première migration de base de données.
- `payload-types.ts` sera régénéré automatiquement par Payload lors du build/dev — ne pas modifier manuellement.
- Si `publicodes` doit un jour être éditable dans le CMS, une ADR dédiée devra évaluer l'approche (JSON Editor custom, champ code, etc.).
