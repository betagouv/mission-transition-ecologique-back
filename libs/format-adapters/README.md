# @tee-backoffice/format-adapters

Adaptateurs entre le pivot ([`@tee-backoffice/canonical`](../canonical)) et les
formats externes. Organisé **par format**, chaque dossier co-localisant les deux
sens : **import** (format → pivot) et **export** (pivot → format).

> Le mapping **CMS (Payload) ↔ pivot** ne vit **pas** ici : il ferait entrer le
> framework dans une lib autrement pure. Il reste un adaptateur dans `apps/cms`.

Périmètre courant : **TEE** (iso `docs/sources/programs.json`). Les formats
**AGIR** et **schéma interministériel** (Grist) arriveront sur leurs propres
branches, dans des dossiers `agir/` et `schema/`.

## Cycle de vie : import one-shot, export permanent

- **Export** `pivot → TEE` (`TeeExporter`) : **permanent**. Payload alimente le
  pivot, qui alimente en continu le consommateur TEE.
- **Import** `TEE → pivot` (`TeeImporter`) : **one-shot**. Sert uniquement à la
  reprise unique de la donnée historique (Baserow → Payload). Une fois faite, il
  n'est plus jamais utilisé — voir [Nettoyage post-migration](#nettoyage-post-migration).

## Format TEE (`tee/`)

| Classe | Sens | Durée de vie |
|---|---|---|
| `TeeExporter` | `CanonicalProgram` → `TeeProgram` (iso `programs.json`, sans `publicodes`) | permanent |
| `TeeImporter` | `programs.json` → `CanonicalProgramInput` | one-shot (migration) |

```ts
import { TeeExporter } from '@tee-backoffice/format-adapters'

const tee = new TeeExporter().export(program) // CanonicalProgram -> TeeProgram
```

`TeeExporter.exportMany` ne sort que les **publiés** (`statut_edition === 'pret_prod'`).
`teeProgramSchema` (`tee-program.schema.ts`) décrit la forme de sortie TEE et sert
de garde-fou (assert dans la boucle de validation).

## Boucle de validation (`tee/__roundtrip__/`)

Prouve que la reprise est **sans perte** avant de s'y fier : `programs.json` →
import → pivot → export → on compare à l'entrée. La sortie doit respecter
`teeProgramSchema` **et** être identique à l'entrée (au trim près — le pivot
normalise les espaces), une fois retirées les clés non portées par le pivot
(`publicodes`, `activable en autonomie`, `illustration`). Le seul écart résiduel
assumé est les `champs conditionnels` (variantes non réimportées), listé dans
`known-gaps.ts` ; chaque known-gap est garde-fouté (un test casse si l'un repasse
au vert, pour penser à le retirer).

> ⚠️ **Éphémère** : ce dossier dépend de `docs/sources/programs.json`, voué à
> disparaître. Quand la source est supprimée, supprimer tout le dossier
> `__roundtrip__/` — aucun autre test n'en dépend.

## Nettoyage post-migration

Tout le chemin d'**import** est jetable une fois la reprise Baserow → Payload
faite. Repère grep : `grep -rn "ONE-SHOT IMPORT" libs/format-adapters/src`.

À supprimer :

- [ ] `src/tee/TeeImporter.ts` (+ la ligne d'export dans `src/index.ts`)
- [ ] `src/tee/__roundtrip__/` (boucle de validation + `known-gaps.ts`)
- [ ] Les méthodes **inverses** (taguées `ONE-SHOT IMPORT`) et leurs tables :
      `ThemeMapper.toFrench`/`toFrenchList` (+ `EN_TO_FR`),
      `TypeAideMapper.fromNatureAideLabel` (+ `LABEL_TO_TYPE`),
      `RegionNameResolver.codesOf` (+ `NAME_TO_CODE`)
- [ ] `docs/sources/programs.json` (la source historique elle-même)

Reste alors une lib **export-only** : `TeeExporter`, les types/schéma TEE, et les
méthodes de mapping « aller » (`toEnglishList`, `toNatureAideLabel`, `namesOf`,
`sectionsOf`).

## Commandes

```sh
nx run @tee-backoffice/format-adapters:test   # vitest (inclut la boucle de validation)
```
