# Feature 005 : Synchronisation quotidienne du CMS depuis l'amont

**ADR :** avenant à [0012-production-persistence-postgres](../adr/0012-production-persistence-postgres.md) (section « Qui écrit dans le canonical de production »)
**Complète :** [ADR 0008](../adr/0008-canonical-persistence-ddd.md) (hook de sync), [ADR 0003](../adr/0003-projects-collection.md) (liaison projets ↔ dispositifs)
**Prépare :** l'API propre des projets (feature suivante)

---

## Contexte

Aujourd'hui, deux chemins indépendants lisent le `programs.json` amont (dépôt GitHub `betagouv/mission-transition-ecologique`, lui-même issu d'une transformation Baserow) :

- `import:tee` (tâche planifiée `data:daily`) : `TeeImporter` → store canonical uniquement, reconstruction complète. **Le CMS n'est jamais mis à jour.**
- `pnpm seed` : son propre lecteur (`ProgramMapper`, `VariantMapper`, `GeographicAreaResolver`) → Payload, puis hook `syncCanonicalOnPublish` → canonical. Il lit une copie figée `docs/sources/` (30/04/2026).

Constats (vérifiés sur la base de dev le 2026-09-25) :

| # | Constat | Cause |
|---|---|---|
| 1 | Liaison projets ↔ dispositifs à sens unique : 1127 liens côté projets, 0 côté dispositifs | Deux champs `relationship` indépendants (`projects_rels`, `programs_rels`), aucune synchronisation |
| 2 | 0/234 dispositifs avec une thématique, alors que la source en porte 234/234 | `ProgramMapper` ne lit pas `eligibilityData.priorityObjectives` |
| 3 | Copie locale obsolète : 234 dispositifs et 86 projets contre 276 et 91 en amont | Le seed lit `docs/sources/`, jamais rafraîchi |
| 4 | Deux lecteurs du même format brut (~640 lignes dupliquées) | Seed et `TeeImporter` écrits séparément ; origine du constat 2 |
| 5 | Le back-office ne voit pas les nouveautés amont | Seul le seed écrit dans Payload |
| 6 | Archivage et remplacement jamais transmis au canonical par le hook | `archive`/`remplace` retombent en `_status: 'draft'`, le hook ignore les brouillons |
| 7 | Aucun moyen de retirer un dispositif du canonical | Port sans `delete`, pas de hook `afterDelete` ; masqué par le `deleteAll` quotidien |
| 8 | Deux `canonicalId` pour un même dispositif | CMS : cuid2 aléatoire ; `import:tee` : dérivé du slug (`SlugCanonicalId`) |
| 9 | Un script ne peut pas changer un statut workflow | `beforeChangeWorkflow` lève `401` sans `req.user` |
| 10 | Statut « aide temporairement indisponible » absent du CMS (1 dispositif amont) | Aucun champ Payload ; seul `TeeImporter` le lit |
| 11 | Code quotidien marqué « ONE-SHOT, à supprimer » | Commentaires hérités de la reprise historique (`TeeImporter`, `ThemeMapper`, `TypeAideMapper`, `RegionNameResolver`) |

