# Modèle de la collection Projects

Spec consolidée pour l'implémentation dans PayloadCMS.
Voir aussi : `docs/adr/0003-projects-collection.md`, `docs/adr/0013-operator-groups-and-media.md` (image en média), `docs/adr/0014-canonical-projects.md` (brouillons, `canonicalId`, FAQ, priorités, format pivot), `docs/context/canonical-project-format.md` (référence du pivot projet)

---

## Collection `Projects`

```
slug: 'projects'
admin.useAsTitle: 'title'
versions.drafts: true
hooks: beforeChange assignCanonicalId, afterChange syncProjectCanonicalOnChange, afterDelete removeProjectCanonicalOnDelete
```

### Brouillons et publication

Les brouillons natifs de Payload sont activés (`versions: { drafts: true }`, ADR 0014 §3) : chaque projet porte un `_status` (`draft` ou `published`) et un historique de versions. Payload ne contrôle pas les champs requis d'un brouillon. La migration `20261001_092812_canonical_projects` a passé les projets existants en `published` et leur a créé une version publiée.

Seuls les projets **publiés** vont dans le format pivot (store `canonical.canonical_projects`), donc dans l'API AGIR. Règle portée par `ProjectCanonicalSyncPolicy` et appliquée par le hook `syncProjectCanonicalOnChange` :

| Situation | Effet sur le pivot |
|---|---|
| Projet publié | écrit |
| Brouillon enregistré par-dessus une version publiée | inchangé : la version publiée reste servie |
| Projet dépublié, ou jamais publié | retiré |
| Projet supprimé | retiré (`removeProjectCanonicalOnDelete`) |

La synchronisation ne bloque jamais l'écriture CMS : un projet que le pivot refuse est journalisé (`project_dropped`), une panne du store aussi (`sync_failed`, journalisé « canonical project sync failed »). Les validations de la collection (slug, priorités, code NAF, voir plus bas) sont alignées sur le pivot : à la publication, ce que l'admin accepte, le pivot l'accepte. Si le store porte déjà le slug sous un autre identifiant (ligne écrite par l'import amont), la publication la remplace : la synchronisation ne bute pas sur l'unicité du slug. Un brouillon jamais publié ne produit aucun événement de retrait.

### Identité

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `canonicalId` | text | unique, indexé, masqué dans l'admin, verrouillé par l'API (`access.create` et `access.update` à `false`), `disableDuplicate` | dérivé du slug : `SlugCanonicalId.forProject(slug)` |
| `slug` | text | required, unique, sidebar, kebab-case (`SlugValidator`, règle `slugSchema` du pivot) | `slug` |
| `title` | text | required, non vide (`RequiredTextValidator`) | `title` |
| `nameTag` | text | required, non vide (`RequiredTextValidator`) | `nameTag` |
| `shortDescription` | textarea | required, non vide (`RequiredTextValidator`) | `shortDescription` |
| `image` | upload → `media` | optional | `image` (chemin amont, téléchargé et importé en média de type `project-image`, seul type accepté, ADR 0013) |

### Contenu

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `titleLongDescription` | text | optional | `titleLongDescription` |
| `longDescription` | richText | required, non vide (`RequiredRichTextValidator`) | `longDescription` (Markdown → Lexical) |
| `titleMoreDescription` | text | optional | `titleMoreDescription` |
| `moreDescription` | richText | optional | `moreDescription` (Markdown → Lexical) |
| `titleFaq` | text | optional | `titleFaq` |
| `faqs` | array | optional | `faqs` |
| `faqs[].question` | text | required, non vide (`RequiredTextValidator`) | `faqs[].question` |
| `faqs[].answer` | richText | required, non vide (`RequiredRichTextValidator`) | `faqs[].answer` (Markdown → Lexical) |

`canonicalId` est l'identité stable du projet dans le pivot (champ `id`). Il est posé par le hook `assignCanonicalId` (`apps/cms/src/hooks/shared/`, le même que pour les dispositifs) : cuid2 aléatoire pour un projet créé dans l'admin, jamais modifiable ensuite par un éditeur ; une écriture système (`SystemWorkflowContext`, seed) impose l'identifiant dérivé du slug, celui qu'utilise aussi l'import amont direct.

