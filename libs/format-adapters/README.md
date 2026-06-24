# @tee-backoffice/format-adapters

Adaptateurs entre le pivot ([`@tee-backoffice/canonical`](../canonical)) et les
formats externes. Organisé **par format**, chaque dossier co-localisant les deux
sens : **import** (format → pivot) et **export** (pivot → format).

> Les mappings **CMS (Payload) ↔ pivot** ne vivent **pas** ici : 
> ils feraient entrer le framework dans une lib autrement pure.
> ils sont dans le package data-hub

Périmètre courant : **TEE** (iso `docs/sources/programs.json`). Les formats
**AGIR** et **schéma interministériel** (Grist) arriveront sur leurs propres
branches, dans des dossiers `agir/` et `schema/`.

## Format TEE (`tee/`)

| Classe | Sens | Durée de vie |
|---|---|---|
| `TeeExporter` | `CanonicalProgram` → `TeeProgram` (iso `programs.json`) | permanent |

```ts
import { TeeExporter } from '@tee-backoffice/format-adapters'

const tee = new TeeExporter().export(program) // CanonicalProgram -> TeeProgram
```

`TeeExporter.exportMany` ne sort que les **publiés** (`statut_edition === 'pret_prod'`).
`teeProgramSchema` (`tee-program.schema.ts`) décrit la forme de sortie TEE et sert
de garde-fou (assert dans la boucle de validation).


## Commandes

```sh
nx run @tee-backoffice/format-adapters:test  
```
