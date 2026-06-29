# Workflow de branches : main, release, démo, branches de travail

Ce document décrit l'organisation des branches Git du projet et la façon dont
les mises à jour se propagent entre elles.

## Les branches

| Branche | Rôle | Base de PR |
|---|---|---|
| `main` | Branche principale, source de vérité. Reçoit le travail validé. | — |
| `release/ticket-6-back-office-ux` | Branche de **release officielle** : base commune des branches de travail. Intègre `main` régulièrement. | `main` |
| `feat/*` (branches de travail) | Une fonctionnalité = une branche, chacune avec **sa PR** sur la release. | `release/ticket-6-back-office-ux` |
| `release/ticket-6-back-office-ux-demo` | Branche de **démo** : agrège les branches de travail pour fournir une PR de démonstration déployable. | `main` |

### Branches de travail actuelles (ticket #6)

- `feat/program-form-fields` : refonte du formulaire dispositifs.
- `feat/program-versions-sidebar` : sidebar + vue Versions custom.
- `feat/program-geographic-coverage` : couverture géographique + sélection groupée des zones.

## Schéma

```
                         main
                          │  (1) merge main → release
                          ▼
        release/ticket-6-back-office-ux
                          │  (2) re-merge release → chaque feat
          ┌───────────────┼────────────────────────────┐
          ▼               ▼                             ▼
   feat/program-     feat/program-              feat/program-
   form-fields       versions-sidebar           geographic-coverage
   (PR → release)    (PR → release)             (PR → release)
          │               │                             │
          └───────────────┴───────────────┬─────────────┘
                                           │  (3) merge chaque feat → démo
                                           ▼
              release/ticket-6-back-office-ux-demo
                       (PR → main, déployée pour la démo)
```

## Règles de propagation

1. **`main` descend vers tout le monde.** Quand `main` avance, on merge `main`
   dans `release/ticket-6-back-office-ux`, puis on re-merge `release` dans chaque
   branche de travail. Ainsi chaque feat (et sa PR) reste à jour de `main`.

2. **Les branches de travail montent vers la release.** Chaque `feat/*` a sa
   propre PR sur la release officielle. Elles sont la **source de vérité** de
   leur fonctionnalité.

3. **La démo est purement en aval (intégration).** On merge les branches de
   travail **dans** la démo pour l'assembler.
   ⚠️ **La démo ne re-merge jamais dans les branches de travail** : un merge fait
   sur la démo n'altère pas les `feat/*`. La démo est jetable / reconstructible.

4. **Invariant cible** : la démo contient le `HEAD` à jour de chaque branche de
   travail, et tout le workflow (release + feats + démo) contient `main`.

## Ordre de remise à jour (quand `main` a avancé)

```sh
# 1. main → release officielle
git switch release/ticket-6-back-office-ux
git merge main

# 2. release → chaque branche de travail (propage main)
git switch feat/program-form-fields        && git merge release/ticket-6-back-office-ux
git switch feat/program-versions-sidebar   && git merge release/ticket-6-back-office-ux
git switch feat/program-geographic-coverage && git merge release/ticket-6-back-office-ux

# 3. branches de travail (à jour) → démo
git switch release/ticket-6-back-office-ux-demo
git merge feat/program-form-fields
git merge feat/program-versions-sidebar
git merge feat/program-geographic-coverage
```

## Points de vigilance lors des merges

- **Base de données SQLite committée** (`apps/cms/tee-poc.db`,
  `libs/canonical-store/canonical.db`) : c'est le **fixture de données des tests
  E2E** (le job CI E2E n'a pas d'étape de seed, il consomme la DB commitée). En
  cas de conflit binaire, ne pas prendre aveuglément une version : **reseeder**
  après le merge (`pnpm seed`) et recommiter, sinon les E2E cassent.

- **Résolution de conflits sur `Programs.ts`** : faire l'**union** des
  fonctionnalités, pas un simple `--ours`/`--theirs`. Une résolution `--ours`
  peut silencieusement **supprimer un champ** d'une feature si la base de la
  branche cible est antérieure à ce champ (cas vécu : champ
  `selectAllAreasButtons` perdu sur la démo).

- **Fichiers générés** : `payload-types.ts` (gitignoré, régénéré au build) et
  `importMap.js` ne se résolvent pas à la main. Régénérer si besoin
  (`generate:types`, `generate:importmap`).

- **Numérotation des ADR** : deux branches peuvent créer le même numéro d'ADR en
  parallèle (collision `0008` vue entre versions-sidebar et la persistance
  canonical de `main`). Renuméroter l'ADR de la branche non encore mergée dans
  `main`.
