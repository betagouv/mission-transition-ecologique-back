# @tee-backoffice/formats

Adaptateurs de **formats** autour du pivot ([`@tee-backoffice/canonical`](../canonical)).

Une lib, organisée **par format cible**, chaque dossier co-localisant les deux
sens : **import** (format source → pivot) et **export** (pivot → format cible).

> Le mapping **CMS (Payload) ↔ pivot** ne vit **pas** ici : il ferait entrer le
> framework dans une lib autrement pure. Il reste un adaptateur dans `apps/cms`.

Périmètre courant : **TEE** (iso `docs/sources/programs.json`). Les formats
**AGIR** et **schéma interministériel** (Grist) arriveront sur leurs propres
branches, dans des dossiers `agir/` et `schema/`.

## Format TEE (`tee/`)

| Classe | Sens |
|---|---|
| `TeeImporter` | `programs.json` → `CanonicalProgramInput` |
| `TeeExporter` | `CanonicalProgram` → `TeeProgram` (iso `programs.json`, sans `publicodes`) |

```ts
import { TeeImporter, TeeExporter } from '@tee-backoffice/formats'
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'

const program = new CanonicalProgramValidator().parse(new TeeImporter().import(record))
const tee = new TeeExporter().export(program) // CanonicalProgram -> TeeProgram
```

`TeeExporter.exportMany` ne sort que les **publiés** (`statut_edition === 'pret_prod'`).

## Boucle de validation (`tee/__roundtrip__/`)

Test prouvant que le pivot fait un **aller-retour sans perte** sur la vraie
donnée : `programs.json` → import → pivot → export → on compare à l'entrée. La
sortie doit être **identique à l'entrée** (au trim près), une fois retirées les
clés non portées par le pivot (`publicodes`, `activable en autonomie`,
`illustration`). Les écarts irréductibles (durée perdue avec publicodes, liens
`mailto:`, `champs conditionnels`) sont documentés dans `known-gaps.ts`.

> ⚠️ **Éphémère** : ce dossier dépend de `docs/sources/programs.json`, voué à
> disparaître. Quand la source est supprimée, supprimer tout le dossier
> `__roundtrip__/` — aucun autre test n'en dépend.

## Validation des sorties (non bloquante)

`tee-program.schema.ts` (`teeProgramSchema`) valide la forme de sortie.
`ExportValidation.collect` collecte les non-conformités, `ExportValidation.warn`
les **avertit** (jamais bloquant).

## Commandes

```sh
nx run @tee-backoffice/formats:test   # vitest (inclut la boucle de validation)
```
