# @tee-backoffice/canonical

Le **format pivot** interne du back-office TEE.

Le « pivot » (vocabulaire d'équipe) est notre **Canonical Data Model** : un
format interne, normalisé et **non publié** par lequel transitent tous les
formats source/cible (AGIR, schéma de données, Grist…). TypeScript pur + zod,
sans dépendance framework.

- **Source de vérité** : les schémas zod. Les types sont inférés (`z.infer` /
  `z.input`), jamais écrits à la main.
- **Clés** : français, `snake_case` (= format wire), exception assumée à la
  règle « code en anglais » du dépôt.

Voir [ADR 0007](../../docs/adr/0007-canonical-pivot-format.md) (décisions) et
[la référence des champs](../../docs/context/canonical-pivot-format.md).

## API

```ts
import { CanonicalProgramValidator } from '@tee-backoffice/canonical'
import type { CanonicalProgramInput, CanonicalProgramData } from '@tee-backoffice/canonical'

const validator = new CanonicalProgramValidator()

// Non bloquant : renvoie le programme ou les ZodIssue[]
const result = validator.validate(raw)
if (result.success) {
  result.program.slug // CanonicalProgram (value object validé)
}

// Bloquant : lève ZodError
const program = validator.parse(raw)
```

- `CanonicalProgramInput` — forme **à produire** par les DTO/ETL (chaînes
  simples, défauts optionnels), à passer au validateur.
- `CanonicalProgramData` — forme **validée** en sortie (défauts appliqués,
  identifiants brandés).

## Commandes

```sh
nx run @tee-backoffice/canonical:test       # vitest
nx run @tee-backoffice/canonical:typecheck  # tsc --noEmit
nx run @tee-backoffice/canonical:lint       # eslint
nx run @tee-backoffice/canonical:build      # tsc
```
