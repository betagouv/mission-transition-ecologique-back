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
| 8 | Deux `canonicalId` pour un même dispositif | CMS : cuid2 aléatoire ; `import:tee` : dérivé du slug (`SlugCanonicalId`). **Résolu** : `assignCanonicalId` (`apps/cms/src/hooks/shared/` depuis la feature 008, partagé avec `Projects`) accepte l'id dérivé du slug fourni par une écriture système, et le hook retire la ligne de l'ancien id (ADR 0012) |
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
| Dispositifs disparus de l'amont | Revu le 2026-09-25 après lecture du dépôt TEE : chez TEE un dispositif **archivé reste dans `programs.json`** (s'il a déjà été en ligne), marqué seulement par sa `fin de validité` ; seuls les remplacés (via `redirects.json`) et les retirés en disparaissent. Donc : disparu **avec** redirection → `remplace` + `replacedBy` (reste dans AGIR, état `remplace`) ; disparu **sans** redirection → `annule` (retiré du canonical et de l'API, fiche et historique gardés dans le CMS) |
| Dispositifs archivés | Restent exposés dans l'API AGIR (`statut_edition: 'pret_prod'`, `statut_dispositif: 'archive'`), comme le site TEE qui garde la page avec un bandeau « Date de fin de l'aide ». Un dispositif présent en amont avec une fin de validité passée reste `publie` avec sa `date_cloture` |
| Dispositifs créés uniquement dans le CMS | Aucun en prod à ce jour ; la sync ne touche qu'aux slugs présents en amont ou déjà importés |
| Copie locale | JSON versionné, rafraîchi par un script `data:snapshot` ; utilisé **sur demande explicite** (`TEE_UPSTREAM_LOCAL_FALLBACK=1`, usage local) si GitHub est en panne. **Refusé sur Scalingo** : GitHub injoignable = échec du job (code de sortie non nul), jamais de repli |
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
| `apps/cms/src/collections/Programs.ts` | **Fait (lot 3)** : champ `temporarilyUnavailable` (sidebar). Reste lot 5 : `linkedProjects` en `join` sur `projects.programs` |
| `apps/cms/src/services/canonical/ProgramCanonicalMapper.ts` | **Fait** : `temporarilyUnavailable` → `temporairement_indisponible` (dispositif en ligne seulement) |
| `libs/format-adapters/src/tee/UpstreamJsonSource.ts` | **Fait** : `projects.json`, options objet, timeout réseau, repli local optionnel ; `fromSettings()` l'active seulement si `UpstreamFallbackSettings` le permet (opt-in, refusé sur Scalingo, pannes seulement) |
| `libs/format-adapters/src/tee/LocalJsonSnapshot.ts`, `UpstreamFile.ts` | **Fait** : lecture/écriture de la copie versionnée |
| `libs/format-adapters/static/upstream/` | **Fait** : copies versionnées `programs.json` (276), `projects.json` (91), `redirects.json` au 2026-09-25 |
| `libs/format-adapters/scripts/snapshot-upstream.ts` | **Fait** : rafraîchit les copies depuis GitHub, sans repli (`pnpm data:snapshot`, target `snapshot:upstream`) |
| `libs/format-adapters/src/tee/TeeImporter.ts` (et `ThemeMapper`, `TypeAideMapper`, `RegionNameResolver`) | **Fait** : mentions « ONE-SHOT » retirées ; code permanent |
| `apps/cms/src/services/canonical/to-payload/` | **Fait** : `CanonicalToPayloadMapper`, `CanonicalVariantToPayloadMapper`, port `ProgramRelations` + `PayloadProgramRelations`, `GeographicAreaResolver` (déplacé du seed, supprimé depuis : le CMS ne lit plus que les codes COG, voir `TerritoryNameResolver`) ; avertissements pour les données non portables |
| `apps/cms/src/services/canonical/rich-text/` | **Fait** : port `MarkdownToRichText` + `PayloadMarkdownToRichText` |
| `apps/cms/src/scripts/sync/` | Créer : commande de sync CMS (upsert sur différence, archivage des disparus, projets), partagée par le seed et le daily |
| `apps/cms/src/scripts/seed/programs/` | **Fait** : `TeeImporter` → `CanonicalToPayloadMapper` ; `ProgramMapper`, `VariantMapper`, `types.ts` supprimés. Reste lot 4 : passer par la commande de sync |
| `apps/cms/src/scripts/seed/projects/`, `run.ts` | **Fait** : source `UpstreamJsonSource.fromSettings(Config.upstreamFallback())` |
| `apps/cms/tests/` | **Fait** : `unit/CanonicalToPayloadMapper.spec.ts`, `int/upstream-roundtrip.int.spec.ts` (aller-retour sur les 276 dispositifs, en intégration car il faut Payload pour Lexical et les relations) |
| `apps/cms/src/migrations/` | **Fait (lot 3)** : `20260925_131616_program_temporarily_unavailable`. Reste lot 5 : suppression de `linkedProjects` dans `programs_rels` / `_programs_v_rels` |
| `package.json`, `cron.json` | Modifier : `data:daily` = sync CMS → vérification CMS = canonical → `grist-setup` → `export:grist --push` ; script `data:snapshot` |
| `CLAUDE.md`, `docs/adr/0012-*.md`, `docs/adr/0003-*.md`, `docs/adr/0008-*.md` | Modifier : nouveau flux, avenant « amont → CMS → canonical », liaison `join` |

---

## Étapes d'implémentation

### Lot 1 : fiabiliser le hook canonical (utile indépendamment du reste) : **fait**
1. `delete` au port, au service et au repository Drizzle, avec tests (PGlite).
2. Hook : transmettre `archive` / `remplace`, retirer un dispositif `annule` ou supprimé (`afterDelete`). Les états en cours (dont `en-cours-modification`) ne touchent pas au canonical : la version publiée reste servie pendant une réécriture. Le statut indisponible arrive au lot 3 avec son champ.
3. Identité système dans `beforeChangeWorkflow`, utilisée par le seed.
4. Tests : `CanonicalSyncPolicy.spec.ts` (unitaire), `canonical-sync.int.spec.ts` (intégration Postgres).

### Lot 2 : source amont : **fait**
1. `UpstreamJsonSource` : `projects.json`, repli local sur demande explicite, refusé sur Scalingo (erreur franche), timeout réseau de 30 s.
2. Script `data:snapshot` et copies versionnées dans `libs/format-adapters/static/upstream/` (distinctes des fixtures de test `static/input/*-tests.json`).
3. `import-tee.ts --remote` passe par `fromSettings(UpstreamFallbackSettings.fromEnv())`.
4. Reste à faire hors code : ajouter `TEE_PROJECTS_URL` (commenté) dans `apps/cms/.env.example`.

### Lot 3 : un seul lecteur : **fait**
1. Champ `temporarilyUnavailable` + migration (générée sur une base vierge `tee_migrate`).
2. `CanonicalToPayloadMapper` + test aller-retour sur les 276 dispositifs amont : aucun écart sur les champs portés.
3. Le seed passe par `TeeImporter` + `CanonicalToPayloadMapper` ; ancien lecteur supprimé. Corrige les thématiques (276/276 renseignées, vérifié par le test aller-retour) et le contact « formulaire » (82 dispositifs, perdu auparavant) ; les secteurs viennent des sections NAF structurées au lieu de mots-clés.
4. Pertes restantes, signalées en fin de seed : voir `docs/context/seed.md` (micro-entreprises, montant de financement d'une étude, liens conseiller, durée de prêt ; territoires mêlant départements et régions, limite du formulaire).
5. Comparaison ponctuelle ancien `ProgramMapper` / nouveau chemin sur les 276 dispositifs (non commitée) : aucune donnée conservée par l'ancien lecteur n'est perdue. Elle a révélé que l'ancien seed classait 273 dispositifs en « 0 à 9 salariés » (mot-clé « micro-entreprise ») et contredisait l'amont sur les secteurs de 6 dispositifs, et un bug du nouveau mapper corrigé depuis : les collectivités d'outre-mer (stockées comme régions à code 3 chiffres) portent le niveau COG `OM`, dans les deux sens (`cogCodeOf`).

### Lot 4 : sync quotidienne du CMS
1. Commande de sync idempotente (écriture sur différence, `canonicalId` dérivé du slug, disparus traités selon `redirects.json` : `remplace` ou `annule`, projets).
2. Archiver un dispositif dans le CMS pose sa date de fin (`validityEnd`) si elle est vide, pour que l'API AGIR ne le présente pas comme actif.
3. Vérification CMS = canonical en fin de job (sortie non nulle sinon).
4. Nouveau `data:daily` ; `import:tee` retiré du pipeline.

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
- Un dispositif retiré de la copie locale sans redirection passe en `annule` et sort du canonical ; avec redirection, il passe en `remplace`.
