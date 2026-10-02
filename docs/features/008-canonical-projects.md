# Feature 008 : Format pivot et API des projets

**Statut :** implémentée le 2026-10-01 (planifiée le même jour), branche `feat/canonical-projects` (créée depuis `feat/mixed-geographic-coverage`). Résultats, écarts et points ouverts en fin de document.
**ADR :** [`0014-canonical-projects.md`](../adr/0014-canonical-projects.md)
**Complète :** [ADR 0003](../adr/0003-projects-collection.md) (collection `Projects`), [ADR 0007](../adr/0007-canonical-pivot-format.md) (format pivot), [ADR 0008](../adr/0008-canonical-persistence-ddd.md) (persistance et DDD, qui annonçait un `CanonicalProjectService`), [ADR 0012](../adr/0012-production-persistence-postgres.md) (schéma `canonical`, pipeline quotidien, amont maître), [feature 005](005-cms-daily-sync.md) (lecteur amont unique)

---

## Contexte

Les dispositifs ont un format pivot (`libs/canonical`), un store dédié (`libs/canonical-store`, schéma Postgres `canonical`), une synchronisation depuis le CMS, un import quotidien depuis l'amont et une API publique pour AGIR. Les projets n'ont rien de tout cela : ils n'existent que dans la collection Payload `Projects`, lue par personne en dehors de l'admin.

L'objectif est de donner aux projets la même chaîne que les dispositifs, pour exposer une **API des projets à AGIR (ADEME)**.

Constats (vérifiés le 2026-10-01 sur le code et sur `libs/format-adapters/static/upstream/`) :

| # | Constat | Conséquence |
|---|---|---|
| 1 | `libs/canonical` et `libs/canonical-store` ne connaissent que les dispositifs (une table `canonical.canonical_programs`) | Tout est à créer côté projets |
| 2 | `Projects` n'a ni workflow, ni brouillon, ni `canonicalId` | Pas de notion de « publié », pas d'identité stable hors de l'id auto-incrémenté de Payload |
| 3 | `projects.json` amont : 91 projets. Champs ignorés par le CMS : `faqs` (11 projets en ont, 5 questions au plus, `{ id, question, answer }` avec `answer` en Markdown), `titleFaq` (11 projets), `priority` (91 projets, objet `{ default, <section NAF>, <code NAF> }`, clés observées : `default`, `A`, `C`, `D`, `E`, `F`, `G`, `H`, `I`, `Q`, `T`, `55`, `55.3`, `56`, `86.1`) | Un pivot alimenté par le CMS perdrait ces données : elles doivent entrer dans Payload |
| 4 | `highlightPriority` amont est une chaîne (`"1"` à `"8"`) ou `null` | Conversion en nombre, absence tolérée |
| 5 | `linkedProjects` amont référence les projets par leur `id` numérique ; `programs` référence les dispositifs par slug | Le lecteur amont doit traduire les `id` numériques en slugs avant de dériver les identifiants pivot |
| 6 | `redirects.json` amont contient 6 `project_redirects` (ancien slug → slug courant), dont un ancien slug non kebab-case (`maintenance-préventive`) | Tombstones à synthétiser, slug hérité toléré sur un projet remplacé |
| 7 | Les thèmes Payload sont en anglais (`energy`), la taxonomie pivot en français (`energie`) : table `THEME_TO_CANONICAL` déjà en place pour les dispositifs | Réutilisée |
| 8 | L'URL d'un média est absolue avec le stockage objet (préprod, prod) et relative (`/api/media/file/...`) en local | Le pivot doit accepter les deux, l'export rend l'URL absolue |
| 9 | Chaque `DrizzleCanonicalProgramRepository.create()` ouvre son propre pool (`max: 3`) | Deux repositories sans partage doubleraient les connexions sur un addon plafonné |
| 10 | Le seed lit `projects.json` avec son propre lecteur (`ProjectMapper`), alors que la feature 005 a décidé « un seul lecteur du format amont » pour les dispositifs | Même règle à appliquer aux projets |

**Hors scope :**

- Sync quotidienne du CMS depuis l'amont (lot 4 de la feature 005) : les projets y seront branchés en réutilisant le lecteur et le mapper créés ici.
- Champ Payload « remplacé par » sur `Projects` : les tombstones ne sont produits que par l'import amont direct, comme pour les dispositifs.
- Export Grist / open data des projets.
- Round-trip `projects.json` (régénération du fichier amont depuis le pivot) : le pivot est conçu sans perte sur les champs utiles, mais aucun `TeeProjectExporter` n'est écrit.
- `Programs.linkedProjects` (relation côté dispositif, voir feature 005 lot 5) : le pivot des projets lit `Projects.programs`, côté propriétaire.

---

## Décisions prises

