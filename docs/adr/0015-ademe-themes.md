# ADR 0015 : Thématiques ADEME, du référentiel amont au pivot AGIR

**Date :** 2026-11-23
**Statut :** Accepté
**Décideurs :** Yohann
**Complète :** [ADR 0007](0007-canonical-pivot-format.md) (format pivot), [ADR 0012](0012-production-persistence-postgres.md) (sync quotidienne, amont maître), [ADR 0013](0013-operator-groups-and-media.md) (référentiel amont porté par une collection)

---

## Contexte

AGIR veut classer les dispositifs selon le **référentiel des thématiques ADEME**, et non selon les thèmes internes de TEE (`batiment`, `energie`…). Côté TEE (PR #2719 du dépôt `betagouv/mission-transition-ecologique`, 2026-11) :

- le référentiel est publié dans `libs/data/static/ademe_themes.json` : une liste plate de `{ code, parentCode, label }`, 102 thématiques dont 10 racines (`19`) et leurs sous-thèmes (`19_03`) ;
- chaque dispositif de `programs.json` portera `ademeThemes: ["19", "19_03", "08"]`, les codes saisis dans Baserow (racines ou sous-thèmes, le parent n'étant pas ajouté d'office), propriété **absente** si le dispositif n'a pas de thème.

Au 2026-11-23, `programs.json` ne porte pas encore la propriété : elle arrivera avec la prochaine PR automatique « chore: update programs ».

## Décision

### 1. Pivot : `thematiques_ademe`, à côté de `themes`

Le canonical des dispositifs gagne `thematiques_ademe` : liste facultative (au moins un élément si présente) de **codes** (`ademeThemeCodeSchema`, `^\d{2}(_\d{2})?$`, `libs/canonical/src/shared/schema/ademe-theme.ts`). Les libellés ne sont pas portés : ils vivent dans le référentiel. Le champ `themes` (taxonomie TEE) reste inchangé : il sert au front TEE, au rapprochement avec les projets et à l'export Grist.

`TeeImporter` lit `ademeThemes` tels quels (doublons retirés) ; `TeeExporter` les réécrit pour l'aller-retour.

### 2. CMS : collection `ademe-themes` synchronisée, relation sur `Programs`

- Nouvelle collection **`ademe-themes`** (`AdemeThemes.ts`) : `code` (unique), `label`, `parent` (relation vers la même collection), `displayName` calculé (« 19_03 · Eau », `assignAdemeThemeDisplayName`). Lecture par tout utilisateur connecté, écriture réservée au super-admin (`AdemeThemeAccessPolicy`) : le référentiel suit l'amont.
- `Programs.ademeThemes` : relation `hasMany` vers `ademe-themes`, à côté de `themes`.
- `UpstreamJsonSource.ademeThemes()` télécharge `ademe_themes.json` (même dossier que `programs.json`, URL surchargeable par `TEE_ADEME_THEMES_URL`, copie versionnée dans `static/upstream/`, validée par `teeAdemeThemeSchema`).
- `AdemeThemesSync` (`apps/cms/src/scripts/sync/ademe-themes/`) tourne en tête d'`UpstreamSync`, donc au seed comme à la sync quotidienne : upsert par code, racines d'abord, écriture seulement sur différence de libellé ou de parent. Une thématique que l'amont ne publie plus est **conservée et signalée** (des dispositifs peuvent encore la citer) ; un sous-thème dont la racine manque est une erreur comptée.
- `CanonicalToPayloadMapper` résout chaque code par `ProgramRelations.ademeThemeIdByCode` : un code inconnu du référentiel est un **avertissement**, le dispositif est importé sans lui. `ProgramCanonicalMapper` relit les relations peuplées (`depth >= 1`) et renvoie les codes.

Option écartée : un `select` statique généré depuis le référentiel. Plus simple, mais une nouvelle thématique saisie dans Baserow aurait demandé une release, et le référentiel amont n'aurait servi qu'à valider les codes.

### 3. AGIR : `themes` du pivot porte les codes ADEME

Dans le pivot ADEME (`GET /api/agir/programs/:slug/pivot`), `themes` vaut désormais `thematiques_ademe` (codes seuls, par exemple `["19", "19_03"]`) au lieu des thèmes TEE traduits par `AgirThemeMapper`. Absent si le dispositif n'a pas de thématique ADEME. Le détail R2DA (`thematique`), l'index et le pivot des projets ne changent pas.

## Conséquences

- **Continuité** : tant que `programs.json` ne porte pas `ademeThemes`, les dispositifs restent valides et le pivot AGIR n'expose **aucun** `themes`. Il réapparaît, en codes ADEME, à la première sync qui suit la PR automatique amont.
- La première sync après déploiement réécrit tous les dispositifs une fois : l'empreinte amont (`upstreamFingerprint`) couvre le nouveau champ.
- Migration `20261123_140528_ademe_themes` : table `ademe_themes` et colonnes de relation sur `programs_rels` et `_programs_v_rels`.
- AGIR résout les libellés depuis `ademe_themes.json`. S'il les veut dans le pivot, il faudra les ajouter depuis la collection `ademe-themes`, le canonical n'en portant pas.
