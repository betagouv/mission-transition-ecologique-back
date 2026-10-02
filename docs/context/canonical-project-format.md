# Format pivot des projets : référence des champs

Référence du format **pivot interne** des projets, implémenté dans
`libs/canonical/src/canonical-project/` (`@tee-backoffice/canonical`). Pour les
décisions de conception, voir l'[ADR 0014](../adr/0014-canonical-projects.md) ;
pour le pivot des dispositifs, [`canonical-pivot-format.md`](canonical-pivot-format.md).

> Un projet du pivot est toujours un projet **publié** : le pivot ne porte pas de
> statut éditorial. Il est stocké dans `canonical.canonical_projects`
> (`libs/canonical-store`) et exposé à AGIR par `/api/agir/projects`
> (voir [`agir-export-format.md`](agir-export-format.md), section « Projets »).

## Conventions générales

- **Clés** : français, `snake_case`, sans accent ni apostrophe. **Valeurs** textuelles en français accentué normal.
- **Dates** : `date_mise_a_jour` est une date-heure ISO 8601 avec offset (`2026-03-19T17:00:00+01:00`).
- **Champs absents** : un champ optionnel sans valeur est **absent** (pas de `null`, pas de `""`).
- **Markdown** : `description_longue.contenu`, `description_complementaire.contenu` et `faq.questions[].reponse`.
- **Références** : dispositifs, projets liés et projet remplaçant sont désignés par leur **identifiant pivot** (cuid2), jamais par leur slug. Les exports les résolvent en slugs.
- **Validation** : zod est la source de vérité (`canonicalProjectSchema`, fichier `canonical-project.schema.ts`) ; les types `CanonicalProjectData` (sortie validée) et `CanonicalProjectInput` (entrée avant validation) en sont inférés. Point d'entrée : `CanonicalProjectValidator`. Le value object `CanonicalProject` n'est construit qu'à partir de données validées, et il est gelé en profondeur.

## Champs

Colonne « Source Payload » : ce qu'écrit `ProjectCanonicalMapper` (`apps/cms`) à partir d'un projet de la collection `Projects`. Colonne « Source amont » : ce qu'écrit `TeeProjectImporter` (`libs/format-adapters`) à partir de `projects.json`.

### 1. Identité et cycle de vie

| Champ | Type | Requis | Source Payload | Source amont |
|---|---|---|---|---|
| `id` | `Cuid2` | oui | `canonicalId` | `SlugCanonicalId.forProject(slug)` |
| `slug` | kebab-case (voir règles croisées) | oui | `slug` | `slug` |
| `source` | `ADEME` \| `INTERNE` \| `SCHEMA` | oui | `INTERNE` | `INTERNE` |
| `date_mise_a_jour` | date-heure ISO avec offset | oui | `updatedAt` | horodatage de l'exécution (`projects.json` ne porte pas de date de modification) |
| `statut_projet` | `valide` \| `remplace` | oui | `valide` | `valide` ; `remplace` pour un tombstone de redirection |
| `remplace_par` | `Cuid2` | si `remplace` | jamais | identifiant pivot du projet courant |

### 2. Contenu éditorial

| Champ | Type | Requis | Source Payload | Source amont |
|---|---|---|---|---|
| `titre` | chaîne non vide | oui | `title` | `title` |
| `nom_court` | chaîne non vide | oui | `nameTag` | `nameTag` |
| `description_courte` | chaîne non vide | oui | `shortDescription` | `shortDescription` |
| `image` | `{ url, chemin_source? }` | non | `image.url`, `image.sourcePath` (média peuplé) | URL du fichier amont (`UpstreamAssetSource`) et `image` |
| `description_longue` | `{ titre?, contenu }` | oui | `titleLongDescription`, `longDescription` (Lexical vers Markdown) | `titleLongDescription`, `longDescription` |
| `description_complementaire` | `{ titre?, contenu }` | non | `titleMoreDescription`, `moreDescription` | `titleMoreDescription`, `moreDescription` |
| `faq` | `{ titre?, questions[] }` | non | `titleFaq`, `faqs` | `titleFaq`, `faqs` |
| `seo` | `{ titre?, description? }` | non | `metaTitle`, `metaDescription` | `metaTitle`, `metaDescription` |

