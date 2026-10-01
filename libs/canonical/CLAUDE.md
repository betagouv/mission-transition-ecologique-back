# `@tee-backoffice/canonical` — instructions locales

> Ces règles ont la **priorité** sur le `CLAUDE.md` racine pour tout le périmètre `libs/canonical/**`.

## Langue — exception au format pivot

La règle racine (« Code en anglais », `CLAUDE.md:68`) reste valable pour le code : variables, fonctions, classes, fichiers et **commentaires** sont en anglais.

**Exception intentionnelle** : les **clés du format pivot** (= format wire) sont en **français `snake_case`** — `statut_dispositif`, `types_aides`, `secteur_geographique`, `date_mise_a_jour`… Idem pour les **valeurs d'enum** (`financement`, `pret_prod`, `remplace`…), les **messages de validation** zod et les **labels/descriptions** du dictionnaire `COG_NIVEAUX`.

C'est un choix de conception assumé (source de vérité métier en français) — voir **ADR 0007** (`docs/adr/0007-canonical-pivot-format.md`). Ne pas « angliciser » ces clés/valeurs pour se conformer à la règle racine.

## Architecture : DDD / hexagonal

`libs/canonical` est le **domaine** : TypeScript pur + zod, **sans aucune dépendance framework** (ni Payload, ni driver DB). La règle d'or : tout dépend du domaine, **jamais l'inverse**.

