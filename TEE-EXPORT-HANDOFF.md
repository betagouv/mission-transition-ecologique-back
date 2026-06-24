# Handoff — TEE export full data loop (feat/tee-export)

> Temporary working doc. Delete when the work lands. New agent: read this top-to-bottom, then continue from **Remaining work**.

## Goal

A **lossless round-trip** for TEE program data: `docs/sources/programs.json` → canonical pivot → TEE export, **bit-for-bit equal to the input** (modulo a few accepted exceptions). This validates the upcoming **one-shot Baserow→Payload migration** before we commit to it.

Lifecycle: **import is one-shot** (Baserow→Payload, then deleted), **export is permanent** (Payload→canonical→TEE feed). `programs.json` itself disappears in ~10 days.

## Branch / state

`feat/tee-export`, on top of `feat/canonical-program-mapper`. One commit `fbe7624` + **uncommitted WIP** (this session's fixes). Nothing else committed — review via `git diff`.

## Architecture (3 layers)

- **`libs/canonical`** — the pivot domain (zod schemas, `CanonicalProgramValidator`). This session relaxed `refineDuree` (étude no longer requires durée) — a **domain-wide** change.
- **`libs/format-adapters`** (renamed from `libs/formats` this session) — TEE adapters.
  - PERMANENT: `TeeExporter` (canonical→TEE), `tee-program.types/schema`, forward mappers (`ThemeMapper.toEnglishList`, `TypeAideMapper.toNatureAideLabel`, `RegionNameResolver.namesOf`, `NafSectionResolver`), `ExportPolicy`.
  - EPHEMERAL (one-shot, tagged `ONE-SHOT IMPORT`, see README deletion checklist): `TeeImporter` (direct json→canonical), `tee/__roundtrip__/` (validation loop + `known-gaps.ts`), the **inverse** mapper methods (`toFrench*`, `fromNatureAideLabel`, `codesOf`).
- **`apps/cms`** — the **REAL import path** (what the migration uses): `scripts/seed/programs/ProgramMapper.ts` (json→Payload), `services/canonical/ProgramCanonicalMapper.ts` (Payload→canonical) + `canonicalMappings.ts`, `scripts/seed/canonical/CanonicalSeed.ts`. **EPHEMERAL**: `scripts/audit-eligibilite.ts` (the real-path audit tool — delete with the round-trip tooling when `programs.json` goes).

## Crucial insight

`TeeImporter` (direct json→canonical) round-trips 227/234 bit-exact — but that's **circular** (it's the exact inverse of `TeeExporter`; it only proves the *format* is expressive enough). The **real** migration goes json→**Payload**→canonical, which is **editorial/lossy**. So we validate the *real path* and fix its mappers. The bit-exact `TeeImporter` output is the **reference target** we're rebuilding via the real path.

## How to verify (the audit loop)

1. Node: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"; nvm use 24` (→ Node 24, pnpm 10.6.3). If deps fail: `pnpm install` once.
2. **Seed FRESH** (re-seeding an existing DB hits a version-corruption slug-unique bug — see Gotchas):
   `rm apps/cms/tee-poc.db libs/canonical-store/canonical.db && pnpm seed`
   Slow (minutes) — run with `run_in_background`. Expect `Canonical seed complete — 229 saved, 0 invalid.`