Détail des objets :

- `image.url` : URL absolue (stockage objet, dépôt amont) **ou** chemin enraciné sans espace (`/api/media/file/...`, cas du développement local sans bucket). `image.chemin_source` : chemin amont d'une image importée, absent pour un upload manuel.
- `description_longue.contenu` et `description_complementaire.contenu` : Markdown, au moins un caractère.
- `faq.questions` : au moins une entrée ; chaque entrée est `{ question, reponse }` (`question` chaîne non vide, `reponse` Markdown d'au moins un caractère). L'`id` numérique amont d'une question n'est pas gardé.

### 3. Ciblage

| Champ | Type | Requis | Source Payload | Source amont |
|---|---|---|---|---|
| `theme_principal` | thème | oui | `mainTheme` via `THEME_TO_CANONICAL` | `mainTheme` via `ThemeMapper.toFrench` |
| `themes` | thème[] | non | `themes` | `themes` |
| `secteurs` | code NAF[] | non | `sectors` (sections) | `sectors` |
| `priorite` | `{ defaut?, mise_en_avant?, par_secteur? }` | non | `defaultPriority`, `highlightPriority`, `sectorPriorities` | `priority.default`, `highlightPriority`, autres clés de `priority` |

- **Thème** : `batiment`, `mobilite`, `dechets`, `eau`, `energie`, `rh`, `environnemental`, `ecoconception`, `biodiversite` (`themeSchema`, `libs/canonical/src/shared/schema/theme.ts`, commun aux dispositifs et aux projets).
- **Code NAF** : section (`A` à `U`) ou code (`55`, `55.3`, `01.11Z`), `nafCodeSchema`.
- `priorite.defaut`, `priorite.mise_en_avant` et `priorite.par_secteur[].priorite` : entiers positifs ou nuls. `par_secteur` : tableau de `{ code_naf, priorite }`. `mise_en_avant` porte le `highlightPriority` amont.

### 4. Relations

| Champ | Type | Requis | Source Payload | Source amont |
|---|---|---|---|---|
| `dispositifs` | `Cuid2`[] | non | `programs[].canonicalId` | `SlugCanonicalId.from(slugDuDispositif)` |
| `projets_lies` | `{ titre?, description?, projets }` | non | `titleLinkedProjects`, `descriptionLinkedProjects`, `linkedProjects[].canonicalId` | `titleLinkedProjects`, `descriptionLinkedProjects`, `linkedProjects` |

- `projets_lies.projets` : tableau (obligatoire dans l'objet, éventuellement vide) d'identifiants pivot de projets.
- Côté amont, `linkedProjects` référence les projets par un `id` numérique propre au fichier : `TeeProjectImporter` le traduit en slug, puis en identifiant pivot. Cet `id` numérique n'est pas gardé dans le pivot.

## Règles croisées

- **`remplace_par`** (`refineProjetRemplacePar`) : obligatoire si `statut_projet = remplace`, interdit sinon.
- **Slug** : kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Exception : un projet `remplace` (tombstone de redirection) garde son ancien slug tel quel (`maintenance-préventive`), sans espace ni `/`.

## Règles du store

- **Un slug, une ligne** : `canonical.canonical_projects.slug` est unique. À l'écriture d'un projet, le repository retire d'abord, dans la même transaction, la ligne qui détiendrait ce slug sous un **autre** identifiant, puis émet `project_removed` pour elle. Une écriture ne bute donc jamais sur l'unicité du slug, quelle que soit la source qui a écrit la ligne en place (CMS ou import amont). Même règle pour les dispositifs.
- **Retrait** : `delete(canonicalId)` renvoie un booléen. `project_removed` n'est émis que si une ligne a réellement été retirée : enregistrer un brouillon jamais publié ne produit aucun événement.

## Ce que le schéma laisse aux mappers

Le schéma est une garde de forme ; trois points sont à la charge de ceux qui le remplissent :

- **Objets optionnels vides** : le schéma accepte `priorite: {}`, `seo: {}` ou `projets_lies: { projets: [] }`. Les deux mappers ne les écrivent pas : un bloc sans rien à porter est omis. Seule exception voulue : `projets_lies` est gardé avec `projets: []` quand il porte un titre ou une description, pour les deux écrivains.
- **Markdown non rogné** : `contenu` et `reponse` ne sont pas passés par `trim()`. Une chaîne faite d'espaces passerait la validation : les mappers omettent une description complémentaire ou une question dont le texte est vide une fois rogné.
- **Clés inconnues** : elles sont retirées en silence à la validation (comportement par défaut de `z.object`), pas refusées.

Les chaînes « non vides » (`titre`, `nom_court`, titres de blocs, question de FAQ) sont rognées par le schéma.

Côté CMS, la collection `Projects` applique à la publication les règles du pivot qu'un éditeur peut enfreindre à la saisie : slug kebab-case (`SlugValidator`, qui délègue à `slugSchema`), priorités entières positives ou nulles (`IntegerValidator.nonNegative`), code NAF sans espace autour (`NafCodeValidator`, qui délègue à `nafCodeSchema` et contrôle la valeur brute). Reste hors de ces contrôles un texte obligatoire fait seulement d'espaces (`title`, `nameTag`, `shortDescription`) : Payload l'accepte, le pivot le refuse (`project_dropped`).

## Sources : ce qui diffère entre le CMS et l'amont

> **Depuis le 2026-10-02**, le store n'a plus qu'un écrivain en fonctionnement normal : les hooks du CMS, que la sync quotidienne alimente depuis l'amont (ADR 0014, révision du 2026-10-02). La colonne « import amont direct » ne décrit plus que l'outil de secours `import:projects`. Côté CMS, `statut_projet` vaut `remplace` pour un projet `workflowStatus: 'remplace'`, avec `remplace_par` = identifiant pivot de son `replacedBy` ; un projet `annule` n'est pas stocké.

Les deux écrivains produisent le même format, avec ces différences connues (ADR 0014 §7) :

| Champ | Écrit par le hook CMS | Écrit par l'import amont direct |
|---|---|---|
| `id` | `canonicalId` du projet : dérivé du slug pour un projet seedé, cuid2 aléatoire pour un projet créé ou dupliqué dans l'admin | toujours `SlugCanonicalId.forProject(slug)` |
| `image.url` | URL du média (bucket, ou chemin enraciné en local) | URL du fichier dans le dépôt amont |
| Markdown | repassé par Lexical | texte amont tel quel |
| `secteurs` | sections NAF seulement (le champ Payload n'accepte que les sections) | tout code NAF publié par l'amont |
| `statut_projet` | `valide`, ou `remplace` pour un projet remplacé du CMS (depuis le 2026-10-02) | `valide`, ou `remplace` pour un tombstone |
| `date_mise_a_jour` | `updatedAt` du projet | heure de l'import |

Un projet que l'amont ne permet pas de mapper (thème principal inconnu) est laissé sans `theme_principal` : le validateur le refuse et il est signalé, jamais deviné.

**Identifiant d'un projet présent des deux côtés.** Quand un projet créé dans l'admin (identifiant aléatoire `X`) porte le slug `p` d'un projet amont (identifiant dérivé `Y`), les deux écrivains se remplacent l'un l'autre : une publication CMS écrit `{X, p}` à la place de `{Y, p}`, l'import quotidien remet `{Y, p}`. Entre les deux, les projets qui référencent `Y` dans `projets_lies.projets` pointent sur un identifiant absent : l'export AGIR omet alors ce lien (aucun lien mort), jusqu'à l'import suivant. Le cas ne concerne pas un projet seedé, dont le `canonicalId` est déjà `Y`.

## Exemples

### Minimal (champs obligatoires seuls)

Fixture `libs/canonical/tests/fixtures/project-valid-minimal.ts`.

```json
{
  "id": "p1b2c3d4e5f6g7h8i9j0klmn",
  "slug": "isolation-thermique",
  "source": "INTERNE",
  "date_mise_a_jour": "2026-06-15T10:00:00+02:00",
  "statut_projet": "valide",
  "titre": "Isoler mon bâtiment",
  "nom_court": "Isolation",
  "description_courte": "Réduire les pertes de chaleur de vos locaux.",
  "description_longue": { "contenu": "Une **isolation** performante réduit la facture." },
  "theme_principal": "batiment"
}
```

### Complet (tous les blocs optionnels)

Fixture `libs/canonical/tests/fixtures/project-valid-full.ts`.

```json
{
  "id": "q1b2c3d4e5f6g7h8i9j0klmn",
  "slug": "plan-action-eco-energie",
  "source": "INTERNE",
  "date_mise_a_jour": "2026-03-19T17:00:00+01:00",
  "statut_projet": "valide",

  "titre": "Mettre en place un plan d’action éco-énergie",
  "nom_court": "Plan éco-énergie",
  "description_courte": "Réduire durablement vos consommations d’énergie.",
  "image": {
    "url": "https://cdn.example.org/media/plan-eco-energie.webp",
    "chemin_source": "/images/projet/plan-eco-energie.webp"
  },
  "description_longue": {
    "titre": "Pourquoi agir ?",
    "contenu": "Un plan d’action structure vos **économies d’énergie**."
  },
  "description_complementaire": {
    "titre": "Pour aller plus loin",
    "contenu": "Suivez vos consommations dans la durée."
  },

  "theme_principal": "energie",
  "themes": ["energie", "batiment"],
  "secteurs": ["C", "I"],
  "priorite": {
    "defaut": 3,
    "mise_en_avant": 1,
    "par_secteur": [
      { "code_naf": "C", "priorite": 1 },
      { "code_naf": "55.3", "priorite": 2 }
    ]
  },

  "dispositifs": ["a1b2c3d4e5f6g7h8i9j0klmn", "tz4a98xxat96iws9zmbrgj3a"],
  "projets_lies": {
    "titre": "Projets complémentaires",
    "description": "Ces projets prolongent votre démarche.",
    "projets": ["p1b2c3d4e5f6g7h8i9j0klmn"]
  },
  "faq": {
    "titre": "Questions fréquentes",
    "questions": [
      { "question": "Par où commencer ?", "reponse": "Par un **diagnostic** de vos consommations." },
      { "question": "Combien de temps faut-il ?", "reponse": "Quelques semaines." }
    ]
  },
  "seo": {
    "titre": "Plan d’action éco-énergie",
    "description": "Mettre en place un plan d’action pour réduire sa consommation d’énergie."
  }
}
```

### Tombstone de redirection

Un ancien slug redirigé en amont (`project_redirects` de `redirects.json`) devient un projet `remplace` : le contenu du projet courant, sous l'ancien slug, avec `remplace_par`. Depuis le 2026-10-02, c'est un projet du CMS (`workflowStatus: 'remplace'`, `replacedBy`), créé par le seed et par la sync quotidienne, que le hook écrit dans le store ; l'import direct `import:projects` produit la même ligne.

```json
{
  "id": "<SlugCanonicalId.forProject('maintenance-préventive')>",
  "slug": "maintenance-préventive",
  "statut_projet": "remplace",
  "remplace_par": "<SlugCanonicalId.forProject('maintenance-preventive')>",
  "...": "le reste est le contenu du projet courant"
}
```

## Tests

- `libs/canonical/tests/unit/canonical-project.schema.spec.ts`, `CanonicalProject.spec.ts`, `CanonicalProjectValidator.spec.ts`, `CanonicalProjectService.spec.ts`, `CanonicalSnapshotPlan.spec.ts`.
- `libs/canonical-store/tests/DrizzleCanonicalProjectRepository.spec.ts` (PGlite).
- `libs/format-adapters/src/tee/TeeProjectImporter.spec.ts` : les projets de la copie versionnée `static/upstream/projects.json` passent le validateur.
- `apps/cms/tests/unit/ProjectCanonicalMapper.spec.ts`, `apps/cms/tests/int/canonical-project-sync.int.spec.ts`.