**Textes requis** : un champ requis rempli seulement d'espaces (ou, pour un rich text, de paragraphes vides) est refusé à la publication avec « Ce champ est requis. », comme un champ vide. Le contrôle natif de Payload l'acceptait, puis le pivot, qui rogne les textes, refusait le projet sans retour à l'éditeur. Pour un rich text, « vide » est décidé par la conversion Markdown du pivot elle-même. Les espaces autour d'un texte renseigné sont conservés tels quels, et un brouillon reste libre.

**Duplication** (action « Dupliquer » de l'admin, `POST /api/projects/:id/duplicate`, `payload.duplicate`) : la copie est **toujours un brouillon**, quel que soit le statut de l'original et quels que soient les paramètres de l'appel (hook `duplicateAsDraft`). Elle reçoit un cuid2 neuf (`canonicalId` porte `disableDuplicate: true` ; sans cette option, Payload dupliquait la valeur en `<id> - Copy`, invalide pour le pivot et immuable) et le slug `<slug>-copy`, puis `<slug>-copy-2`, `<slug>-copy-3`... si le précédent est pris (hook `assignCopySlug`) et son titre est suffixé de « (copie) » (`assignCopyTitle`). Ce slug est kebab-case : la copie peut être publiée sans le retoucher. Elle n'entre dans le pivot qu'à sa publication, sous son propre identifiant, et la ligne pivot de l'original n'est pas touchée. Le titre et le reste du contenu sont repris tels quels.

### Thématiques

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `mainTheme` | select | required | `mainTheme` |
| `themes` | select | hasMany | `themes` |

Valeurs communes (`THEMES_OPTIONS`) :

| Valeur | Label |
|--------|-------|
| `energy` | Énergie |
| `waste` | Déchets |
| `mobility` | Mobilité |
| `environmental` | Environnement |
| `building` | Bâtiment |
| `water` | Eau |
| `eco-design` | Éco-conception |
| `rh` | RH |
| `biodiversite` | Biodiversité |

### Classification

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `sectors` | select | hasMany | `sectors` (lettres NAF A→U) |
| `highlightPriority` | number | optional, entier positif ou nul (`IntegerValidator.nonNegative`), sidebar | `highlightPriority` (conv. string → number) |
| `defaultPriority` | number | optional, entier positif ou nul (`IntegerValidator.nonNegative`), sidebar | `priority.default` |
| `sectorPriorities` | array | optional | autres clés de `priority` (une ligne par clé, triées) |
| `sectorPriorities[].nafCode` | text | required, validé par `NafCodeValidator` (section `C` ou code `55`, `55.3`, `01.11Z`, sans espace autour) | clé de `priority` |
| `sectorPriorities[].priority` | number | required, entier positif ou nul (`IntegerValidator.nonNegative`) | valeur de `priority` |

Le pivot attend des priorités **entières** positives ou nulles, et un code NAF sans espace. Depuis la revue du 2026-10-01, Payload applique les mêmes règles : une priorité décimale ou un code NAF saisi avec un espace (`C `, copier-coller) est refusé à la publication, avec un message sur le champ. `NafCodeValidator` délègue à `nafCodeSchema` du pivot et contrôle la valeur brute, celle que Payload enregistre. Comme toute validation Payload, ces contrôles sont relâchés à l'enregistrement d'un brouillon.

Valeurs `NAF_SECTIONS_OPTIONS` (21 sections) :

| Valeur | Label |
|--------|-------|
| `A` | Agriculture, sylviculture et pêche |
| `B` | Industries extractives |
| `C` | Industrie manufacturière |
| `D` | Production et distribution d'électricité, de gaz, de vapeur et d'air conditionné |
| `E` | Production et distribution d'eau ; assainissement, gestion des déchets et dépollution |
| `F` | Construction |
| `G` | Commerce ; réparation d'automobiles et de motocycles |
| `H` | Transports et entreposage |
| `I` | Hébergement et restauration |
| `J` | Information et communication |
| `K` | Activités financières et d'assurance |
| `L` | Activités immobilières |
| `M` | Activités spécialisées, scientifiques et techniques |
| `N` | Activités de services administratifs et de soutien |
| `O` | Administration publique |
| `P` | Enseignement |
| `Q` | Santé humaine et action sociale |
| `R` | Arts, spectacles et activités récréatives |
| `S` | Autres activités de services |
| `T` | Activités des ménages en tant qu'employeurs |
| `U` | Activités extra-territoriales |

### Relations

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `programs` | relationship → 'programs' | hasMany, optional | `programs` (slugs → identifiants pivot → IDs Payload) |
| `titleLinkedProjects` | text | optional | `titleLinkedProjects` |
| `descriptionLinkedProjects` | textarea | optional | `descriptionLinkedProjects` |
| `linkedProjects` | relationship → 'projects' | hasMany, optional | `linkedProjects` (ids JSON → slugs → identifiants pivot → IDs Payload, passe 2) |

### SEO

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `metaTitle` | text | optional, sidebar | `metaTitle` |
| `metaDescription` | textarea | optional, sidebar | `metaDescription` |

---

## Mapping complet JSON → Payload

Le JSON amont n'est plus lu par le seed lui-même : il passe par le format pivot (`TeeProjectImporter`, puis `CanonicalProjectToPayloadMapper`). La colonne « Pivot » donne le champ intermédiaire (référence : `docs/context/canonical-project-format.md`).

| Clé JSON | Pivot | Champ Payload | Transformation |
|----------|-------|--------------|----------------|
| `slug` | `slug`, `id` | `slug`, `canonicalId` | `canonicalId` = `SlugCanonicalId.forProject(slug)` |
| `title` | `titre` | `title` | aucune |
| `nameTag` | `nom_court` | `nameTag` | aucune |
| `shortDescription` | `description_courte` | `shortDescription` | aucune |
| `image` | `image.chemin_source` | `image` | Chemin amont → id de média (`UpstreamMediaImporter.findOrCreate`, alt = titre du projet), selon `ImportedMediaPolicy` |
| `titleLongDescription` | `description_longue.titre` | `titleLongDescription` | aucune |
| `longDescription` | `description_longue.contenu` | `longDescription` | Markdown → Lexical richText |
| `titleMoreDescription` | `description_complementaire.titre` | `titleMoreDescription` | aucune |
| `moreDescription` | `description_complementaire.contenu` | `moreDescription` | Markdown → Lexical richText ; bloc omis si le texte est vide |
| `titleFaq` | `faq.titre` | `titleFaq` | aucune |
| `faqs` | `faq.questions` | `faqs` | `answer` : Markdown → Lexical ; une question sans texte ou sans réponse est ignorée et signalée ; l'`id` amont de la question n'est pas gardé |
| `mainTheme` | `theme_principal` | `mainTheme` | Thème amont → taxonomie pivot (`ThemeMapper`) → valeur Payload (`CANONICAL_TO_THEME`) ; un thème inconnu fait échouer le projet |
| `themes` | `themes` | `themes` | idem ; un thème inconnu est ignoré et signalé |
| `sectors` | `secteurs` | `sectors` | Sections NAF ; un code hors section n'a pas d'équivalent Payload (écarté et signalé) |
| `highlightPriority` | `priorite.mise_en_avant` | `highlightPriority` | Chaîne → nombre ; valeur non numérique ignorée et signalée |
| `priority.default` | `priorite.defaut` | `defaultPriority` | aucune |
| `priority.<section ou code NAF>` | `priorite.par_secteur[]` | `sectorPriorities[]` | Une ligne `{ nafCode, priority }` par clé, triées |
| `programs` | `dispositifs` | `programs` | Slug[] → identifiants pivot (`SlugCanonicalId.from`) → IDs Payload (`PayloadProjectRelations`) ; dispositif introuvable signalé |
| `titleLinkedProjects` | `projets_lies.titre` | `titleLinkedProjects` | aucune |
| `descriptionLinkedProjects` | `projets_lies.description` | `descriptionLinkedProjects` | aucune |
| `linkedProjects` | `projets_lies.projets` | `linkedProjects` | id JSON[] → slugs → identifiants pivot → IDs Payload (passe 2) ; id amont inconnu ignoré et signalé |
| `metaTitle` | `seo.titre` | `metaTitle` | aucune |
| `metaDescription` | `seo.description` | `metaDescription` | aucune |
| `id` | *(non gardé)* | *(non stocké)* | Sert seulement à traduire `linkedProjects` en slugs |
| *(aucune)* | `statut_projet: 'valide'` | `_status: 'published'` | Tout projet amont est publié |

`faqs`, `titleFaq` et `priority` ne sont plus ignorés (ADR 0014 §5). Chaque champ Payload est écrit à chaque seed, un champ absent en amont étant remis à `null` ou `[]` : un `update` Payload part de la dernière version, brouillon en attente compris, et un champ laissé de côté garderait sa valeur de brouillon. `image` et `linkedProjects`, calculés par `ProjectImporter`, suivent la même règle : ils sont toujours écrits, avec la valeur publiée quand le seed n'a rien à y changer.

---

## Architecture seed

```
libs/format-adapters/src/tee/
├── tee-project.schema.ts     # teeProjectSchema : garde de forme d'un enregistrement de projects.json (TeeProject)
├── TeeProjectRecords.ts      # contrôle enregistrement par enregistrement : un projet cassé est écarté seul
└── TeeProjectImporter.ts     # projects.json → CanonicalProjectInput[] (seul lecteur du format amont)

apps/cms/src/services/canonical/to-payload/
├── CanonicalProjectToPayloadMapper.ts  # pivot → données Payload (map) et projets liés (mapLinkedProjects)
├── ProjectRelations.ts                 # port : identifiant pivot → id Payload (dispositif, projet)
└── PayloadProjectRelations.ts          # adaptateur Payload du port (canonicalId stocké ou dérivé du slug), rechargé entre les deux passes

apps/cms/src/scripts/seed/projects/
├── ProjectImporter.ts        # Passe 1 : image résolue en média, upsert par slug (image et projets liés toujours écrits), retourne Map<canonicalId, payloadId>
├── LinkedProjectsUpdater.ts  # Passe 2 : projets liés (self-ref), projet republié
└── index.ts                  # ProjectsSeed (lecteur, mapper, orchestration des 2 passes, avertissements)
```

`ProjectMapper.ts` et `types.ts` (`SourceProject`) ont été supprimés le 2026-10-01 : un seul lecteur du format amont, partagé avec l'import direct `import:projects` (ADR 0014 §8).

### Ordre d'exécution du seed global

1. `ProgramsSeed` (seed Operators, groupes et logos d'opérateurs, Programs)
2. `ProjectsSeed`
   - Lecture : `TeeProjectImporter.importMany` transforme `projects.json` en projets pivot.
   - Passe 1 : import des projets, écrits **publiés** sous `SystemWorkflowContext`, image importée via `UpstreamMediaImporter` (`apps/cms/src/scripts/seed/media/`). Les `linkedProjects` d'un projet qui n'a plus de projet lié en amont sont vidés ; les autres gardent leur valeur publiée (aucune pour un projet créé) jusqu'à la passe 2.
   - Passe 2 : mise à jour `linkedProjects` via `LinkedProjectsUpdater`, écritures séquentielles.
   - Les avertissements du lecteur et du mapper sont affichés en fin de seed ; une erreur (passe 1 ou 2), ou un enregistrement amont écarté pour sa forme (`source.rejectedProjects`), fait sortir `pnpm seed` en code 1.

Le store pivot des projets est alimenté pendant le seed par le hook `syncProjectCanonicalOnChange` : la passe 1 écrit la ligne avec les projets liés déjà publiés (aucun au premier seed), la passe 2 la réécrit avec ceux de l'amont. Le seed ne produit pas de tombstones de redirection : ils viennent de l'import amont direct (`pnpm import:projects`, pipeline quotidien).

Idempotence : upsert par slug. Un second seed ne crée ni projet ni média (résultats du 2026-10-01 : 0 créé, 91 mis à jour).
