# Modèle de la collection Projects

Spec consolidée pour l'implémentation dans PayloadCMS.
Voir aussi : `docs/adr/0003-projects-collection.md`

---

## Collection `Projects`

```
slug: 'projects'
admin.useAsTitle: 'title'
```

### Identité

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `slug` | text | required, unique, sidebar | `slug` |
| `title` | text | required | `title` |
| `nameTag` | text | required | `nameTag` |
| `shortDescription` | textarea | required | `shortDescription` |
| `image` | text | optional | `image` (chemin relatif) |

### Contenu

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `titleLongDescription` | text | optional | `titleLongDescription` |
| `longDescription` | richText | required | `longDescription` (Markdown → Lexical) |
| `titleMoreDescription` | text | optional | `titleMoreDescription` |
| `moreDescription` | richText | optional | `moreDescription` (Markdown → Lexical) |

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
| `highlightPriority` | number | optional, sidebar | `highlightPriority` (conv. string → number) |

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
| `programs` | relationship → 'programs' | hasMany, optional | `programs` (slugs → IDs Payload) |
| `titleLinkedProjects` | text | optional | `titleLinkedProjects` |
| `descriptionLinkedProjects` | textarea | optional | `descriptionLinkedProjects` |
| `linkedProjects` | relationship → 'projects' | hasMany, optional | `linkedProjects` (JSON ids → IDs Payload, passe 2) |

### SEO

| Champ | Type Payload | Contraintes | Source JSON |
|-------|-------------|-------------|-------------|
| `metaTitle` | text | optional, sidebar | `metaTitle` |
| `metaDescription` | textarea | optional, sidebar | `metaDescription` |

---

## Mapping complet JSON → Payload

| Clé JSON | Champ Payload | Transformation |
|----------|--------------|----------------|
| `slug` | `slug` | — |
| `title` | `title` | — |
| `nameTag` | `nameTag` | — |
| `shortDescription` | `shortDescription` | — |
| `image` | `image` | — (chemin relatif) |
| `titleLongDescription` | `titleLongDescription` | — |
| `longDescription` | `longDescription` | Markdown → Lexical richText |
| `titleMoreDescription` | `titleMoreDescription` | — |
| `moreDescription` | `moreDescription` | Markdown → Lexical richText |
| `mainTheme` | `mainTheme` | — |
| `themes` | `themes` | — |
| `sectors` | `sectors` | — |
| `highlightPriority` | `highlightPriority` | String → number |
| `programs` | `programs` | Slug[] → IDs Payload (Map programSlug→id) |
| `titleLinkedProjects` | `titleLinkedProjects` | — |
| `descriptionLinkedProjects` | `descriptionLinkedProjects` | — |
| `linkedProjects` | `linkedProjects` | JSON id[] → IDs Payload (passe 2, Map jsonId→payloadId) |
| `metaTitle` | `metaTitle` | — |
| `metaDescription` | `metaDescription` | — |
| `id` | *(non stocké — Map jsonId→payloadId pour seed)* | — |
| `priority` | *(ignoré)* | — |
| `titleFaq` | *(ignoré)* | — |
| `faqs` | *(ignoré)* | — |

---

## Architecture seed

```
apps/cms/src/scripts/seed/projects/
├── types.ts                  # Interface SourceProject
├── ProjectMapper.ts          # JSON → Payload data (Passe 1)
├── ProjectImporter.ts        # Upsert + retourne Map<jsonId, payloadId>
├── LinkedProjectsUpdater.ts  # Résolution self-ref (Passe 2)
└── index.ts                  # ProjectsSeed (orchestre les 2 passes)
```

### Ordre d'exécution du seed global

1. `ProgramsSeed` (seed Programs + Operators)
2. `ProjectsSeed`
   - Passe 1 : import des projets (sans `linkedProjects`)
   - Passe 2 : mise à jour `linkedProjects` via `LinkedProjectsUpdater`
