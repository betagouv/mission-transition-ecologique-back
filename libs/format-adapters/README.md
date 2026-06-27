# @tee-backoffice/format-adapters

Adaptateurs entre le pivot ([`@tee-backoffice/canonical`](../canonical)) et les
formats externes. Organisé **par format**, chaque dossier co-localisant les deux
sens : **import** (format → pivot) et **export** (pivot → format).

> Les mappings **CMS (Payload) ↔ pivot** ne vivent **pas** ici :
> ils feraient entrer le framework dans une lib autrement pure.

Les scripts exécutables (CLI) vivent dans `scripts/` ; ils consomment l'API
publique du package au même titre qu'un consommateur externe.

### Indépendance (`static/`)

Pour que la lib soit **autonome** (aucune dépendance au reste du repo hormis
`@tee-backoffice/canonical`), les données vivent dans `static/` :

- `static/input/` — copies figées de `programs.json` / `projects.json` (la
  source vit dans `docs/sources/`, hors lib). C'est un **doublon assumé** : il
  rend l'aller-retour et l'export indépendants du CMS. Disparaît avec la migration.
- `static/exports/` — sorties produites par les scripts (ex. `tee-programs.json`).

Périmètre courant : **TEE** (iso `docs/sources/programs.json`). Les formats
**AGIR** et **schéma interministériel** (Grist) arriveront sur leurs propres
branches, dans des dossiers `agir/` et `schema/`.

## Format TEE (`tee/`)

| Classe | Sens | Durée de vie |
|---|---|---|
| `TeeExporter` | `CanonicalProgram` → `TeeProgram` (iso `programs.json`) | permanent |
| `TeeImporter` | `TeeProgram` (iso `programs.json`) → `CanonicalProgramInput` | éphémère (import unique) |

```ts
import { TeeExporter, TeeImporter } from '@tee-backoffice/format-adapters'

const tee = new TeeExporter().export(program) // CanonicalProgram -> TeeProgram
const input = new TeeImporter().import(teeRecord) // TeeProgram -> CanonicalProgramInput
```

`TeeExporter.exportMany` ne sort que les **publiés** (`statut_edition === 'pret_prod'`).
`teeProgramSchema` (`tee-program.schema.ts`) décrit la forme de sortie TEE et sert
de garde-fou (assert dans la boucle de validation).

### Aller-retour (`tee/__roundtrip__/`)

`programs-roundtrip.spec.ts` valide la boucle **`programs.json` → pivot → `programs.json`**
(import puis export) : chaque dispositif doit ressortir identique à l'entrée (au trim
près). Les écarts irréductibles documentés vivent dans `known-gaps.ts`. ⚠️ **Éphémère** :
ce dossier dépend de `docs/sources/programs.json` et disparaît avec lui (import + boucle).

## Commandes

```sh
nx run @tee-backoffice/format-adapters:test       # tests unitaires + aller-retour
nx run @tee-backoffice/format-adapters:typecheck  # typecheck des scripts (scripts/)
nx run @tee-backoffice/format-adapters:export:tee  # canonical → dist/tee-export.json + récap des écarts
```