Contenu :
- **Modèle pivot des dispositifs** (`src/canonical-program/`) : schémas zod (source de vérité), types inférés, value object `CanonicalProgram`, `CanonicalProgramValidator`.
- **Modèle pivot des projets** (`src/canonical-project/`, ADR 0014) : `canonical-project.schema.ts` (`canonicalProjectSchema`, `statutProjetSchema` = `valide` / `remplace`, `refineProjetRemplacePar` : `remplace_par` exigé sur un projet `remplace`, refusé sinon ; slug hérité toléré seulement sur un projet `remplace`), `canonical-project.types.ts` (`CanonicalProjectData`, `CanonicalProjectInput`), value object `CanonicalProject`, `CanonicalProjectValidator` (`ProjectValidationResult`). Pas de `statut_edition` : seuls des projets publiés sont stockés. Dispositifs et projets liés sont référencés par identifiant pivot (cuid2).
- **Vocabulaire partagé** (`src/shared/schema/`) : `theme.ts` (`themeSchema` / `Theme`, commun aux dispositifs et aux projets, réexporté par `canonical-program/enums.ts`), `cog.ts`, `operator.ts`.
- **Ports de persistance** : `CanonicalProgramRepository` et `CanonicalProjectRepository` (même interface `save` / `findBySlug` / `findAll` / `listKeys` / `delete` / `applyChanges`, cette dernière atomique ; `save` remplace aussi la ligne qui détient le slug sous un autre identifiant, `delete` renvoie un booléen, vrai si une ligne a été retirée). Le domaine définit le **contrat** ; il ignore la techno de stockage. Un port et un service **par entité** : validateurs et événements diffèrent.
- **Alignement sur un snapshot amont** (`src/snapshot/`, partagé par les deux entités) : `CanonicalKey` (`{ canonicalId, slug }`) et `CanonicalChanges<T>` (`{ delete, save }`), `CanonicalIdentityMap` (identité stable par slug : `fromSnapshot(stored, entries)` calcule, pour chaque entrée dont le slug est déjà stocké sous un autre identifiant, la correspondance « identifiant fourni → identifiant stocké » ; `resolve` / `resolveAll` réécrivent un identifiant ou une liste de références, en une seule étape ; `adopted` liste les clés stockées conservées ; un identifiant stocké déjà porté par une autre entrée du snapshot n'est pas repris), `CanonicalSnapshotPlan<T extends { id, slug }>` (diff pur store/snapshot, calculé sur les entités déjà réidentifiées ; `superseded` n'est plus qu'un filet de sécurité), `CanonicalSnapshotGuard` (refuse un snapshot vide ou trop destructeur ; option `entityLabel`, `'dispositif'` par défaut, `'projet'` pour les projets, reprise dans les messages de rejet), `CanonicalSnapshotRejectedError`. `CanonicalProgramKey` et `CanonicalProgramChanges` restent exportés comme alias.
- **Port d'observabilité** (`src/observability/`) : `CanonicalEventSink` (`emit(event)`, fire-and-forget, ne jette jamais). Le domaine émet des `CanonicalEvent` typés (`program_saved`, `program_removed`, `program_dropped` avec `phase: 'write' | 'read'`, leurs équivalents `project_saved`, `project_removed`, `project_dropped`, et `sync_failed` avec `entity?: 'program' | 'project'`) ; il ignore où ils partent. Briques pures fournies : `NullEventSink` (défaut), `RoutingCanonicalEventSink` (routage par filtre, un événement peut atteindre plusieurs canaux), `CompositeEventSink` (fan-out d'un événement vers un groupe de canaux). Les **canaux concrets** (logger, Sentry, email, Slack) sont des adaptateurs injectés depuis `apps/cms`.
- **Services de domaine** : `CanonicalProgramService` et `CanonicalProjectService` (`save(input)` : valide puis upsert via le port ; `remove(canonicalId, slug)`, qui n'émet l'événement de retrait que si une ligne a réellement été retirée ; `applySnapshot(inputs, guard)` : aligne le store sur un snapshot amont complet sans le vider, via `CanonicalIdentityMap`, `CanonicalSnapshotPlan` et `CanonicalSnapshotGuard` ; une entité dont le slug est déjà stocké est mise à jour **sous l'identifiant stocké** (jamais supprimée puis réécrite sous l'identifiant fourni), et les références vers l'identifiant fourni sont réécrites avant validation : `remplace_par` pour les dispositifs ; `remplace_par`, `projets_lies.projets` et `dispositifs` pour les projets, ce dernier via l'option `programIdentities` (`CanonicalProjectSnapshotOptions`) que l'appelant construit depuis les clés du store des dispositifs ; le rapport liste ces entités dans `adopted` ; `getAll()`). Portent la règle métier « seul un canonical valide est persisté », et **émettent** `program_*` / `project_*` pour rendre les drops visibles. Source-agnostiques (réutilisables par le CMS aujourd'hui, des flux externes demain). Le validateur est instancié **en interne** ; le repository et le sink sont **injectés** (sink optionnel, défaut `NullEventSink`). Types de retour : `CanonicalSaveResult` / `CanonicalSnapshotReport` (dispositifs), `CanonicalProjectSaveResult` / `CanonicalProjectSnapshotReport` (projets).

### Règle de dépendance (hexagonal)
```
apps/cms (adaptateur CMS + composition root) ──▶ libs/canonical (domaine)
libs/canonical-store (infra PostgreSQL/Drizzle) ──▶ libs/canonical (domaine)
```
`libs/canonical` ne dépend de **rien** d'autre.

### Injection de dépendances (composition root dans l'app)
Les **ports** vivent dans le domaine ; les **implémentations concrètes** sont injectées depuis `apps/cms` (ex. `getCanonicalProgramService()` = `new CanonicalProgramService(repository)`, pattern `new Service(new Repo())`). Le mapping CMS-spécifique (Payload `Program` → `CanonicalProgramInput`, via `ProgramCanonicalMapper` + adaptateur markdown) vit dans `apps/cms`, **jamais ici**.

### Interdits dans ce package
- Aucune référence à Payload (`payload`, `payload-types`) ni à un driver DB (`drizzle`, `pg`).
- Les adaptateurs (mapper CMS, repository Drizzle, converters rich text) vivent **hors** du domaine.

> Note : ce package a un `package.json` minimal avec `"type": "module"`, nécessaire pour que node/`tsx` (le seed) traite ses `.ts` comme de l'ESM. Ne pas le retirer.