| Sujet | Décision |
|---|---|
| Périmètre | Pivot + store + sync CMS + import quotidien + API AGIR (validé le 2026-10-01) |
| Consommateur | AGIR (ADEME), comme les dispositifs. Format placeholder tant qu'AGIR n'a pas spécifié ses attentes |
| Modèle domaine | Dossier `libs/canonical/src/canonical-project/`, calqué sur `canonical-program/` : schéma zod racine, types inférés, value object `CanonicalProject`, `CanonicalProjectValidator`, port `CanonicalProjectRepository`, service `CanonicalProjectService`. Clés en français `snake_case` (ADR 0007) |
| Code partagé | `CanonicalSnapshotPlan` et `CanonicalSnapshotGuard` deviennent génériques et passent dans `libs/canonical/src/snapshot/` ; `themeSchema` passe dans `src/shared/schema/theme.ts` (réexporté par `enums.ts`). Services et repositories restent **un par entité** (écarté : un service générique, les événements et validateurs diffèrent) |
| Événements | Nouveaux types `project_saved`, `project_removed`, `project_dropped` ; `sync_failed` reçoit un champ optionnel `entity: 'program' \| 'project'` |
| Store | Table `canonical.canonical_projects` (mêmes colonnes que `canonical_programs`), `DrizzleCanonicalProjectRepository`, `createCanonicalProjectRepository()`. La connexion est **mémoïsée par URL** : les deux repositories partagent un seul pool |
| Statut de publication | Brouillons Payload activés sur `Projects` (`versions.drafts`, validé le 2026-10-01). Seuls les projets **publiés** vont dans le pivot |
| Politique de sync | (remplacée le 2026-10-02 par `CanonicalSyncPolicy`, commune aux dispositifs et aux projets : voir ADR 0014, révision du 2026-10-02) `ProjectCanonicalSyncPolicy` : publié → écrit ; brouillon enregistré par-dessus une version publiée → pivot inchangé (la version publiée reste servie) ; dépublié ou jamais publié → retiré ; suppression → retiré |
| Statut dans le pivot | `statut_projet` : `valide` ou `remplace`. `remplace` exige `remplace_par` (identifiant pivot du projet courant). Pas de `statut_edition` : seuls des projets publiés sont stockés |
| Identité | Champ `Projects.canonicalId` (cuid2, masqué, verrouillé par l'API), posé par le hook `assignCanonicalId` déjà utilisé par les dispositifs. Le seed et l'import amont posent `SlugCanonicalId.forProject(slug)` (dérivé de `project:<slug>`, pour ne jamais coïncider avec l'identifiant d'un dispositif de même slug) |
| FAQ | Champs Payload `titleFaq` (texte) et `faqs` (array `question` texte + `answer` rich text). Pivot : `faq { titre?, questions[{ question, reponse }] }`. L'`id` numérique amont d'une question n'est pas gardé |
| Priorité par secteur | Champs Payload `defaultPriority` (nombre) et `sectorPriorities` (array `nafCode` texte validé + `priority` nombre). Pivot : `priorite { defaut?, mise_en_avant?, par_secteur[{ code_naf, priorite }] }`, `mise_en_avant` portant `highlightPriority` |
| Références | Le pivot référence dispositifs (`dispositifs`) et projets liés (`projets_lies.projets`) par **identifiant pivot** (cuid2), comme `remplace_par` des dispositifs. L'export AGIR les résout en slugs et écarte ce qu'il ne retrouve pas |
| Image | `image { url, chemin_source? }`. `url` : URL absolue ou chemin enraciné (`/api/media/file/...`). L'export AGIR rend l'URL absolue avec la base URL publique |
| Redirections | Tombstones comme les dispositifs (validé le 2026-10-01) : `ProjectRedirects` lit `project_redirects`, `ProjectTombstoneBuilder` clone le projet courant sous l'ancien slug avec `statut_projet: 'remplace'`. Produits **uniquement par l'import amont direct** |
| Alimentation | Deux écrivains, comme les dispositifs : hooks CMS (`afterChange`, `afterDelete`, seed inclus) et import quotidien direct (`import:projects --remote`). **L'amont est maître** (ADR 0012) : l'import écrase ce que le CMS a écrit |
| Lecteur amont | Un seul : `TeeProjectImporter` (`projects.json` → `CanonicalProjectInput`) dans `libs/format-adapters`, utilisé par l'import direct **et** par le seed, suivi côté CMS de `CanonicalProjectToPayloadMapper`. `ProjectMapper` et `types.ts` du seed sont supprimés |
| API AGIR | `GET /api/agir/projects` (index, une `urlPivot` par entrée) et `GET /api/agir/projects/:slug/pivot` (validé le 2026-10-01). Pas de « détail R2DA » : ce format est propre aux dispositifs |
| Dispositifs liés exposés | L'export ne garde que les dispositifs exportables vers AGIR (`AgirExportPolicy.isExportable`) : un lien vers un dispositif absent de l'API serait un lien mort |

---

## Format pivot d'un projet

Schéma racine `canonicalProjectSchema` (`libs/canonical/src/canonical-project/canonical-project.schema.ts`). Les primitifs viennent de `src/shared/primitives.ts`.

| Clé | Type zod | Obligatoire | Source Payload | Source amont |
|---|---|---|---|---|
| `id` | `cuid2Schema` | oui | `canonicalId` | `SlugCanonicalId.forProject(slug)` |
| `slug` | `legacySlugSchema` + `refineKebabCaseSlug('slug', statut_projet === 'remplace')` | oui | `slug` | `slug` |
| `source` | `sourceSchema` | oui | `'INTERNE'` | `'INTERNE'` |
| `date_mise_a_jour` | `isoDateTimeSchema` | oui | `updatedAt` | horodatage de l'exécution |
| `statut_projet` | `z.enum(['valide', 'remplace'])` | oui | `'valide'` | `'valide'`, `'remplace'` pour un tombstone |
| `remplace_par` | `cuid2Schema` | si `remplace` (refus sinon) | jamais | identifiant pivot du projet courant |
| `titre` | `nonEmptyStringSchema` | oui | `title` | `title` |
| `nom_court` | `nonEmptyStringSchema` | oui | `nameTag` | `nameTag` |
| `description_courte` | `nonEmptyStringSchema` | oui | `shortDescription` | `shortDescription` |
| `image` | `{ url, chemin_source? }` | non | `image.url`, `image.sourcePath` | base des fichiers amont + `image`, `image` |
| `description_longue` | `{ titre?, contenu }` (`contenu` Markdown non vide) | oui | `titleLongDescription`, `longDescription` | idem |
| `description_complementaire` | `{ titre?, contenu }` | non | `titleMoreDescription`, `moreDescription` | idem (omis si `moreDescription` vide) |
| `theme_principal` | `themeSchema` | oui | `mainTheme` via `THEME_TO_CANONICAL` | `mainTheme` via `ThemeMapper.toFrench` |
| `themes` | `z.array(themeSchema)` | non | `themes` | `themes` |
| `secteurs` | `z.array(nafCodeSchema)` | non | `sectors` | `sectors` |
| `priorite` | `{ defaut?, mise_en_avant?, par_secteur? }` (entiers positifs ou nuls ; `par_secteur` : `{ code_naf: nafCodeSchema, priorite }[]`) | non | `defaultPriority`, `highlightPriority`, `sectorPriorities` | `priority.default`, `highlightPriority`, autres clés de `priority` |
| `dispositifs` | `z.array(cuid2Schema)` | non | `programs[].canonicalId` | `SlugCanonicalId.from(slugDispositif)` |
| `projets_lies` | `{ titre?, description?, projets: cuid2[] }` | non | `titleLinkedProjects`, `descriptionLinkedProjects`, `linkedProjects[].canonicalId` | idem, `id` numériques traduits en slugs puis en identifiants |
| `faq` | `{ titre?, questions: { question, reponse }[] }` (`questions` non vide) | non | `titleFaq`, `faqs` | `titleFaq`, `faqs` |
| `seo` | `{ titre?, description? }` | non | `metaTitle`, `metaDescription` | idem |

Règles :

- Un objet optionnel vide n'est jamais écrit (`priorite: {}`, `faq` sans question, `projets_lies` sans projet ni titre) : le mapper l'omet.
- `image.url` : `z.union([urlSchema, z.string().regex(/^\/\S*$/)])`.
- `refineRemplacePar` propre aux projets : `remplace_par` exigé quand `statut_projet === 'remplace'`, refusé sinon. S'inspirer de `refineRemplacePar` dans `canonical-program/fields/aide.schema.ts`.

---

## Fichiers à créer / modifier

Les tableaux ci-dessous sont ceux du plan. Tous les fichiers listés ont été créés, modifiés ou supprimés comme prévu ; les fichiers touchés en plus sont listés dans « Fichiers hors plan » à la fin de cette section.

### `libs/canonical`

| Fichier | Action |
|---|---|
| `src/shared/schema/theme.ts` | Créer : `themeSchema` et `Theme`, déplacés depuis `canonical-program/enums.ts` |
| `src/canonical-program/enums.ts` | Modifier : réexporte `themeSchema` et `Theme` depuis `shared/schema/theme` |
| `src/snapshot/CanonicalSnapshotPlan.ts`, `CanonicalSnapshotGuard.ts`, `CanonicalSnapshotRejectedError.ts` | Déplacer depuis `canonical-program/snapshot/` et rendre génériques |
| `src/snapshot/CanonicalKey.ts` | Créer : `CanonicalKey { canonicalId, slug }` et `CanonicalChanges<T> { delete: string[]; save: T[] }` |
| `src/canonical-program/CanonicalProgramRepository.ts` | Modifier : `CanonicalProgramKey = CanonicalKey`, `CanonicalProgramChanges = CanonicalChanges<CanonicalProgram>` |
| `src/canonical-program/CanonicalProgramService.ts` | Modifier : imports du snapshot |
| `src/canonical-project/canonical-project.schema.ts` | Créer |
| `src/canonical-project/canonical-project.types.ts` | Créer : `CanonicalProjectData`, `CanonicalProjectInput` |
| `src/canonical-project/CanonicalProject.ts` | Créer |
| `src/canonical-project/CanonicalProjectValidator.ts` | Créer |
| `src/canonical-project/CanonicalProjectRepository.ts` | Créer |
| `src/canonical-project/CanonicalProjectService.ts` | Créer |
| `src/observability/CanonicalEvent.ts` | Modifier : événements projets, `entity` sur `sync_failed` |
| `src/index.ts` | Modifier : exports |
| `tests/fixtures/project-valid-minimal.ts`, `project-valid-full.ts` | Créer |
| `tests/unit/canonical-project.schema.spec.ts`, `CanonicalProject.spec.ts`, `CanonicalProjectValidator.spec.ts`, `CanonicalProjectService.spec.ts`, `CanonicalSnapshotPlan.spec.ts` | Créer (le dernier seulement s'il n'existe pas déjà sous une autre forme) |
| `CLAUDE.md` (du package) | Modifier |

### `libs/canonical-store`

| Fichier | Action |
|---|---|
| `src/schema.ts` | Modifier : table `canonicalProjects` |
| `src/db.ts` | Modifier : `ensureCanonicalSchema` crée aussi `canonical_projects` ; `createCanonicalDb` mémoïsée par URL |
| `src/canonicalDatabaseUrl.ts` | Créer : résolution de l'URL, extraite de `createCanonicalProgramRepository.ts` |
| `src/DrizzleCanonicalProjectRepository.ts` | Créer |
| `src/createCanonicalProjectRepository.ts` | Créer |
| `src/createCanonicalProgramRepository.ts` | Modifier : utilise `canonicalDatabaseUrl` |
| `src/index.ts` | Modifier : exports nommés |
| `tests/DrizzleCanonicalProjectRepository.spec.ts` | Créer (PGlite) |

### `libs/format-adapters`

| Fichier | Action |
|---|---|
| `src/tee/tee-project.schema.ts` | Créer : `teeProjectSchema`, `teeProjectsSchema`, type `TeeProject` |
| `src/tee/TeeProjectImporter.ts` (+ `.spec.ts`) | Créer |
| `src/tee/SlugCanonicalId.ts` (+ `.spec.ts`) | Modifier : `forProject(slug)` |
| `src/tee/SlugRedirects.ts` | Créer : lecture d'une table de redirections de `redirects.json` par clé |
| `src/tee/ProgramRedirects.ts` | Modifier : hérite de `SlugRedirects` (API publique inchangée) |
| `src/tee/ProjectRedirects.ts` (+ `.spec.ts`) | Créer |
| `src/tee/ProjectTombstoneBuilder.ts` (+ `.spec.ts`) | Créer |
| `src/tee/UpstreamJsonSource.ts` (+ `.spec.ts`) | Modifier : `projects()` renvoie des `TeeProject[]` validés |
| `src/agir/projects/agir-projet-liste.types.ts` | Créer |
| `src/agir/projects/agir-projet-pivot.schema.ts`, `agir-projet-pivot.types.ts` | Créer |
| `src/agir/projects/AgirProjetEtatMapper.ts` | Créer |
| `src/agir/projects/AgirProjetReferences.ts` | Créer |
| `src/agir/projects/AgirProjetListeExporter.ts` (+ `.spec.ts`) | Créer |
| `src/agir/projects/AgirProjetPivotExporter.ts` (+ `.spec.ts`) | Créer |
| `src/agir/AgirVocabulary.ts` | Modifier : `ETAT_PROJET` |
| `src/agir/AgirRoutes.ts` (+ `.spec.ts`) | Créer : gabarits de route et liens absolus AGIR, partagés par les endpoints du CMS et les exporters d'index (dispositifs et projets) |
| `src/__fixtures__/canonical-projects.ts` | Créer |
| `src/index.ts` | Modifier : exports |
| `scripts/import-projects.ts` | Créer |
| `static/input/projects-tests.json` | Créer : extrait figé de quelques projets |
| `static/input/redirects-tests.json` | Modifier : ajouter une clé `project_redirects` |
| `project.json` | Modifier : target `import:projects` |

### `apps/cms`

| Fichier | Action |
|---|---|
| `src/collections/Projects.ts` | Modifier : brouillons, `canonicalId`, `titleFaq`, `faqs`, `defaultPriority`, `sectorPriorities`, hooks |
| `src/hooks/shared/assignCanonicalId.ts` | Déplacer depuis `src/hooks/programs/assignCanonicalId.ts` (hook déjà générique), mettre à jour l'import de `Programs.ts` |
| `src/hooks/projects/syncProjectCanonicalOnChange.ts` | Créer |
| `src/hooks/projects/removeProjectCanonicalOnDelete.ts` | Créer |
| `src/utils/NafCodeValidator.ts` | Créer : validation du champ `nafCode` |
| `src/utils/RequiredTextValidator.ts`, `RequiredRichTextValidator.ts`, `CopySlug.ts` | Créés après la revue (voir « Duplication et textes vides ») |
| `src/hooks/shared/duplicateAsDraft.ts`, `assignCopySlug.ts` | Créés après la revue (voir « Duplication et textes vides ») |
| `src/services/canonical/ProjectCanonicalMapper.ts` | Créer |
| `src/services/canonical/ProjectCanonicalSyncPolicy.ts` | Créer |
| `src/services/canonical/canonicalProjectRepository.ts` | Créer |
| `src/services/canonical/canonicalProjectService.ts` | Créer |
| `src/services/canonical/to-payload/CanonicalProjectToPayloadMapper.ts` | Créer |
| `src/services/canonical/to-payload/ProjectRelations.ts`, `PayloadProjectRelations.ts` | Créer : port et adaptateur de résolution des relations |
| `src/services/canonical/observability/PayloadLoggerEventSink.ts` | Modifier : nouveaux événements |
| `src/utils/PublicBaseUrlResolver.ts` | Créer : `resolveBaseUrl` extrait des endpoints AGIR des dispositifs |
| `src/endpoints/agir/agirProgramEndpoints.ts` | Renommer (ex `agirEndpoints.ts`) : utilise `PublicBaseUrlResolver` |
| `src/endpoints/agir/agirProjectEndpoints.ts` | Créer |
| `payload.config.ts` | Modifier : `endpoints: [...agirProgramEndpoints, ...agirProjectEndpoints]` |
| `src/scripts/sync/projects/index.ts`, `ProjectImporter.ts`, `LinkedProjectsUpdater.ts` | Modifier : passent par `TeeProjectImporter` + `CanonicalProjectToPayloadMapper` |
| `src/scripts/sync/projects/ProjectMapper.ts`, `types.ts` | Supprimer |
| `src/scripts/seed/run.ts` | Modifier : type `TeeProject` |
| `src/migrations/20261001_092812_canonical_projects.{ts,json}` | Générée puis complétée (remplissage de `_status`, de `canonical_id` et de la table des versions) ; `src/migrations/index.ts` mis à jour |
| `payload-types.ts` | Régénéré (`pnpm generate:types`, non versionné) ; `importMap.js` inchangé (aucun composant custom) |
| `tests/unit/ProjectCanonicalMapper.spec.ts`, `ProjectCanonicalSyncPolicy.spec.ts`, `CanonicalProjectToPayloadMapper.spec.ts` | Créer |
| `tests/int/canonical-project-sync.int.spec.ts`, `agir-projects.int.spec.ts` | Créer |
| `tests/int/project-images.int.spec.ts`, `seed.int.spec.ts` | Modifiés : nouvelle signature du seed, cas projets (publiés, `canonicalId`, FAQ, priorités, liens, pivot en fin de seed) |
| `tests/fixtures/projects.json` | Créer : quelques projets liés aux dispositifs de `tests/fixtures/programs.json` |

### Racine et documentation

| Fichier | Action |
|---|---|
| `package.json` | Modifier : `data:daily` et `data:daily:dev` enchaînent l'import des projets, en fin de chaîne depuis la revue de code ; scripts `import:projects` et `test:libs` |
| `CLAUDE.md` | Modifier : sections Seed, `apps/cms`, `libs/canonical`, `libs/canonical-store`, `libs/format-adapters`, endpoints, index des ADR |
| `docs/context/canonical-project-format.md` | Créer : référence des champs du pivot projet |
| `docs/context/projects-model.md` | Modifier : nouveaux champs, brouillons, architecture du seed |
| `docs/context/agir-export-format.md` | Modifier : endpoints et format des projets |
| `docs/context/seed.md` | Modifier : nouveau chemin d'import des projets |
| `docs/adr/0003-projects-collection.md` | Modifier : addendum (brouillons, FAQ, priorité, `canonicalId`) |
| `docs/adr/0008-canonical-persistence-ddd.md` | Modifier : renvoi vers l'ADR 0014 |
| `docs/features/TASKS.md` | Modifier : statut de la feature |

### Fichiers hors plan

| Fichier | Action |
|---|---|
| `libs/canonical/tests/unit/CanonicalProgramService.spec.ts` | Modifié : imports du snapshot déplacé (assertions inchangées) |
| `libs/canonical-store/tests/canonicalDatabaseUrl.spec.ts` | Créé : ordre des variables, erreur explicite |
| `libs/canonical-store/tests/createCanonicalDb.spec.ts` | Créé : un pool par URL, connexion en échec non gardée en cache |
| `libs/format-adapters/scripts/snapshot-upstream.ts` | Modifié : `source.projects()` sans paramètre de type |
| `libs/format-adapters/src/agir/AgirThemeMapper.ts` | Modifié : `toAgirTheme(theme)` pour un thème seul (`theme_principal`) |
| `apps/cms/src/services/canonical/canonicalMappings.ts` | Modifié : `CANONICAL_TO_THEME` exporté |
| `apps/cms/src/services/canonical/to-payload/CanonicalToPayloadMapper.ts` | Modifié : utilise `CANONICAL_TO_THEME` partagé au lieu de sa copie locale |
| `apps/cms/src/services/canonical/canonicalProgramService.ts` | Modifié : commentaire périmé (« A `CanonicalProjectService` will follow ») |
| `apps/cms/tests/unit/NafCodeValidator.spec.ts` | Créé |
| `docs/adr/0014-canonical-projects.md` | Modifié : précisions et section « Révisions » |
| `docs/adr/0012-production-persistence-postgres.md` | Modifié : note de révision (le pipeline importe aussi les projets) |
| `docs/features/005-cms-daily-sync.md` | Modifié : emplacement du hook `assignCanonicalId` |
| `docs/context/schema-grist-export.md` | Modifié : étape `import:projects` du pipeline quotidien |

Non créé : aucune fixture de projet dans `libs/canonical-store/tests/` (les fixtures de `libs/canonical/tests/fixtures/` ne sont pas importables depuis un autre projet nx : le test du repository les porte en ligne).

---

## Étapes d'implémentation

Ordre imposé par les dépendances : lot 1 → lot 2 → lot 3 → lots 4 et 5 → lot 6 → lot 7 → lot 8. Chaque lot se termine par `pnpm nx affected -t lint` et les tests du périmètre touché.

### Lot 1 : domaine (`libs/canonical`)

1. **Thèmes partagés.** Déplacer `themeSchema` et `Theme` dans `src/shared/schema/theme.ts`. `canonical-program/enums.ts` les réexporte (`export { themeSchema, type Theme } from '../shared/schema/theme'`) : aucun import existant ne change.
2. **Snapshot générique.** Déplacer les trois fichiers de `canonical-program/snapshot/` vers `src/snapshot/`.
   - `CanonicalKey.ts` : `interface CanonicalKey { canonicalId: string; slug: string }`, `interface CanonicalChanges<T> { delete: string[]; save: T[] }`.
   - `CanonicalSnapshotPlan<T extends { id: string; slug: string }>` : même algorithme, `valid: T[]`, `changes(): CanonicalChanges<T>`.
   - `CanonicalSnapshotGuard` : `check(plan: CanonicalSnapshotPlan<{ id: string; slug: string }>)`. Nouvelle option `entityLabel?: string` (défaut `'dispositif'`) utilisée dans les deux messages d'erreur, pour que le rejet d'un snapshot de projets parle de « projet ».
   - `CanonicalProgramRepository.ts` : `export type CanonicalProgramKey = CanonicalKey` et `export type CanonicalProgramChanges = CanonicalChanges<CanonicalProgram>` (noms conservés, aucun appelant ne change).
   - Mettre à jour `src/index.ts` et les imports de `CanonicalProgramService.ts`. Les tests existants doivent passer sans modification de leurs assertions.
3. **Schéma du projet.** `canonical-project.schema.ts`, selon le tableau « Format pivot d'un projet ». Construire un `baseCanonicalProjectSchema` (`z.object`) puis `canonicalProjectSchema = base.superRefine(refineProjetRemplacePar).superRefine(refineKebabCaseSlug('slug', (data) => data['statut_projet'] === 'remplace'))`. Exporter aussi `statutProjetSchema` et `type StatutProjet`. Messages de validation en français (convention du package).
4. **Types.** `canonical-project.types.ts` : `CanonicalProjectData = z.infer<...>`, `CanonicalProjectInput = z.input<...>`.
5. **Value object.** `CanonicalProject` sur le modèle de `CanonicalProgram` : constructeur privé + `deepFreeze`, `static fromValidated(data)`, accesseurs `id`, `slug`, `statutProjet`, `remplacePar`, méthodes `isReplaced()`, `toMutable()`, `toJSON()`.
6. **Validateur.** `CanonicalProjectValidator` : `validate(input: unknown): ProjectValidationResult` (`{ success: true; project } | { success: false; errors }`) et `parse(input)`.
7. **Port.** `CanonicalProjectRepository` : `save(project)`, `findBySlug(slug)`, `findAll()`, `listKeys(): Promise<CanonicalKey[]>`, `delete(canonicalId)`, `applyChanges(changes: CanonicalChanges<CanonicalProject>)`.
8. **Événements.** Dans `CanonicalEvent.ts`, ajouter `project_saved`, `project_removed` (mêmes champs que leurs équivalents dispositifs) et `project_dropped` (avec `phase`, `canonicalId?`, `errors`). Ajouter `entity?: 'program' | 'project'` à `sync_failed`.
9. **Service.** `CanonicalProjectService(repository, events = new NullEventSink())` : `save(input)`, `remove(canonicalId, slug)`, `applySnapshot(inputs, guard = new CanonicalSnapshotGuard({ entityLabel: 'projet' }))`, `getAll()`. Même comportement que `CanonicalProgramService`, avec les événements `project_*`. Types de retour `CanonicalProjectSaveResult` et `CanonicalProjectSnapshotReport`.
10. **Fixtures et tests.** `project-valid-minimal.ts` (champs obligatoires seuls) et `project-valid-full.ts` (tous les champs). Tests : schéma (obligatoires, `remplace` sans `remplace_par` refusé, `remplace_par` sur un projet `valide` refusé, slug hérité accepté seulement sur un projet remplacé, `image.url` absolue et enracinée acceptées, chemin relatif refusé, `code_naf` invalide refusé, `faq.questions` vide refusé), value object (gel profond), service (save valide et invalide, remove, applySnapshot : retrait, remplacement d'identifiant, conservation d'une ligne dont l'entrée amont est invalide, rejet par le garde-fou avec le libellé « projet »).
11. Mettre à jour `libs/canonical/CLAUDE.md` (contenu du package, snapshot partagé, événements).

### Lot 2 : store (`libs/canonical-store`)

1. `schema.ts` : `canonicalProjects = canonicalSchema.table('canonical_projects', { canonicalId, slug (unique), data, updatedAt })`, mêmes types que `canonicalPrograms`.
2. `db.ts` : `ensureCanonicalSchema` crée aussi `canonical_projects` (`CREATE TABLE IF NOT EXISTS`). `createCanonicalDb(url)` mémoïse la promesse de connexion dans une `Map<string, Promise<CanonicalDb>>` : un seul pool par URL, partagé par les deux repositories.
3. `canonicalDatabaseUrl.ts` : la fonction `databaseUrl()` et la constante `DATABASE_VARIABLES`, déplacées telles quelles depuis `createCanonicalProgramRepository.ts`, exportées sous le nom `resolveCanonicalDatabaseUrl()`.
4. `DrizzleCanonicalProjectRepository implements CanonicalProjectRepository` : même structure que `DrizzleCanonicalProgramRepository` (`create(url, events)`, `fromDb(db, events)`, upsert `onConflictDoUpdate` sur `canonicalId`, `applyChanges` en transaction avec les suppressions d'abord, `rebuild` qui émet `project_dropped` en phase `read`).
   - Factorisation permise : une classe de base abstraite paramétrée par la table, le validateur et la fabrique de l'événement « dropped », dont héritent les deux repositories. Si le typage Drizzle d'une table générique devient lourd, garder deux classes distinctes : la duplication est acceptée.
5. `createCanonicalProjectRepository(events?)` : `DrizzleCanonicalProjectRepository.create(resolveCanonicalDatabaseUrl(), events)`.
6. `index.ts` : exports **nommés** (pas de `export *`, voir le commentaire en tête du fichier).
7. `tests/DrizzleCanonicalProjectRepository.spec.ts` sur PGlite (`InMemoryCanonicalDb`), calqué sur le test du repository des dispositifs : upsert, `findBySlug`, `findAll`, `listKeys` d'une ligne illisible, `delete`, `applyChanges` atomique, ligne invalide signalée et écartée à la lecture. Ajouter un cas : les deux tables coexistent, un dispositif et un projet de même slug ne se gênent pas.

### Lot 3 : modèle Payload (`apps/cms`)

1. `Projects.ts` :
   - `versions: { drafts: true }`.
   - `canonicalId` : copier la définition du champ de `Programs.ts` (texte, `unique`, `index`, `admin.hidden`, `admin.readOnly`, `access.create` et `access.update` à `() => false`).
   - `titleFaq` (`text`, « Titre de la FAQ ») et `faqs` (`array`, « Questions fréquentes », `labels` singulier « Question ») avec `question` (`text`, requis) et `answer` (`richText`, requis). Placés après la description complémentaire.
   - `defaultPriority` (`number`, « Priorité par défaut », sidebar) et `sectorPriorities` (`array`, « Priorités par secteur ») avec `nafCode` (`text`, requis, `validate: NafCodeValidator.validate`, description « Section (C) ou code NAF (55, 55.3) ») et `priority` (`number`, requis).
   - `hooks` : `beforeChange: [assignCanonicalId]` ; les hooks de sync arrivent au lot 4.
2. `src/utils/NafCodeValidator.ts` : classe à méthode statique `validate(value)` renvoyant `true` ou un message en français, même expression régulière que `nafCodeSchema` (`/^([A-U]|\d{2}(\.\d{1,2}[A-Z]?)?)$/`). Suivre le style de `UrlValidator` / `IntegerValidator`.
3. Déplacer `assignCanonicalId.ts` vers `src/hooks/shared/`, mettre à jour l'import de `Programs.ts`. Le hook ne change pas : une écriture portant `SystemWorkflowContext` peut imposer son identifiant, toute autre écriture garde l'existant ou en génère un.
4. `pnpm generate:types`, puis `pnpm generate:importmap` (aucun composant ajouté, la commande doit ne rien changer).
5. **Migration.** `pnpm migrate:create canonical_projects` sur une **base vierge** (jamais sur la base de dev en `push`). Compléter le `up` généré par un remplissage, comme l'a fait la migration `20261001_082515_mixed_geographic_coverage` :
   - `UPDATE "projects" SET "_status" = 'published'` : les projets existants restent en ligne ;
   - `UPDATE "projects" SET "canonical_id" = 'c' || substr(encode(sha256(convert_to('project:' || "slug", 'UTF8')), 'hex'), 1, 23) WHERE "canonical_id" IS NULL` : même valeur que `SlugCanonicalId.forProject`.
   Vérifier les noms réels des colonnes dans le SQL généré avant d'écrire ces deux requêtes.
6. Points à vérifier après activation des brouillons :
   - `LinkedProjectsCounter` (`/api/projects?...`) compte toujours les mêmes projets (faux une fois les brouillons activés : la revue de code l'a relevé, le compteur filtre désormais sur `_status = published`) ;
   - `project-images.int.spec.ts` et `seed.int.spec.ts` passent ;
   - le formulaire d'un projet affiche les boutons natifs « Enregistrer le brouillon » et « Publier ».

### Lot 4 : sync CMS → pivot (`apps/cms`)

1. **Composition root.** `canonicalProjectRepository.ts` (`getCanonicalProjectRepository(logger)`) et `canonicalProjectService.ts` (`getCanonicalProjectService(logger)`), copies conformes de leurs équivalents dispositifs, avec `createCanonicalProjectRepository` et `CanonicalProjectService`.
2. **`ProjectCanonicalMapper`.** `constructor(richText: RichTextToMarkdown)`, `map(project: Project): CanonicalProjectInput`. Le projet est lu en `depth: 1`.
   - Thèmes par `THEME_TO_CANONICAL` (`canonicalMappings.ts`).
   - Rich text par `richText.convert(...)`. `description_complementaire` omise si le Markdown obtenu est vide.
   - `image` : seulement si `project.image` est un objet avec `url` ; `chemin_source` = `sourcePath` s'il existe.
   - `dispositifs` : `canonicalId` des dispositifs peuplés ; un dispositif resté en id ou sans `canonicalId` est ignoré.
   - `projets_lies.projets` : `canonicalId` des projets liés peuplés, même règle.
   - `priorite` : `defaut` = `defaultPriority`, `mise_en_avant` = `highlightPriority`, `par_secteur` = `sectorPriorities`. Objet omis s'il est vide.
   - `faq` : omise sans question ; `reponse` = Markdown de `answer`.
   - `statut_projet: 'valide'`, `source: 'INTERNE'`, `date_mise_a_jour` = `updatedAt`, `id` = `canonicalId`.
   - Test unitaire `ProjectCanonicalMapper.spec.ts` avec un convertisseur rich text factice (voir `tests/unit/ProgramCanonicalMapper.spec.ts` et `tests/unit/support/`).
3. **`ProjectCanonicalSyncPolicy`.** Classe pure : `static actionFor(input: { status: 'draft' | 'published'; publishedVersionLive: boolean }): CanonicalSyncAction`.
   - `status === 'published'` → `'save'`
   - `status === 'draft'` et `publishedVersionLive` → `'keep'`
   - `status === 'draft'` et pas de version publiée → `'remove'`
   Réutiliser le type `CanonicalSyncAction` de `CanonicalSyncPolicy.ts`. Test unitaire des trois cas.
4. **`syncProjectCanonicalOnChange`** (`CollectionAfterChangeHook<Project>`), sur le modèle de `syncCanonicalOnPublish` :
   - si `previousDoc.canonicalId` existe et diffère de `doc.canonicalId` : `service.remove(previousId, previousSlug)` ;
   - si `doc._status !== 'published'` : relire le document principal avec `req.payload.findByID({ collection: 'projects', id: doc.id, draft: false, depth: 0, req })` ; `publishedVersionLive = main._status === 'published'`. Un brouillon enregistré par-dessus une version publiée n'écrit que dans la table des versions : le document principal reste `published` ;
   - `'remove'` : `service.remove(doc.canonicalId, doc.slug)` si `canonicalId` existe ; `'keep'` : rien ;
   - `'save'` : relire le projet avec `depth: 1`, `draft: false`, `req` ; mapper ; `service.save(input)` ;
   - toute exception est capturée et émise en `sync_failed` avec `entity: 'project'` : la sync ne bloque jamais l'écriture CMS ;
   - **`req` est passé à chaque appel `payload.*`** (règle du projet : sinon lecture hors transaction).
5. **`removeProjectCanonicalOnDelete`** (`CollectionAfterDeleteHook<Project>`) : copie de `removeCanonicalOnDelete` pour les projets.
6. Brancher les deux hooks dans `Projects.ts` (`afterChange`, `afterDelete`).
7. `PayloadLoggerEventSink.format` : traiter `project_saved`, `project_removed`, `project_dropped` (le `switch` exhaustif l'impose) ; préfixer les messages par l'entité (`canonical project saved "..."`).
8. **Test d'intégration `canonical-project-sync.int.spec.ts`** (base `tee_test`) :
   - un projet créé en brouillon n'est pas dans le pivot ;
   - publié, il y est, avec `id === canonicalId` et `statut_projet === 'valide'` ;
   - un brouillon enregistré par-dessus la version publiée laisse le pivot inchangé (ancien titre servi) ;
   - republié, le pivot porte le nouveau titre ;
   - dépublié, il est retiré ;
   - supprimé, il est retiré ;
   - FAQ, priorités, dispositifs liés et projets liés sont présents dans le pivot.
   Ce test valide l'hypothèse du point 4 sur le comportement des brouillons Payload. S'il la contredit, adapter le calcul de `publishedVersionLive` (par exemple à partir de `previousDoc._status` et de `req.query.draft`) sans changer `ProjectCanonicalSyncPolicy`.

### Lot 5 : lecteur amont unique et seed

1. **`tee-project.schema.ts`** : `teeProjectSchema` (zod, clés inconnues tolérées) pour `id` (nombre), `slug`, `title`, `nameTag`, `shortDescription`, `image?`, `titleLongDescription?`, `longDescription`, `titleMoreDescription?`, `moreDescription?`, `themes`, `mainTheme`, `programs?`, `titleLinkedProjects?`, `descriptionLinkedProjects?`, `linkedProjects?` (nombres), `priority?` (`record` de nombres), `highlightPriority?` (chaîne ou `null`), `sectors?`, `titleFaq?`, `faqs?` (`{ question, answer }`), `metaTitle?`, `metaDescription?`. `teeProjectsSchema = z.array(teeProjectSchema)`. `UpstreamJsonSource.projects()` perd son paramètre générique et renvoie `Promise<TeeProject[]>` après `teeProjectsSchema.parse` (même traitement que `operators()`).
2. **`SlugCanonicalId.forProject(slug)`** : `SlugCanonicalId.from(\`project:${slug}\`)`. Test : stable, forme cuid2, différent de `from(slug)`.
3. **`TeeProjectImporter`** : `constructor(options: { assetsBaseUrl: string })`, `importMany(records: TeeProject[], now: string): CanonicalProjectInput[]`.
   - Construit d'abord `Map<idNumérique, slug>` sur tout le fichier pour traduire `linkedProjects`. Un id inconnu est ignoré et compté (exposé par un accesseur `warnings`).
   - `id` = `SlugCanonicalId.forProject(slug)` ; `dispositifs` = `SlugCanonicalId.from(slugDispositif)` ; `projets_lies.projets` = `SlugCanonicalId.forProject(slugLié)`.
   - Thèmes par `ThemeMapper.toFrench` / `toFrenchList`. Un `mainTheme` inconnu laisse `theme_principal` absent : le projet sera refusé par le validateur et signalé, jamais deviné.
   - `image` : `{ url: assetsBaseUrl + image, chemin_source: image }`. Exposer la base par défaut de `UpstreamAssetSource` (constante statique publique ou accesseur `baseUrl`) pour ne pas la dupliquer.
   - `priorite` : `defaut` = `priority.default`, `par_secteur` = autres clés (triées), `mise_en_avant` = `Number(highlightPriority)` si non nul.
   - `faq`, `seo`, descriptions : voir le tableau du format pivot.
   - `statut_projet: 'valide'`, `source: 'INTERNE'`, `date_mise_a_jour: now`.
   - Test `TeeProjectImporter.spec.ts` sur un extrait, plus un test sur la copie versionnée complète (`static/upstream/projects.json`) : les 91 projets sont valides pour `CanonicalProjectValidator`.
4. **Port `ProjectRelations`** (`to-payload/ProjectRelations.ts`) : `programIdByCanonicalId(id): number | undefined`, `projectIdByCanonicalId(id): number | undefined`. `PayloadProjectRelations` charge les deux tables de correspondance par deux `payload.find` (`limit: 0`, `depth: 0`, `select`), avec une méthode `refreshProjects()` appelée entre les deux passes du seed.
5. **`CanonicalProjectToPayloadMapper`** : `constructor(richText: MarkdownToRichText, relations: ProjectRelations)`, `map(input: CanonicalProjectInput)` renvoie `{ data, warnings }` où `data` porte tous les champs Payload **sauf** `image` et `linkedProjects` (calculés par l'importeur), avec `_status: 'published'` et `canonicalId: input.id`. Thèmes par l'inverse de `THEME_TO_CANONICAL`. Un dispositif introuvable devient un avertissement. Test unitaire.
6. **Seed** :
   - `ProjectsSync(payload, projects: TeeProject[], media?)` : `new TeeProjectImporter(...).importMany(projects, now)` puis, pour chaque entrée, `CanonicalProjectToPayloadMapper.map`.
   - `ProjectImporter` : upsert par slug, image via `ImportedMediaPolicy` à partir de `input.image?.chemin_source`, écritures avec `context: SystemWorkflowContext.create()` pour que `assignCanonicalId` accepte l'identifiant fourni. Renvoie `Map<canonicalId, payloadId>`.
   - `LinkedProjectsUpdater` : seconde passe à partir de `input.projets_lies.projets`, toujours séquentielle (deadlocks sur `projects_rels`).
   - Les avertissements du lecteur et du mapper sont affichés en fin de seed, comme ceux des dispositifs.
   - Supprimer `ProjectMapper.ts` et `types.ts` ; `run.ts` utilise `source.projects()` sans paramètre de type.
   - Le pivot des projets est alimenté pendant le seed par le hook du lot 4 : pas d'étape dédiée.
7. **Ordre d'écriture et pivot.** En passe 1, un projet est publié avant que ses projets liés existent : son pivot est écrit sans `projets_lies.projets`. La passe 2 réécrit le projet, donc le pivot. Vérifier dans `seed.int.spec.ts` qu'à la fin du seed un projet lié porte bien ses références dans le pivot.
8. `tests/fixtures/projects.json` : 4 ou 5 projets (dont un avec FAQ, un avec priorités par secteur, deux liés entre eux) référençant des slugs de `tests/fixtures/programs.json`.

### Lot 6 : import quotidien et tombstones

1. **`SlugRedirects`** : `constructor(raw: unknown, key: string)`, mêmes méthodes que `ProgramRedirects` (`entries()`, `size`). `ProgramRedirects extends SlugRedirects` avec la clé `program_redirects` ; `ProjectRedirects extends SlugRedirects` avec `project_redirects`.
2. **`ProjectTombstoneBuilder.build(redirects, inputsBySlug)`** renvoie `{ tombstones, markedInPlace, skipped }` (réutiliser le type `RedirectSkip`). Même algorithme que `RedirectTombstoneBuilder` :
   - cible absente → `skipped` (`reason: 'projet de remplacement absent'`) ;
   - ancien slug encore présent comme projet réel → marqué en place (`statut_projet = 'remplace'`, `remplace_par = cible.id`) ;
   - sinon clone de la cible sous l'ancien slug, `id = SlugCanonicalId.forProject(ancienSlug)`, `statut_projet = 'remplace'`, `remplace_par = cible.id`.
   Test avec `maintenance-préventive` → `maintenance-preventive` (slug hérité accepté).
3. **`scripts/import-projects.ts`**, calqué sur `import-tee.ts` :
   - `--remote` : `UpstreamJsonSource.fromSettings(UpstreamFallbackSettings.fromEnv())`, `projects()` et `redirects()` ; sinon `static/input/projects.json` avec repli sur `static/input/projects-tests.json`, et `redirects.json` avec repli sur `redirects-tests.json` ;
   - `TeeProjectImporter.importMany` → `ProjectTombstoneBuilder` → `CanonicalProjectService.applySnapshot(inputs, guard)` avec `createCanonicalProjectRepository()` ;
   - `--allow-mass-removal` lève le plafond du garde-fou ;
   - même compte rendu que `import-tee.ts` (écrits, retirés, réidentifiés, conservés, redirections, ignorés), en parlant de « projets » ;
   - chemins résolus depuis le fichier du script, pas depuis le cwd ; sortie en code 1 sur exception.
4. `project.json` : target `import:projects` (`tsx scripts/import-projects.ts`). Vérifier que `tsconfig.scripts.json` couvre le nouveau script (target `typecheck`).
5. `package.json` :
   - `data:daily` : `tsx libs/format-adapters/scripts/import-tee.ts --remote && tsx libs/format-adapters/scripts/import-projects.ts --remote && tsx libs/format-adapters/scripts/grist-setup.ts && tsx libs/format-adapters/scripts/export-grist.ts --push` ;
   - `data:daily:dev` : même enchaînement par les targets nx.
   `cron.json` ne change pas.
6. Fixtures : `static/input/projects-tests.json` (extrait de 5 projets dont la cible d'une redirection), `project_redirects` ajouté à `redirects-tests.json`.

### Lot 7 : API AGIR

Tout ce qui est logique de format vit dans `libs/format-adapters/src/agir/projects/` ; les endpoints ne font que transporter.

1. `AgirVocabulary.ETAT_PROJET = { valide: 'en_prod', remplace: 'remplace' } as const` ; `AgirProjetEtatMapper.toEtat(statut)`.
2. **`AgirProjetReferences`** : construit depuis `{ projects: readonly CanonicalProject[]; programs: readonly CanonicalProgram[] }`.
   - `projectSlug(id)` : slug du projet d'identifiant donné, ou `undefined` ;
   - `linkedProjectSlug(id)` : idem, mais seulement pour un projet `valide` (un tombstone n'est pas proposé comme projet lié) ;
   - `programSlug(id)` : slug du dispositif, seulement s'il est exportable (`AgirExportPolicy.isExportable`).
3. **`AgirProjetListeExporter({ baseUrl })`** : `exportMany(projects)` et `export(project)` → `ListeProjet` :
   ```ts
   interface ListeProjet {
     idProjet: string            // slug
     titre: string
     source: string              // AgirSourceMapper
     etatProjet: string          // AgirProjetEtatMapper
     dateDerniereModification: string
     urlPivot: string            // `${baseUrl}/api/agir/projects/${encodeURIComponent(slug)}/pivot`
   }
   ```
4. **`AgirProjetPivotExporter(references, { baseUrl })`** : `export(project)` → `AgirProjetPivot`, construit champ par champ en liste blanche puis revalidé par `agirProjetPivotSchema` (`.strict()`), comme `AdemePivotExporter`. Deltas par rapport au pivot interne :
   - `id` = slug ;
   - `source` en minuscules (`AgirSourceMapper`) ;
   - `statut` = `AgirProjetEtatMapper.toEtat(statut_projet)` ;
   - `remplace_par` = slug du projet courant (omis s'il est introuvable) ;
   - `theme_principal` et `themes` par `AgirThemeMapper` ;
   - `dispositifs` = slugs des dispositifs exportables, dans l'ordre du pivot ;
   - `projets_lies.projets` = slugs des projets valides ;
   - `image.url` rendue absolue (`baseUrl` + chemin enraciné), `chemin_source` non exposé ;
   - le reste (`titre`, `nom_court`, descriptions, `secteurs`, `priorite`, `faq`, `seo`, `date_mise_a_jour`) tel quel.
5. `src/__fixtures__/canonical-projects.ts` : `minimal`, `full`, `replaced`. Tests des deux exporters (liens absolus, slug encodé, dispositif non exportable écarté, projet lié remplacé écarté, URL d'image relative rendue absolue, champ interne absent de la sortie).
6. **`PublicBaseUrlResolver`** (`apps/cms/src/utils/`, sans lien avec AGIR) : `static resolve(req: PayloadRequest): string`, logique actuelle de `resolveBaseUrl`. `agirProgramEndpoints.ts` (ex `agirEndpoints.ts`) l'utilise.
7. **`agirProjectEndpoints.ts`** : `GET /agir/projects` (`repository.findAll()` → `AgirProjetListeExporter`) et `GET /agir/projects/:slug/pivot` (`findBySlug`, 404 `{ error: 'Projet introuvable' }` si absent, sinon références construites depuis `findAll()` des deux repositories → `AgirProjetPivotExporter`). Tout projet stocké est exportable : pas de politique d'export dédiée.
8. `payload.config.ts` : `endpoints: [...agirProgramEndpoints, ...agirProjectEndpoints]`.
9. **Test d'intégration `agir-projects.int.spec.ts`** : après seed des fixtures, l'index liste les projets publiés, le pivot d'un projet renvoie les slugs de ses dispositifs et projets liés, un slug inconnu renvoie 404, un brouillon est absent de l'index.

### Lot 8 : documentation

1. `CLAUDE.md` racine : commandes (`import:projects`), section Seed (nouveau chemin des projets), `apps/cms` (services, hooks, endpoints), `libs/canonical`, `libs/canonical-store`, `libs/format-adapters`, pipeline quotidien, index des ADR (ligne 0014).
2. `docs/context/canonical-project-format.md` (référence des champs), `projects-model.md`, `agir-export-format.md` (section « Projets » : routes, exemples `curl`, format, vocabulaire placeholder), `seed.md`.
3. Addendum à l'ADR 0003, renvoi dans l'ADR 0008.
4. `docs/features/TASKS.md` : statut `done` et date.
5. Reste à faire à la main si l'outillage ne peut pas modifier le fichier : rien à ajouter dans `apps/cms/.env.example` (aucune nouvelle variable).

---

## Vérification

```sh
pnpm db:up

pnpm test:libs                 # canonical, canonical-store, format-adapters (sans Docker)
pnpm nx run @tee-backoffice/format-adapters:typecheck

pnpm test:unit
pnpm test                      # intégration, base tee_test
pnpm typecheck
pnpm nx run-many -t lint

pnpm migrate:status            # la migration canonical_projects est appliquée
pnpm seed                      # 91 projets publiés, 0 erreur
pnpm nx run @tee-backoffice/format-adapters:import:projects   # fixtures locales
pnpm data:daily:dev            # import des dispositifs, Grist, puis import des projets depuis l'amont

pnpm nx run @tee-backoffice/cms:dev
curl http://localhost:3000/api/agir/projects
curl http://localhost:3000/api/agir/projects/plan-action-eco-energie/pivot
curl -i http://localhost:3000/api/agir/projects/vehicule-propre/pivot   # tombstone : statut remplace, remplace_par voiture-propre
curl -i http://localhost:3000/api/agir/projects/inconnu/pivot           # 404
```

Critères de fin :

- après `pnpm seed`, `canonical.canonical_projects` contient 91 lignes ; après l'import direct, 97 (91 projets + 6 tombstones, moins les redirections dont la cible manque) ;
- un projet repassé en brouillon dans l'admin reste servi par l'API dans sa version publiée ; dépublié, il disparaît de l'index ;
- un second `pnpm seed` ne crée ni projet ni média ;
- `pnpm data:daily:dev` relancé deux fois de suite donne le même contenu de store, hors `date_mise_a_jour`.

---

## Points d'attention

- **Brouillons Payload et hook** : l'hypothèse « un brouillon enregistré par-dessus une version publiée laisse le document principal `published` » est à confirmer par le test d'intégration du lot 4 avant d'aller plus loin.
- **Validation relâchée en brouillon** : Payload ne contrôle pas les champs requis d'un brouillon. Le pivot, lui, ne reçoit que des projets publiés, donc complets.
- **Bug Payload des `select hasMany` imbriqués** (ADR 0011) : les nouveaux arrays `faqs` et `sectorPriorities` ne contiennent aucun `select hasMany`, la table des versions n'est donc pas concernée. Ne pas en ajouter.
- **Migration** : générée sur une base vierge, jamais sur la base de dev. Ne jamais lancer une commande en `NODE_ENV=production` sur une base créée en `push`.
- **`req` dans les hooks** : tout appel `payload.*` d'un hook le reçoit.
- **`libs/canonical`** : aucune dépendance à Payload ni à un driver SQL ; clés et messages en français.
- **Une classe par fichier**, nommée comme le fichier ; commentaires en anglais, seulement pour expliquer un « pourquoi ».

---

## Résultats (2026-10-01)

- **Contrôles de code** : lint des 4 projets, typecheck du CMS, typecheck des scripts de `format-adapters` et build du CMS verts. Tests à la livraison de la feature : `libs/canonical` 135, `libs/canonical-store` 32, `libs/format-adapters` 486, CMS unitaires 187, CMS intégration 95. Après les correctifs de la revue de code (même jour) : `libs/canonical` 137, `libs/canonical-store` 40, `libs/format-adapters` 514 (`pnpm test:libs`, 691 tests), CMS unitaires 223 (21 fichiers), CMS intégration 104 (15 fichiers) ; lint, typecheck du CMS et typecheck de `format-adapters` verts. Le build du CMS n'a pas été relancé après les correctifs.
- **Import direct depuis l'amont réel**, sur une base jetable : 97 lignes dans `canonical.canonical_projects` (91 projets `valide` + 6 tombstones `remplace`), aucun invalide, aucun avertissement du lecteur. Relancé, l'import donne le même contenu hors `date_mise_a_jour`. Garde-fou vérifié : un snapshot qui retirerait 90 des 97 lignes est refusé avec « 90 suppression(s) sur 97 projet(s) stocké(s), limite 9 », et passe avec `--allow-mass-removal`.
- **Seed complet** sur une base jetable : 91 projets publiés, 91 lignes pivot, 48 questions de FAQ sur 11 projets, 65 priorités par secteur sur 36 projets, 74 projets avec des projets liés, 0 erreur. Second seed : 0 créé, 91 mis à jour.
- **Migration** `20261001_092812_canonical_projects` éprouvée sur une base vierge et sur une base peuplée, `down` compris.
- **Non vérifié** :
  - l'affichage des boutons natifs « Enregistrer le brouillon » et « Publier » dans l'admin (aucun serveur de dev lancé) ;
  - les images pendant le seed d'essai : elles n'ont pas été téléchargées (bucket désactivé volontairement), ce chemin n'est couvert que par `project-images.int.spec.ts` ;
  - `pnpm import:projects` par la target nx, `pnpm data:daily` et `pnpm data:daily:dev` : non lancés, pour ne pas écrire dans la base de dev ni dans Grist. Le script `import-projects.ts` a été lancé en `tsx` direct ;
  - les appels `curl` de la section « Vérification » : les endpoints sont couverts par `agir-projects.int.spec.ts`, qui appelle les handlers directement.

---

## Écarts constatés à l'implémentation

### Lot 1 : domaine

- Les sous-schémas `projetImageSchema`, `projetDescriptionSchema`, `projetPrioriteSchema`, `projetsLiesSchema`, `projetFaqSchema`, `projetSeoSchema` sont **exportés** : l'export AGIR les réutilise dans son garde-fou.
- Le schéma **accepte les objets optionnels vides** (`priorite: {}`, `seo: {}`, `projets_lies: { projets: [] }`). La règle « un objet optionnel vide n'est jamais écrit » du plan est tenue par les mappers, pas par le schéma.
- `contenu` et `reponse` (Markdown) ne sont pas rognés : seule la longueur minimale de 1 est contrôlée.
- Les clés inconnues sont retirées en silence (comportement par défaut de `z.object`), pas refusées.

### Lot 2 : store

- **Repository projet dupliqué**, sans classe de base commune : le typage Drizzle d'une table générique était trop lourd (option prévue par le plan).
- **Mémoïsation par URL** : l'entrée est retirée et le pool fermé si la connexion échoue, pour que l'appel suivant réessaie.
- Fixtures de projet **portées en ligne** dans le test du repository : les frontières de modules nx interdisent d'importer celles de `libs/canonical/tests/`.
- Deux tests ajoutés : `canonicalDatabaseUrl.spec.ts` et `createCanonicalDb.spec.ts`.

### Lot 3 : modèle Payload

- **La migration remplit aussi la table des versions** `_projects_v` (une version publiée par projet existant, avec ses thèmes, secteurs et relations). Sans elle, les projets existants disparaissaient de la liste de l'admin, qui lit la dernière version de chaque document.
- `min: 0` sur `defaultPriority` et `sectorPriorities.priority`. Payload ne contrôle pas le caractère entier : une valeur décimale est refusée par le pivot, le projet est signalé (`project_dropped`) et l'écriture CMS n'est pas bloquée.
- `NafCodeValidator` gère lui-même le caractère requis : un `validate` custom remplace le contrôle natif de Payload.

### Lot 4 : sync CMS → pivot

- Le hook **calcule l'action avant** de retirer l'ancienne ligne d'un `canonicalId` réaligné, et ne retire rien sur `keep` (le plan retirait d'abord). Un brouillon qui réaligne l'identifiant par-dessus une version publiée laisse donc la ligne publiée en place.
- L'hypothèse du plan sur les brouillons Payload est confirmée par `canonical-project-sync.int.spec.ts` : un brouillon enregistré par-dessus une version publiée laisse le document principal `published`.
- `ProjectCanonicalMapper` : une question de FAQ est omise si la question ou la réponse est vide ; `projets_lies` est gardé avec `projets: []` s'il porte un titre ou une description ; `seo` est écrit dès qu'un de ses deux champs existe.
- Tests ajoutés au plan : réalignement du `canonicalId` par une écriture système, `canonicalId` envoyé hors contexte système ignoré, écriture CMS jamais bloquée quand le pivot refuse le projet.

### Lot 5 : lecteur amont et seed

- `teeProjectSchema` est en **`.passthrough()`, sans transformation** : la copie versionnée (`pnpm data:snapshot`) reste une copie fidèle de l'amont. `scripts/snapshot-upstream.ts` a été ajusté à la nouvelle signature de `projects()`.
- `TeeProjectImporter` : l'option `assetsBaseUrl` est **facultative** (défaut : la base de `UpstreamAssetSource`, donc `TEE_ASSETS_BASE_URL`) ; **avertissements supplémentaires** (thème inconnu, `highlightPriority` non numérique, question de FAQ incomplète, chemin d'image invalide, en plus du projet lié inconnu prévu) ; tableaux vides omis (`themes`, `secteurs`, `dispositifs`).
- `CANONICAL_TO_THEME` est exporté depuis `canonicalMappings.ts` et partagé par les deux mappers vers Payload (dispositifs et projets).
- `CanonicalProjectToPayloadMapper` : méthode `mapLinkedProjects` pour la seconde passe ; **libellé lisible** des identifiants dans les avertissements (le slug, fourni par `ProjectsSync`) ; le mapper **écrit tous les champs**, un absent en `null` ou `[]`, parce qu'un `update` Payload part de la dernière version, brouillon en attente compris ; avertissement pour un secteur hors sections NAF.
- Le seed **vide désormais les projets liés** retirés en amont (ils restaient en place auparavant).
- Un `theme_principal` absent est une **erreur du seed** (exception du mapper, comptée par projet), pas un avertissement.
- `ImportResult.warnings` : les avertissements remontent jusqu'à `run.ts`.

### Lot 6 : import quotidien

- Le compte rendu a une rubrique de plus : « Avertissements du lecteur ».

### Lot 7 : API AGIR

- `AgirThemeMapper.toAgirTheme` ajouté, pour traduire `theme_principal`.
- Dans le pivot exporté, `remplace_par` et `dispositifs[]` acceptent un **slug hérité** (ils peuvent désigner un tombstone) ; `projets_lies.projets[]` reste en kebab-case strict.
- **Image omise** quand le résultat n'est pas une URL `http(s)` absolue (le plan prévoyait seulement de rendre l'URL absolue).
- Une liste de références dont tous les éléments sont écartés reste présente, vide.
- `AgirProjetListeExporter.exportMany` ne filtre rien : tout projet stocké est publié.
- Tests d'intégration des endpoints **par appel direct des handlers** (`createLocalReq`), sans serveur HTTP.

---

## Correctifs après revue de code (2026-10-01)

Une revue de code de la branche a relevé quinze constats, tous vérifiés. Ils sont corrigés ; les raisons sont dans l'[ADR 0014](../adr/0014-canonical-projects.md), section « Révisions ».

### Domaine, store, lecteur amont et pipeline (`libs/**`, racine)

| Constat | Correctif | Fichiers |
|---|---|---|
| Conflit de slug dans le store : une publication CMS finissait en `sync_failed` dès que la ligne du slug portait un autre identifiant | `save` et `applyChanges` évincent dans la transaction la ligne de même slug sous un autre identifiant, puis émettent `project_removed` / `program_removed` | `DrizzleCanonicalProjectRepository.ts`, `DrizzleCanonicalProgramRepository.ts`, ports `CanonicalProjectRepository.ts` et `CanonicalProgramRepository.ts` |
| Retrait fictif journalisé à chaque enregistrement d'un brouillon jamais publié | `delete` renvoie un booléen ; `remove` n'émet que si une ligne a été retirée | les deux repositories, `CanonicalProjectService.ts`, `CanonicalProgramService.ts` |
| `projects.json` validé en bloc : une entrée hors forme faisait échouer seed, postdeploy et job quotidien | `TeeProjectRecords.parse` (un enregistrement à la fois), `UpstreamJsonSource.rejectedProjects`, cellules vides ou `null` lues comme absentes (`emptyAsAbsent`, partagé avec `tee-operator.schema.ts`) ; `import:projects` conserve la ligne d'un enregistrement écarté | `TeeProjectRecords.ts`, `emptyAsAbsent.ts`, `tee-project.schema.ts`, `UpstreamJsonSource.ts`, `scripts/import-projects.ts` |
| Chemin d'image amont inexploitable lu comme « pas d'image » | `TeeProjectImporter.unusableImagePaths` (slug → chemin brut) | `TeeProjectImporter.ts` |
| `pnpm data:snapshot` réordonnait les clés de la copie versionnée | `UpstreamJsonSource.raw('projects')` : copie écrite depuis le fichier brut | `UpstreamJsonSource.ts`, `scripts/snapshot-upstream.ts` |
| `import-projects` au milieu de la chaîne `&&` : un échec côté projets bloquait Grist | Import des projets en fin de `data:daily` et `data:daily:dev` | `package.json` |
| Tests des libs absents de la CI | Script `pnpm test:libs` et job « Library tests » | `package.json`, `.github/workflows/ci.yml` |

### CMS (`apps/cms`)

| Constat | Correctif | Fichiers |
|---|---|---|
| « Dupliquer » donnait à la copie le `canonicalId` `<id> - Copy` | `disableDuplicate: true` sur le champ, pour les projets et les dispositifs | `collections/Projects.ts`, `collections/Programs.ts` |
| Singletons mémoïsant une promesse rejetée | `RetryableMemo` : une promesse rejetée est oubliée, l'appel suivant réessaie | `services/canonical/RetryableMemo.ts`, `canonicalProjectRepository.ts`, `canonicalProjectService.ts`, `canonicalRepository.ts`, `canonicalProgramService.ts` |
| Le seed publiait l'image ou les projets liés d'un brouillon en attente | `image` et `linkedProjects` toujours écrits en passe 1 (valeur de la ligne principale quand le seed n'a rien à y changer) | `scripts/sync/projects/ProjectImporter.ts` |
| Image détachée sur chemin amont inexploitable | Le chemin brut est transmis à `ImportedMediaPolicy` : téléchargement en échec, compté, image conservée | `ProjectImporter.ts`, `scripts/sync/projects/index.ts` |
| Enregistrements amont écartés invisibles pour le seed | Listés en fin de seed et comptés dans les erreurs (code de sortie 1) | `scripts/seed/run.ts` |
| Code NAF validé rogné, stocké brut | Valeur brute validée par `nafCodeSchema` (seconde copie de l'expression régulière supprimée) | `utils/NafCodeValidator.ts` |
| Slug libre et priorités décimales acceptés par l'admin, refusés par le pivot | `SlugValidator` (`slugSchema` du pivot) sur `Projects.slug` et `Programs.slug` ; `IntegerValidator.nonNegative`, qui respecte désormais `required`, sur les trois priorités | `utils/SlugValidator.ts`, `utils/IntegerValidator.ts`, `collections/Projects.ts`, `collections/Programs.ts` |
| Dispositif non lié quand sa ligne principale garde un ancien identifiant | Index par `canonicalId` stocké et par identifiant dérivé du slug (dispositifs et projets) | `services/canonical/to-payload/PayloadProjectRelations.ts` |
| Compteur de projets liés comptant les brouillons | Filtre `where[_status][equals]=published` | `components/programs/LinkedProjectsCounter.tsx` |
| `sync_failed` sans distinction projet / dispositif | Message « canonical project sync failed » quand `entity` vaut `project` | `services/canonical/observability/PayloadLoggerEventSink.ts` |
| Suite `ProjectsSync` dépendante de l'ordre des fichiers | Les projets de la fixture sont supprimés au début du `beforeAll` | `tests/int/seed.int.spec.ts` |

Non modifié, par choix : le hook `syncProjectCanonicalOnChange`. La relecture et le `DELETE` à vide d'un brouillon jamais publié restent ; l'événement fictif est supprimé côté domaine, et le seul garde sûr (`operation === 'create'`) n'épargnerait qu'un enregistrement.

`Media.sourcePath` (texte unique, même verrou d'accès que `canonicalId`) : par l'admin et l'API REST, la copie d'un média importé a un `sourcePath` vide, l'accès de champ retirant la valeur. Par la Local API (accès contournés), elle recevait `<chemin> - Copy` : le champ porte depuis `disableDuplicate: true` (voir « Duplication et textes vides »).

### Tests ajoutés ou étendus

| Fichier | Couvre |
|---|---|
| `tests/int/duplicate-canonical-id.int.spec.ts` (créé, remplacé depuis par `duplicate.int.spec.ts`) | Copie d'un projet et d'un dispositif : cuid2 valide et distinct, ligne pivot sous l'identifiant de la copie |
| `tests/int/canonical-project-sync.int.spec.ts` | Publication sous un slug que le store porte sous un autre identifiant (une seule ligne, aucun `sync_failed`) ; slug non kebab-case, priorité décimale, priorité de secteur manquante et code NAF avec espace refusés à la publication ; slug provisoire accepté en brouillon |
| `tests/int/seed.int.spec.ts` | Image et projets liés d'un brouillon en attente jamais publiés, y compris après la seule passe 1 ; indépendance à l'ordre des fichiers (vérifiée dans les deux ordres avec `agir-projects.int.spec.ts`) |
| `tests/int/project-images.int.spec.ts` | Chemin amont non enraciné : image conservée, un échec compté |
| `tests/int/canonical-publish-realigned.int.spec.ts` | Simplifié : le contournement manuel du conflit de slug est retiré |
| `tests/unit/SlugValidator.spec.ts`, `RetryableMemo.spec.ts`, `canonicalServiceBootstrap.spec.ts`, `PayloadProjectRelations.spec.ts`, `PayloadLoggerEventSink.spec.ts` (créés) | Règle kebab-case et accord avec `slugSchema` ; réessai après un échec, pour la classe et pour les deux services ; résolution par identifiant stocké ou dérivé du slug ; libellé de `sync_failed` |
| `tests/unit/NafCodeValidator.spec.ts`, `IntegerValidator.spec.ts` | Valeurs avec espaces refusées ; caractère requis respecté |

---

## Duplication et textes vides (2026-10-01)

Deux points ouverts de la revue sont traités ; les raisons sont dans l'[ADR 0014](../adr/0014-canonical-projects.md), révision « duplication en brouillon, textes faits d'espaces ». Aucune migration : options de champ, hooks et validations seulement.

### Duplication

Cause du statut `publie` d'une copie : Payload remplit les champs absents de la requête avec les valeurs de l'original, `workflowStatus` compris, et la branche « création » de `beforeChangeWorkflow` garde le statut reçu puis en déduit `_status: published`, par-dessus le `_status: draft` que Payload pose pour un brouillon. La copie d'un dispositif publié était donc publiée, sans validation.

| Correctif | Fichiers |
|---|---|
| `disableDuplicate: true` sur `workflowStatus`, `workflowHistory`, `replacedBy`, `lastModifiedBy`, `assignedContributors` | `collections/Programs.ts` |
| `duplicateAsDraft` (beforeOperation) : `draft: true` forcé sur toute duplication | `hooks/shared/duplicateAsDraft.ts`, `collections/Projects.ts`, `collections/Programs.ts` |
| `assignCopySlug` (`beforeDuplicate` de `slug`) et `CopySlug` : `<slug>-copy`, `<slug>-copy-2`... | `hooks/shared/assignCopySlug.ts`, `utils/CopySlug.ts`, les deux collections |
| `disableDuplicate: true` sur `Media.sourcePath` | `collections/Media.ts` |

Résultat, identique par l'admin (`POST /:collection/:id/duplicate` avec `{ _status: 'draft' }`), par l'API REST et par la Local API, avec ou sans `draft` : projet en `_status: draft` ; dispositif en `en-creation`, historique vide, `replacedBy` vide, contributeur = le créateur qui duplique ; `canonicalId` neuf ; slug kebab-case libre ; rien dans le pivot avant publication, ligne de l'original inchangée.

Autres collections, non modifiées :

| Collection | Duplication |
|---|---|
| `Operators`, `OperatorGroups` | La première copie fonctionne (`name` et `slug` suffixés ` - Copy`). Une seconde copie du même original est refusée (« La valeur doit être unique », champ `name`) tant que la première n'a pas été renommée : comportement natif de Payload pour un champ unique |
| `GeographicAreas` | Fonctionne, sans limite : aucun champ unique. La copie est un doublon exact (même `inseeCode`) |
| `Media` | Fonctionne : fichier copié sous un nouveau nom (`-1`, `-2`...), `sourcePath` vide |
| `Users`, `ReviewComments` | `Users` n'est pas duplicable (collection d'authentification) ; `ReviewComments` est masquée de l'admin |

### Textes requis faits d'espaces

| Correctif | Fichiers |
|---|---|
| `RequiredTextValidator` (`text`, `textarea`) sur `Projects.title`, `nameTag`, `shortDescription`, `faqs.question` et `Programs.title`, `promise`, `otherCriteria.value` | `utils/RequiredTextValidator.ts`, les deux collections |
| `RequiredRichTextValidator` sur `Projects.longDescription`, `faqs.answer` et `Programs.description`, `steps.description` | `utils/RequiredRichTextValidator.ts`, les deux collections |

Déjà couverts par leur propre validateur : `slug` (`SlugValidator`), `Programs.url` (`UrlValidator`), `sectorPriorities.nafCode` (`NafCodeValidator`). Laissés de côté : les champs requis d'un autre type (select, relation, nombre), les textes facultatifs (rognés ou omis par le mapper), et les autres collections. Les données amont passent : 276 dispositifs et 91 projets, aucun texte requis vide (aller-retour `upstream-roundtrip.int.spec.ts`, 0 erreur ; contrôle direct de `projects.json`).

### Tests

| Fichier | Couvre |
|---|---|
| `tests/int/duplicate.int.spec.ts` (remplace `duplicate-canonical-id.int.spec.ts`) | En `overrideAccess: false`, admin et créateur : projet publié, dispositif publié, archivé, remplacé ; brouillon même si l'appel demande une publication ; identité neuve, slug kebab-case, numérotation des copies suivantes ; pivot inchangé pour l'original, absent pour la copie ; copie publiée ensuite (workflow complet pour un dispositif) et stockée sous son identifiant ; commentaires de relecture non copiés ; refus pour un créateur sans accès en lecture |
| `tests/int/required-text.int.spec.ts` (créé) | Projet et dispositif : chaque texte et rich text requis fait d'espaces refusé hors brouillon, accepté en brouillon ; texte entouré d'espaces et texte facultatif vide toujours acceptés |
| `tests/int/canonical-project-sync.int.spec.ts` | « never blocks the CMS write » simule désormais une panne du store (`save` du repository rejeté) : il ne reste aucun écart atteignable par l'API entre Payload et le pivot pour provoquer un refus |
| `tests/int/media-rules.int.spec.ts` | Copie d'un média importé sans `sourcePath` |
| `tests/unit/RequiredTextValidator.spec.ts`, `RequiredRichTextValidator.spec.ts`, `CopySlug.spec.ts`, `duplicateAsDraft.spec.ts` (créés) | Validateurs (requis, facultatif, délégation à la validation native), slugs candidats, drapeau `draft` forcé seulement sur une duplication |

Résultats : CMS unitaires 260 (25 fichiers), CMS intégration 128 (16 fichiers), typecheck et lint du CMS verts.

---

## Identité stable par slug à l'import (2026-10-01)

**Problème.** Le CMS écrit une entité sous le `canonicalId` de son document (cuid2 aléatoire pour un document créé à la main), l'import amont sous un identifiant dérivé du slug. Pour une entité présente des deux côtés, l'identifiant alternait à chaque publication CMS et à chaque import.

**Règle.** `applySnapshot` retrouve chaque entrée par son slug : un slug déjà stocké sous un autre identifiant est mis à jour sous l'identifiant stocké. Les références amont vers l'identifiant dérivé sont réécrites avant validation. Détail et options écartées : ADR 0014, révision du même nom.

| Fichier | Changement |
|---|---|
| `libs/canonical/src/snapshot/CanonicalIdentityMap.ts` | Créé : `fromSnapshot(stored, entries)`, `resolve(id)`, `resolveAll(ids)`, `adopted` |
| `libs/canonical/src/canonical-program/CanonicalProgramService.ts` | `applySnapshot` réécrit `id` et `remplace_par` ; rapport `adopted` |
| `libs/canonical/src/canonical-project/CanonicalProjectService.ts` | `applySnapshot(inputs, guard?, { programIdentities? })` réécrit `id`, `remplace_par`, `projets_lies.projets`, `dispositifs` ; rapport `adopted` |
| `libs/format-adapters/scripts/import-tee.ts`, `import-projects.ts` | Rubrique « Conservés sous leur identifiant stocké » ; le second construit la correspondance des dispositifs depuis les clés de leur store |
| `libs/canonical/tests/unit/CanonicalIdentityMap.spec.ts`, `libs/canonical-store/tests/snapshotIdentity.spec.ts` | Créés ; blocs ajoutés aux specs des deux services |

Résultats : libs 716 tests (canonical 160, canonical-store 42, format-adapters 514). Essai sur base jetable avec l'amont réel (290 dispositifs, 97 projets) : cinq lignes placées sous un identifiant « CMS » le gardent après deux imports, aucun doublon, aucune référence pendante, second import identique au premier.

Vérification d'ensemble après ce correctif et le précédent : lint (4 projets), typecheck CMS et scripts, build CMS, tests des libs, 260 tests unitaires et 128 tests d'intégration du CMS, tous verts.

---

## Points ouverts

| Sujet | État |
|---|---|
| Format attendu par AGIR pour les projets | Aucune spécification reçue. Noms de clés (`idProjet`, `etatProjet`, `urlPivot`) et vocabulaire placeholder, centralisés dans `AgirVocabulary` et les types du dossier `agir/projects/` |
| Divergence entre les deux écrivains | L'import direct écrit l'URL GitHub de l'image, le hook CMS l'URL du bucket ; le Markdown repassé par Lexical peut différer de l'amont ; un projet en brouillon dans le CMS mais présent en amont est réécrit par l'import ; un projet créé seulement dans le CMS est retiré par l'import. Conséquences assumées de « l'amont est maître », levées par le lot 4 de la feature 005 (amont → CMS → pivot) |
| Tombstones après une réinitialisation de la préprod | Le seed ne produit pas de tombstones : ils reviennent au passage suivant du pipeline quotidien. Même comportement que les dispositifs |
| `id` numérique amont des projets | Non gardé dans le pivot. À ajouter (`autres_donnees.id_amont`) si un `TeeProjectExporter` devient nécessaire |
| Statut « remplacé » éditable dans le CMS | Non prévu : à traiter avec la sync quotidienne du CMS |
| Identifiant d'une entité présente dans le CMS et en amont | Levé le 2026-10-01 (voir « Identité stable par slug à l'import ») : l'import garde l'identifiant stocké. Reste une fenêtre : à la première publication CMS, sous son identifiant, d'une entité que l'import avait créée sous l'identifiant dérivé, les références amont vers elle ne sont réalignées qu'à l'import suivant |
| Ordre du pipeline quotidien | Mis de côté le 2026-10-01. `import:projects` est en fin de chaîne `&&` : un échec de l'import des dispositifs ou de Grist bloque l'import des projets. Comportement cible : l'échec d'une étape n'empêche pas les suivantes (code de sortie non nul quand même) ; dans une étape, un enregistrement en erreur n'empêche pas les autres. C'est déjà le cas dans les deux imports (entrée invalide écartée et signalée) ; à vérifier pour le push Grist, dont un lot refusé pourrait échouer en entier |
| Brouillon jamais publié | Chaque enregistrement relit le document et lance un `DELETE` à vide dans le store. Sans événement depuis la revue ; coût laissé tel quel (le seul garde sûr, `operation === 'create'`, n'épargne que le premier enregistrement) |
| Création d'un dispositif avec un statut imposé | À la création, `beforeChangeWorkflow` garde le `workflowStatus` envoyé par l'appelant, sans contrôle de rôle : un appel d'API (création ou duplication) qui envoie `workflowStatus: publie` publie directement, sans validation si l'appel est un brouillon. L'admin n'envoie pas ce champ. Antérieur à cette feature ; à décider avec le workflow (ADR 0005) |
| Seconde copie d'un opérateur ou d'un groupe | Refusée par l'unicité de `name` tant que la première copie n'a pas été renommée (comportement natif de Payload). Non traité : ces collections ne sont dupliquées qu'à la marge |
| Slug hérité dans `Programs` | `SlugValidator` est posé sur `Programs.slug` : les 276 slugs amont sont kebab-case, et les tombstones à slug hérité n'existent que dans le store. Un dispositif saisi à la main avec un slug non kebab-case sur une base existante devra être corrigé à son prochain enregistrement hors brouillon |
| Secteurs hors sections NAF | `Projects.sectors` n'accepte que les sections NAF, le pivot tout code NAF : un code hors section est écarté du CMS avec un avertissement. Sans effet aujourd'hui (l'amont ne publie que des sections dans `sectors`) |
| Slug modifié dans le CMS | Un projet dont le slug a été modifié dans le CMS serait recréé par le seed sous son slug amont, et buterait sur l'unicité de `canonicalId` (erreur signalée, projet non importé) |
| Réécriture des projets liés | La passe 2 du seed réécrit les 74 projets liés à chaque seed : une version Payload et une écriture pivot de plus par projet, même sans changement |
| Base de dev en mode `push` | Au prochain `pnpm dev`, les projets existants passent en brouillon sans version : ils sont absents de la liste de l'admin jusqu'à un `pnpm seed` (ou `pnpm db:reset` puis `pnpm seed`). La migration, elle, traite ce cas hors dev |
| Connexion du store en dev | La mémoïsation de la connexion ne survit pas à un rechargement à chaud de Next |
| Boutons de brouillon dans l'admin | Affichage non vérifié (voir « Résultats ») : à contrôler au premier `pnpm dev` |
| `import-tee.ts` | Contient encore un tiret cadratin dans un message console (non modifié, hors périmètre de cette feature) |
