# @tee-backoffice/format-adapters

Adaptateurs entre le pivot ([`@tee-backoffice/canonical`](../canonical)) et les
formats externes. Organisé **par format**, chaque dossier co-localisant les deux
sens : **import** (format → pivot) et **export** (pivot → format).

Les scripts exécutables (CLI) vivent dans `scripts/` ; ils consomment l'API
publique du package au même titre qu'un consommateur externe.

### Données (`static/`)

La lib porte ses propres données pour rester **autonome** (aucune dépendance au
reste du repo hormis `@tee-backoffice/canonical`) :

- `static/input/programs.json` — l'entrée de l'**import TEE**. Dérivée de
  `docs/sources/` (hors lib), avec les quelques URLs malformées corrigées.
  Disparaît avec la migration.
- `static/exports/` — sorties produites par les scripts (ex. `tee-programs.json`).

Périmètre courant : **TEE** (iso `docs/sources/programs.json`). Les formats
**AGIR** et **schéma interministériel** (Grist) arriveront sur leurs propres branches, dans des dossiers `agir/` et `schema/`.

## Format TEE (`tee/`)

| Classe | Sens | 
|---|---|
| `TeeExporter` | `CanonicalProgram` → `TeeProgram` (iso `programs.json`) |
| `TeeImporter` | `TeeProgram` (iso `programs.json`) → `CanonicalProgramInput` |

```ts
import { TeeExporter, TeeImporter } from '@tee-backoffice/format-adapters'

const tee = new TeeExporter().export(program) // CanonicalProgram -> TeeProgram
const input = new TeeImporter().import(teeRecord) // TeeProgram -> CanonicalProgramInput
```

`TeeExporter.exportMany` ne sort que les **publiés** (`statut_edition === 'pret_prod'`).
`teeProgramSchema` (`tee-program.schema.ts`) décrit la forme de sortie TEE et sert de garde-fou (assert dans la boucle de validation).

### Self-check d'export (reporting)

Par défaut, `TeeExporter` **vérifie chaque export** : il le réimporte puis le
réexporte (aller-retour) et signale via un `ExportLogger` (injecté, `stderr` par
défaut) tout champ non réversible — ou un export non réimportable. C'est le signal
du package quand un format d'export n'est pas *content-perfect*. Désactivable via
`new TeeExporter({ selfCheck: false })`.

### Aller-retour (`tee/__roundtrip__/`)

`programs-roundtrip.spec.ts` valide la boucle **`programs.json` → pivot → `programs.json`**
(import puis export) : chaque dispositif ressort identique à l'entrée (au trim près).
⚠️ **Éphémère** : ce dossier dépend de `static/input/programs.json` et disparaît avec
lui. La couverture pérenne de l'import/export vit dans `TeeImporter.spec.ts` /
`TeeExporter.spec.ts`.

## Commandes

```sh
nx run @tee-backoffice/format-adapters:test       # tests unitaires + aller-retour
nx run @tee-backoffice/format-adapters:typecheck  # typecheck des scripts (scripts/)
nx run @tee-backoffice/format-adapters:export:tee  # canonical → static/exports/tee-programs.json + récap des écarts
```
