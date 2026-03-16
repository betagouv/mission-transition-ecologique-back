# Feature 001 — Collection Projects

## Contexte

Implémenter la collection `Projects` dans PayloadCMS à partir de `docs/sources/projects.json`
(83 projets). Suivre le même pattern que `Programs` (ADR 0003).
Documentation de référence : `docs/adr/0003-projects-collection.md`, `docs/context/projects-model.md`.

## Décisions prises

| Champ | Décision |
|-------|----------|
| `programs` | Relation Payload → Programs (hasMany) |
| `linkedProjects` | Relation self-référentielle Projects → Projects (2 passes seed) |
| `themes` / `mainTheme` | Select enum 9 valeurs (energy, waste, mobility, environmental, building, water, eco-design, rh, biodiversite) |
| `sectors` | Select hasMany enum NAF A→U |
| `image` | Text chemin relatif (comme `illustration` dans Programs) |
| `priority` | Hors scope |
| `faqs` | Hors scope |

## Fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `apps/cms/src/collections/Projects.ts` | Créer |
| `apps/cms/src/seed/projects/types.ts` | Créer |
| `apps/cms/src/seed/projects/ProjectMapper.ts` | Créer |
| `apps/cms/src/seed/projects/ProjectImporter.ts` | Créer |
| `apps/cms/src/seed/projects/LinkedProjectsUpdater.ts` | Créer |
| `apps/cms/src/seed/projects/index.ts` | Créer |
| `apps/cms/src/seed/run.ts` | Modifier (ajouter ProjectsSeed après ProgramsSeed) |
| `apps/cms/payload.config.ts` | Modifier (ajouter Projects aux collections) |

## Étapes d'implémentation

### Étape 1 — Collection `apps/cms/src/collections/Projects.ts`

Créer la collection Payload avec ces champs (s'inspirer de `Programs.ts`) :

**Constantes en tête de fichier :**
- `THEMES_OPTIONS` : 9 valeurs (energy, waste, mobility, environmental, building, water, eco-design, rh, biodiversite) avec labels français
- `NAF_SECTIONS_OPTIONS` : 21 valeurs A→U avec labels descriptifs

**Champs (dans l'ordre) :**

*Identité (slug en sidebar) :*
- `slug` : text, required, unique, sidebar
- `title` : text, required
- `nameTag` : text, required
- `shortDescription` : textarea, required
- `image` : text, optional (description: chemin relatif)

*Contenu :*
- `titleLongDescription` : text, optional
- `longDescription` : richText, required
- `titleMoreDescription` : text, optional
- `moreDescription` : richText, optional

*Thématiques :*
- `mainTheme` : select, required, options: THEMES_OPTIONS
- `themes` : select, hasMany, options: THEMES_OPTIONS

*Classification :*
- `sectors` : select, hasMany, options: NAF_SECTIONS_OPTIONS
- `highlightPriority` : number, optional, sidebar

*Relations :*
- `programs` : relationship → 'programs', hasMany, optional
- `titleLinkedProjects` : text, optional
- `descriptionLinkedProjects` : textarea, optional
- `linkedProjects` : relationship → 'projects', hasMany, optional

*SEO (sidebar) :*
- `metaTitle` : text, optional, sidebar
- `metaDescription` : textarea, optional, sidebar

### Étape 2 — Types `apps/cms/src/seed/projects/types.ts`

```typescript
export interface SourceProject {
  id: number
  slug: string
  title: string
  nameTag: string
  shortDescription: string
  image?: string
  titleLongDescription?: string
  longDescription: string
  titleMoreDescription?: string
  moreDescription?: string
  themes: string[]
  mainTheme: string
  programs?: string[]
  titleLinkedProjects?: string
  descriptionLinkedProjects?: string
  linkedProjects?: number[]
  highlightPriority?: string
  sectors?: string[]
  metaTitle?: string
  metaDescription?: string
  // Ignorés : priority (objet), titleFaq, faqs
}
```

### Étape 3 — `ProjectMapper.ts`

Pattern identique à `ProgramMapper.ts`. Injections : `EditorConfig`, `Map<string, number>` (programSlug → payloadId).

Transformations :
- `longDescription` + `moreDescription` → `convertMarkdownToLexical`
- `programs` : slug[] → IDs via Map (warning stderr si slug manquant, on skip)
- `highlightPriority` : `Number(string)`
- `themes`, `sectors` : passés tels quels

Retourne `null` si les champs required sont manquants (ne pas bloquer).

### Étape 4 — `ProjectImporter.ts`

Pattern identique à `ProgramImporter.ts`.
- `fetchExisting` par `slug` → `Map<string, number>` (slug → payloadId)
- upsert avec `Promise.all`
- **En plus** : construire et retourner `Map<number, number>` (jsonId → payloadId)
  - Lors d'un `create` : stocker `(sourceProject.id → created.id)`
  - Lors d'un `update` : stocker `(sourceProject.id → existingPayloadId)`

Signature : `async import(...): Promise<{ result: ImportResult, jsonIdToPayloadId: Map<number, number> }>`

### Étape 5 — `LinkedProjectsUpdater.ts` (nouvelle classe)

```typescript
export class LinkedProjectsUpdater {
  constructor(private readonly payload: Payload) {}

  async update(
    projects: SourceProject[],
    jsonIdToPayloadId: Map<number, number>,
  ): Promise<{ updated: number; errors: number }>
}
```

Pour chaque projet avec `linkedProjects` non vide :
1. Résoudre `project.linkedProjects.map(id => jsonIdToPayloadId.get(id)).filter(Boolean)`
2. Si des IDs sont manquants, logger sur stderr (warning, pas erreur bloquante)
3. `payload.update({ collection: 'projects', id: jsonIdToPayloadId.get(project.id), data: { linkedProjects: resolvedIds } })`

### Étape 6 — `index.ts` (ProjectsSeed)

```typescript
export class ProjectsSeed {
  constructor(private readonly payload: Payload, private readonly projectsPath: string) {}

  async run(): Promise<void> {
    // 1. Lire projects.json
    // 2. Construire programIdBySlug : payload.find(programs, limit:0, depth:0) → Map<slug, id>
    // 3. Construire EditorConfig
    // 4. Passe 1 : ProjectImporter → { result, jsonIdToPayloadId }
    // 5. Passe 2 : LinkedProjectsUpdater.update(projects, jsonIdToPayloadId)
    // 6. Log résumé
  }
}
```

### Étape 7 — Modifier `apps/cms/src/seed/run.ts`

Ajouter après ProgramsSeed :
```typescript
const projectsPath = resolve(dirname, '../../../../docs/sources/projects.json')
await new ProjectsSeed(payload, projectsPath).run()
```

### Étape 8 — Modifier `apps/cms/payload.config.ts`

Importer et enregistrer la collection :
```typescript
import { Projects } from '@/collections/Projects'
// collections: [Users, Media, Operators, Programs, Projects]
```

## Vérification

```sh
# 1. Lint
pnpm nx affected -t lint

# 2. Typecheck
PATH="~/.nvm/versions/node/v24.13.0/bin:$PATH" node_modules/.bin/tsc --noEmit -p apps/cms/tsconfig.json

# 3. Build
pnpm nx run @tee-backoffice/cms:build

# 4. Générer les types Payload (après migration DB)
# node_modules/.bin/payload generate:types (depuis apps/cms/)

# 5. Seed (après migration DB)
# pnpm nx run @tee-backoffice/cms:dev puis exécuter le script seed
```