3. Audit = `apps/cms/src/scripts/audit-eligibilite.ts` (TEMP tool). Reads `canonical.db` directly via `@libsql/client`, runs `CanonicalProgramValidator.validate` → `TeeExporter.export`, matches to `programs.json` by `slug === id`, compares **deep-trimmed**, **minus excluded keys** (`publicodes`, `activable en autonomie`, `illustration`), prints `clean/mismatch` + a top-level-key histogram + a focused `conditions d'éligibilité` sub-key histogram.
   - Run from `apps/cms`: `../../node_modules/.bin/tsx --tsconfig ../../tsconfig.base.json src/scripts/audit-eligibilite.ts`.
   - **Why `--tsconfig ../../tsconfig.base.json`**: `apps/cms/tsconfig.json` overrides `paths` and omits `@tee-backoffice/format-adapters`; the base config has all three package paths. Run the file (not `tsx -e`, which ignores tsconfig paths) and from inside the workspace (bare deps like `@libsql/client` won't resolve from `/tmp`). Don't use `npx tsx` (the rtk shell hook mangles it) — call the `.bin/tsx` binary directly.

## Fixes DONE this session (all re-seeded + verified)

1. **themes (#1)** — `ProgramMapper` copies `eligibilityData.priorityObjectives` → Payload `themes` (was 0/180; Payload theme values == priorityObjectives EN values). `SourceProgram` type extended with `eligibilityData` (`types.ts`).
2. **contact `formulaire` (#3)** — `mapContact` maps `'formulaire'` → `['advisor']` (72 source cases his code dropped). Audit: contact mismatch **64→0**.
3. **montant/durée labels (#2)** — `TeeExporter.LABEL_TO_TEE` maps his canonical labels (`Montant du financement`, `Coût restant à charge`, `Durée du diagnostic ou de l'étude`, `Durée de la formation`, …) → programs.json keys (`montant du financement`, `coût de l'accompagnement`, `durée de l'accompagnement`). Passthrough fallback (so `TeeImporter` path still works). Removed ~165 label mismatches.
4. **effectif size exact-mapping (#7)** — `mapCompanySizes(company)` reads `eligibilityData.company.min/maxEmployees`: selects **covering buckets** when boundaries align, else `'other'` + `"De X à Y"` (off-boundary cases `250`, `300`). `ProgramCanonicalMapper.parseSizeText` parses `"De X à Y"` back → interval. Verified: `19→{0,19}` (was wrongly `9`), `249→{0,249}`, `250→{0,250}`, `300→{0,300}`.
5. **`conditions d'éligibilité` TEXT (#1, THE all-229 blocker) — DONE, verified byte-identical (229→0).** Decision taken: **preserve the source bullets verbatim, per category** (the recommended "dedicated field" option; user said "go like this, improve later"). The canonical pivot already models this right (each criterion = editorial `texte[]` + machine `structure`); the bug was purely import-side (it regenerated `texte` from select labels). Now:
   - 4 new Payload array fields (`{ value }[]`, under the Éligibilité collapsible): `sizeConditions` (taille), `geographicConditions` (géo), `sectorConditions` (secteur), `seniorityConditions` (années). `otherCriteria` (autres) reused — **no longer merges années**.
   - `ProgramMapper` copies each source category verbatim into its field (`toCriteria`); dropped the old `geographicAreaFeedback`-from-géo-text dump.
   - `ProgramCanonicalMapper`: `texte` now comes verbatim from those fields (`bullets` helper); `structure` still from the selects/relations. Added `mapAnciennete`. Removed now-dead `COMPANY_SIZE_LABELS`/`ACTIVITY_SECTOR_LABELS`. Export side (`TeeExporter.conditions`) needed **zero** changes — it already merges `effectif.texte ++ categorie_legale.texte` for taille and reads `anciennete.texte` for années.
   - Bonus: typed `themes` (source `priorityObjectives`) via `ProgramMapper.mapThemes` so `cms:typecheck` is **green** again (was failing on `string[]` vs the theme enum).

## Audit state

Post-conditions-fix audit (fresh seed, 229 programs): **clean 0/229** (still — `eligibilityData` blocks every program until the structure work lands). Mismatch keys now: `eligibilityData`=229(all), `description`/`description longue`=86/81 (markdown), `montant du financement`=45, `objectifs`=26, `durée du prêt`=10, `champs conditionnels`=7, `aide temporairement indisponible`=1. **`conditions d'éligibilité` is GONE from the histogram** (was 229/all) and the focused sub-key histogram is empty → eligibility text round-trips exactly for all 229. `objectifs`=26 is newly visible in the top list (was there pre-fix too).

## Remaining work (queued — each needs a fresh re-seed)

1. ~~**`conditions d'éligibilité` TEXT — THE all-229 blocker.**~~ **DONE** — see "Fixes DONE #5". Verbatim per-category preservation; 229→0, byte-identical. No program is clean *yet* only because `eligibilityData` (structure, below) still mismatches all 229.
2. **regions / OM (#4, structure)** — feeds `eligibilityData.company.allowedRegion` (NOT the `secteur géographique` *text*, which now round-trips via `geographicConditions`). `ProgramMapper` currently **drops** `eligibilityData.company.allowedRegion` entirely (`geographicAreaFeedback` is now left empty — it no longer dumps the géo bullet). Should **link `allowedRegion` → the `geographicAreas` relationship** (incl. OM collectivités selected *as region* — user says geo field validation is lightened so it works). Needs plumbing a region-name→GeographicArea-id lookup through `ProgramsSeed`→`ProgramImporter`→`ProgramMapper`. `ProgramCanonicalMapper.mapSecteurGeographique` already builds COG `structure` from `geographicAreas`; `TeeExporter.eligibilityData` maps COG→region names (`RegionNameResolver`, already extended with `OM-…` codes).
3. **NAF (#6, structure)** — `allowedNafSections` (A–U) → Payload `activitySectors` selects → reconstruct on export. Trickiest (sector-select ↔ NAF-section mapping; not 1:1).
4. **categorie_legale / micro (#5, structure)** — text already round-trips (the "Éligible/Non éligible aux micro-entreprises" bullet lives verbatim in `sizeConditions` → `effectif.texte`). Remaining = the **structure**: import `eligibilityData.company.excludeMicroentrepreneur` → `categorie_legale.structure.interdit` (`['micro_entrepreneur']`), so `eligibilityData` round-trips. `TeeExporter.eligibilityData` already emits `excludeMicroentrepreneur` from that structure.
5. ~~**anciennete (#8)**~~ **DONE** — années text now lives in its own `seniorityConditions` field → `anciennete.texte`, no longer merged into `otherCriteria`. (Editorial-only criterion; no structure exists in the canonical schema, so nothing to keyword-parse.)
6. **`durée du prêt` (10)** — needs a new Payload `loanDuration` field (schema change + `pnpm generate:importmap`/payload-types regen) + `ProgramMapper.mapAmountFields` pret case + `DUREE_BY_AID_TYPE` pret entry.
7. **`montant du financement` value=45** — investigate why 45 values differ (markdown/trim?).
8. **markdown `description`/`description longue` (86/81)** — irreducible (Payload Lexical re-render). User will reduce later if it matters.

## Accepted exceptions / conventions

- Excluded from comparison: `publicodes`, `activable en autonomie`, `illustration`. Trim-tolerance (canonical normalizes whitespace).
- Code comments in English; pivot keys in French snake_case (ADR 0007). OOP/SOLID, one class per file.

## Gotchas

- **Committed binary DBs** (`tee-poc.db`, `canonical.db`) get dirtied by every seed.
- **Re-seed slug-unique bug**: re-seeding an *existing* DB accumulates duplicate `latest=1` rows in `_programs_v` → `ProgramImporter.fetchExisting` (uses `draft:true`) misses rows → re-create → `unique` slug "invalid" errors (saw 142). Also inflates `CanonicalSeed` count (saw "391 published"). **Always seed fresh.** (Underlying idempotency bug in `ProgramImporter` is unfixed — low priority since migration is one-shot/fresh.)
- The **4 malformed URLs** in `docs/sources/programs.json` were fixed (in `fbe7624`) — but `docs/sources/` is normally "ne jamais modifier"; user is also fixing them in the real DB.
- Docs still TODO (paused): ADR 0009 for format-adapters, `CLAUDE.md` libs section, fix stale `refineDuree` notes in ADR 0007/0008.

## Pending decisions

- ~~`conditions d'éligibilité` text: dedicated field vs split-into-criteria.~~ **Resolved** — per-category dedicated fields (verbatim), "go like this, improve later". Likely follow-up the user hinted at: the displayed bullets are now decoupled from the structured selects (an editor changing a size select won't update `sizeConditions`); a future form refactor may want to reconcile or hide one of the two.