**Hors scope :**
- API propre des projets (feature suivante, s'appuie sur la liaison bidirectionnelle).
- Lecture directe de Baserow : le `programs.json` GitHub reste l'interface.
- Traduction des redirections amont en `replacedBy` Payload (les dispositifs `remplace` restent un sujet à cadrer).
- Canonical des projets.

---

## Décisions prises

| Sujet | Décision |
|---|---|
| Source de vérité | Le fichier distant du dépôt GitHub amont, pour la prod comme pour le dev |
| Sens du flux quotidien | Amont → **CMS** (Payload) → canonical via le hook `syncCanonicalOnPublish`. `import:tee` sort du pipeline et reste un outil de secours (reconstruction du canonical sans Payload) |
| Modifications faites dans le back-office | **Écrasées** par la sync quotidienne : l'amont est la source vérifiée et officielle |
| Dispositifs disparus de l'amont | **Archivés** dans le CMS (transition `archive`), donc transmis au canonical |
| Dispositifs créés uniquement dans le CMS | Aucun en prod à ce jour ; la sync ne touche qu'aux slugs présents en amont ou déjà importés |
| Copie locale | JSON versionné, rafraîchi par un script `data:snapshot` ; utilisé **en dev uniquement** si GitHub est injoignable. **En prod, GitHub injoignable = échec du job** (code de sortie non nul), jamais de repli |
| Lecteur du format amont | Un seul : `TeeImporter` (brut → `CanonicalProgramInput` non validé), suivi d'un `CanonicalToPayloadMapper` (canonical → Payload). Suppression du lecteur propre au seed |
| Identité canonical | `canonicalId = SlugCanonicalId(slug)` à la création par la sync, pour aligner les deux écrivains |
| Écritures | Idempotentes, uniquement sur différence (empreinte du contenu importé) : pas de version Payload ni d'écriture canonical si rien n'a changé |
| Identité des scripts | Identité « système » reconnue par `beforeChangeWorkflow` (flag `req.context`), pour autoriser les transitions posées par la sync |
| Liaison projets ↔ dispositifs | **Projets propriétaires** (`Projects.programs`) ; `Programs.linkedProjects` devient un champ `join` (virtuel, sans table) |
| Statut indisponible | Nouveau champ Payload (case à cocher) mappé vers `statut_dispositif: 'temporairement_indisponible'` |

---

## Fichiers à créer / modifier

| Fichier | Action |
|---|---|
| `apps/cms/src/hooks/programs/syncCanonicalOnPublish.ts` | **Fait** : action selon `CanonicalSyncPolicy` (`publie`/`archive`/`remplace` écrits, `annule` retiré, états en cours ignorés pour garder la version publiée en ligne pendant une réécriture) |
| `apps/cms/src/services/canonical/CanonicalSyncPolicy.ts` | **Fait** : table `workflowStatus` → `save`/`remove`/`keep` |
| `apps/cms/src/hooks/programs/removeCanonicalOnDelete.ts` | **Fait** : retrait du canonical à la suppression définitive |
| `libs/canonical/src/canonical-program/CanonicalProgramRepository.ts` | **Fait** : `delete(canonicalId)` au port |
| `libs/canonical/src/canonical-program/CanonicalProgramService.ts` | **Fait** : `remove` + événement `program_removed` |
| `libs/canonical-store/src/DrizzleCanonicalProgramRepository.ts` | **Fait** : `delete` |
| `apps/cms/src/hooks/programs/beforeChangeWorkflow.ts` | **Fait** : identité système (`SystemWorkflowContext`) dispensée du contrôle de rôle et des règles de transition |
| `apps/cms/src/services/workflow/SystemWorkflowContext.ts` | **Fait** : marqueur `req.context` des écritures de scripts ; déjà posé par `ProgramImporter` (seed) |
| `apps/cms/src/collections/Programs.ts` | Modifier : champ « temporairement indisponible », `linkedProjects` en `join` sur `projects.programs` |
| `apps/cms/src/services/canonical/ProgramCanonicalMapper.ts` | Modifier : statut indisponible |
| `libs/format-adapters/src/tee/UpstreamJsonSource.ts` | Modifier : ajouter `projects.json` ; repli local optionnel, activé seulement hors production |
| `libs/format-adapters/static/input/` | Modifier : copies versionnées `programs.json`, `projects.json`, `redirects.json` |
| `libs/format-adapters/scripts/snapshot-upstream.ts` | Créer : rafraîchit les copies locales depuis GitHub (`pnpm data:snapshot`) |
| `libs/format-adapters/src/tee/TeeImporter.ts` (et `ThemeMapper`, `TypeAideMapper`, `RegionNameResolver`) | Modifier : retirer les mentions « ONE-SHOT » ; code permanent |
| `apps/cms/src/services/canonical/CanonicalToPayloadMapper.ts` | Créer : `CanonicalProgramInput` → données Payload (markdown → Lexical, opérateurs, zones via `inseeCode`, variantes, thèmes) |
| `apps/cms/src/scripts/sync/` | Créer : commande de sync CMS (upsert sur différence, archivage des disparus, projets), partagée par le seed et le daily |
| `apps/cms/src/scripts/seed/programs/` | Modifier : passe par la sync ; supprimer `ProgramMapper` (partie lecture), `VariantMapper`, `GeographicAreaResolver`, `types.ts` |
| `apps/cms/src/scripts/seed/projects/` | Modifier : source `UpstreamJsonSource` |
| `apps/cms/tests/unit/` | Créer : test aller-retour `ProgramCanonicalMapper(CanonicalToPayloadMapper(x)) ≈ x` sur tout l'amont, tests du hook |
| `apps/cms/src/migrations/` | Créer : migration (champ indisponible, suppression de `linkedProjects` dans `programs_rels` / `_programs_v_rels`) |
| `package.json`, `cron.json` | Modifier : `data:daily` = sync CMS → vérification CMS = canonical → `grist-setup` → `export:grist --push` ; script `data:snapshot` |
| `CLAUDE.md`, `docs/adr/0012-*.md`, `docs/adr/0003-*.md`, `docs/adr/0008-*.md` | Modifier : nouveau flux, avenant « amont → CMS → canonical », liaison `join` |

---

## Étapes d'implémentation

### Lot 1 : fiabiliser le hook canonical (utile indépendamment du reste) : **fait**
1. `delete` au port, au service et au repository Drizzle, avec tests (PGlite).
2. Hook : transmettre `archive` / `remplace`, retirer un dispositif `annule` ou supprimé (`afterDelete`). Les états en cours (dont `en-cours-modification`) ne touchent pas au canonical : la version publiée reste servie pendant une réécriture. Le statut indisponible arrive au lot 3 avec son champ.
3. Identité système dans `beforeChangeWorkflow`, utilisée par le seed.
4. Tests : `CanonicalSyncPolicy.spec.ts` (unitaire), `canonical-sync.int.spec.ts` (intégration Postgres).

### Lot 2 : source amont
1. `UpstreamJsonSource` : `projects.json`, repli local en dev uniquement (erreur franche en prod).
2. Script `data:snapshot` et copies versionnées.

### Lot 3 : un seul lecteur
1. Champ « temporairement indisponible » + migration.
2. `CanonicalToPayloadMapper` + test aller-retour sur les 276 dispositifs amont.
3. Le seed passe par `TeeImporter` + `CanonicalToPayloadMapper` ; suppression de l'ancien lecteur (corrige les thématiques).

### Lot 4 : sync quotidienne du CMS
1. Commande de sync idempotente (écriture sur différence, `canonicalId` dérivé du slug, archivage des disparus, projets).
2. Vérification CMS = canonical en fin de job (sortie non nulle sinon).
3. Nouveau `data:daily` ; `import:tee` retiré du pipeline.

### Lot 5 : liaison projets ↔ dispositifs
1. `Programs.linkedProjects` en `join` sur `projects.programs`, migration, `payload-types.ts`, import map.

### Lot 6 : documentation
1. Avenant ADR 0012, mise à jour ADR 0003 / 0008, `CLAUDE.md`, suppression des mentions « ONE-SHOT ».

---

## Vérification

```sh
pnpm test:unit                    # dont test aller-retour et hook
pnpm test                         # intégration (tee_test)
pnpm nx affected -t lint typecheck
pnpm seed                         # 276 dispositifs, thèmes remplis, liens visibles côté dispositif
pnpm data:daily                   # hors --push Grist en local : CMS puis canonical à jour, vérification OK
```

Contrôles attendus sur la base de dev :
- `programs_themes` non vide, 276 dispositifs.
- Un dispositif affiche ses projets liés (champ `join`).
- Un second `data:daily` sans changement amont ne crée aucune version Payload.
- Un dispositif retiré de la copie locale passe en `archive` et le canonical le reflète.
