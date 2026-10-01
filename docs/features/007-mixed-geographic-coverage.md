# 007 : Couverture géographique « Régional et départemental »

## Objectif

Permettre à un dispositif de couvrir des régions entières **et** des départements d'autres régions, sans reléguer une partie des territoires dans le champ de commentaire. Voir l'addendum du 01/10/2026 de l'ADR 0006.

## Constat de départ (278 dispositifs amont, 01/10/2026)

| Cas | Dispositifs | Traitement |
|---|---|---|
| Département déjà couvert par une région listée | 8 (7 de l'Agence de l'Eau avec Landes + Nouvelle-Aquitaine, `sobriete-hydrique` avec Bouches-du-Rhône + Provence-Alpes-Côte d'Azur) | Couverture régionale, département retiré |
| Texte départemental, `allowedRegion` régional | 3 (`fresque-de-la-mobilite`, `ecogestes-paca`, `tourisme-durable-paca`) | Couverture régionale, suit `allowedRegion` ; incohérence à signaler à l'amont |
| Département hors des régions listées | 1 (`programme-marguerite`) | Couverture `regional-departemental` |

## Fichiers

| Fichier | Changement |
|---|---|
| `apps/cms/src/constants/geographicCoverageOptions.ts` | Créé : options, type `GeographicCoverage`, niveaux de zone par couverture |
| `apps/cms/src/collections/Programs.ts` | Option `regional-departemental`, filtre et conditions par niveaux, validation, champ `ui` d'avertissement |
| `apps/cms/src/collections/GeographicAreas.ts` | Champ `displayName`, utilisé comme titre |
| `apps/cms/src/hooks/geographicAreas/assignDisplayName.ts` | Créé |
| `apps/cms/src/hooks/programs/normalizeGeographicCoverage.ts` | Garde les zones pour la nouvelle couverture |
| `apps/cms/src/services/geography/GeographicAreaOverlap.ts` | Créé : règle « un département et sa région », partagée client et serveur |
| `apps/cms/src/utils/GeographicAreasValidator.ts` | Créé : refus du doublon à l'enregistrement |
| `apps/cms/src/components/programs/GeographicAreaOverlapWarning.tsx` | Créé : avertissement en direct |
| `apps/cms/src/services/canonical/to-payload/CanonicalToPayloadMapper.ts` | Couverture déduite des codes, département couvert retiré |
| `apps/cms/src/migrations/20261001_082515_mixed_geographic_coverage.*` | Énumérations, colonne `display_name`, remplissage |
| `libs/format-adapters/src/agir/` | `typeSecteur` = `Régional et départemental` |

## Vérifications

- Unitaires : `GeographicAreaOverlap.spec.ts`, `CanonicalToPayloadMapper.spec.ts`, `ProgramCanonicalMapper.spec.ts`, `AgirDetailExporter.spec.ts`.
- Intégration : `geographic-coverage.int.spec.ts` (titre des zones, enregistrement d'une couverture mixte, refus du doublon), `upstream-roundtrip.int.spec.ts`.
- E2E : `geographic-areas.e2e.spec.ts` (avertissement en direct).

## Points ouverts

- Le pivot garde les codes de l'amont tels quels (aller-retour `programs.json`) : pour les 8 dispositifs dont le département est déjà couvert, AGIR expose encore région et département ensemble.
- Passer d'une couverture à une autre peut laisser des zones du mauvais niveau : l'éditeur doit les resélectionner.
