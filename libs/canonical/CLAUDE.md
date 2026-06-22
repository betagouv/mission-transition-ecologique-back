# `@tee-backoffice/canonical` — instructions locales

> Ces règles ont la **priorité** sur le `CLAUDE.md` racine pour tout le périmètre `libs/canonical/**`.

## Langue — exception au format pivot

La règle racine (« Code en anglais », `CLAUDE.md:68`) reste valable pour le code : variables, fonctions, classes, fichiers et **commentaires** sont en anglais.

**Exception intentionnelle** : les **clés du format pivot** (= format wire) sont en **français `snake_case`** — `statut_dispositif`, `types_aides`, `secteur_geographique`, `date_mise_a_jour`… Idem pour les **valeurs d'enum** (`financement`, `pret_prod`, `remplace`…), les **messages de validation** zod et les **labels/descriptions** du dictionnaire `COG_NIVEAUX`.

C'est un choix de conception assumé (source de vérité métier en français) — voir **ADR 0007** (`docs/adr/0007-canonical-pivot-format.md`). Ne pas « angliciser » ces clés/valeurs pour se conformer à la règle racine.

## Architecture : DDD / hexagonal

`libs/canonical` est le **domaine** : TypeScript pur + zod, **sans aucune dépendance framework** (ni Payload, ni driver DB). La règle d'or : tout dépend du domaine, **jamais l'inverse**.

Contenu :
- **Modèle pivot** : schémas zod (source de vérité), types inférés, value object `CanonicalProgram`, `CanonicalProgramValidator`.
- **Port de persistance** : `CanonicalProgramRepository` (interface `save` / `findBySlug`). Le domaine définit le **contrat** ; il ignore la techno de stockage.
- **Service de domaine** : `CanonicalProgramService` (`save(input)` : valide puis upsert via le port). Porte la règle métier « seul un canonical valide est persisté ». Source-agnostique (réutilisable par le CMS aujourd'hui, des flux externes demain). Le `CanonicalProgramValidator` est instancié **en interne** ; seul le repository est **injecté**.

### Règle de dépendance (hexagonal)
```
apps/cms (adaptateur CMS + composition root) ──▶ libs/canonical (domaine)
libs/canonical-store (infra libSQL/Drizzle)  ──▶ libs/canonical (domaine)
```
`libs/canonical` ne dépend de **rien** d'autre.

### Injection de dépendances (composition root dans l'app)
Les **ports** vivent dans le domaine ; les **implémentations concrètes** sont injectées depuis `apps/cms` (ex. `getCanonicalProgramService()` = `new CanonicalProgramService(repository)`, pattern `new Service(new Repo())`). Le mapping CMS-spécifique (Payload `Program` → `CanonicalProgramInput`, via `ProgramCanonicalMapper` + adaptateur markdown) vit dans `apps/cms`, **jamais ici**.

### Interdits dans ce package
- Aucune référence à Payload (`payload`, `payload-types`) ni à un driver DB (`drizzle`, `@libsql/client`).
- Les adaptateurs (mapper CMS, repository Drizzle, converters rich text) vivent **hors** du domaine.

> Note : ce package a un `package.json` minimal avec `"type": "module"`, nécessaire pour que node/`tsx` (le seed) traite ses `.ts` comme de l'ESM. Ne pas le retirer.
