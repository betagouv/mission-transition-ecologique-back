# Seed : import des données amont dans le CMS

## Objectif

`pnpm seed` remplit PayloadCMS (via la **Local API**) avec les dispositifs, projets et opérateurs du dépôt GitHub amont `betagouv/mission-transition-ecologique` (`libs/data/static/programs.json`, `projects.json`, et `apps/nuxt/src/public/json/operator/operators.json` pour les groupes et logos d'opérateurs), qui fait foi. Les logos et images de projets sont téléchargés depuis le dossier public du front amont et importés dans `Media` (ADR 0013). Le store canonical est alimenté au passage par les hooks `syncCanonicalOnPublish` (dispositifs) et `syncProjectCanonicalOnChange` (projets, ADR 0014).

---

## Prérequis

1. Le PostgreSQL local doit tourner (`pnpm db:up`) et la base doit avoir son schéma : en dev, lancer `pnpm dev` une fois suffit (mode `push`) ; sur une base vierge hors dev, `pnpm migrate`.
2. Les variables d'environnement doivent être configurées (`.env` dans `apps/cms/`, voir `.env.example`) :
   ```
   DATABASE_URI=postgres://tee:tee@localhost:5432/tee
   CANONICAL_DATABASE_URI=postgres://tee:tee@localhost:5432/tee
   PAYLOAD_SECRET=<une-chaine-secrete>
   ```
3. Optionnel : `TEE_PROGRAMS_URL` / `TEE_PROJECTS_URL` / `TEE_OPERATORS_URL` pour lire une autre source que le dépôt amont, `TEE_ASSETS_BASE_URL` pour télécharger les fichiers (logos, images) ailleurs que dans le dossier public du front amont. Une variable vide retombe sur la valeur par défaut.
4. Optionnel : `S3_*` pour envoyer les médias dans le stockage objet (ADR 0012 §7) ; sans bucket, ils vont sur le disque local (`apps/cms/media/`). Piège : même avec un bucket, Payload vérifie les noms de fichiers contre ce dossier local, et des fichiers laissés par un seed ou des tests sur disque font importer les médias dans le bucket avec un suffixe `-N` (`biodiversite-des-cours-d-eau-1.webp`) : vider `apps/cms/media/` avant de seeder vers un bucket.

---

## Utilisation

```sh
pnpm seed               # = nx run @tee-backoffice/cms:seed
pnpm data:sync:dev      # la partie amont du seed seule (ce que la tâche quotidienne lance)
pnpm data:snapshot      # rafraîchit la copie locale de secours (à commiter)
```

Le point d'entrée est `apps/cms/src/scripts/seed/run.ts`. Ce dossier ne garde que ce qui est propre au seed (`run.ts`, `geographic-areas/`, `users/`) ; les importeurs décrits plus bas vivent dans `apps/cms/src/scripts/sync/` (`programs/`, `projects/`, `media/`), partagés avec la tâche quotidienne.

**Seed et sync quotidienne sont la même commande** (depuis le 2026-10-02, feature 005 lot 4) : `run.ts` seede les zones géographiques, lance `UpstreamSync` (`apps/cms/src/scripts/sync/`), puis seede les utilisateurs de dev. `UpstreamSync` enchaîne les étapes décrites plus bas (opérateurs, dispositifs, projets), puis l'annulation des disparus et le rapprochement CMS ↔ canonical. Une base seedée et une base synchronisée contiennent donc la même chose, documents `remplace` compris.

---

## Source des données

- `UpstreamJsonSource.fromSettings(Config.upstreamFallback())` lit les fichiers JSON sur GitHub (timeout 30 s) ; `operators.json` est validé par `teeOperatorSchema`, `projects.json` par `teeProjectsSchema` (garde de forme : un fichier à la forme cassée fait échouer le seed au lieu de l'alimenter).
- `UpstreamAssetSource` télécharge les logos et images par leur chemin amont (`raw.githubusercontent.com/.../main/apps/nuxt/src/public` + chemin, timeout 30 s).
- **Avec `TEE_UPSTREAM_LOCAL_FALLBACK=1`** dans le `.env` (usage local), une panne GitHub (réseau, timeout, 5xx) bascule sur la copie versionnée `libs/format-adapters/static/upstream/`, avec un avertissement. Un 404 ou un JSON invalide échoue toujours : c'est un vrai changement amont.
- Les images **ne sont pas versionnées** dans `static/upstream/` : en repli, les groupes sont rattachés depuis la copie d'`operators.json`, les téléchargements échouent et sont signalés, le seed se termine.
- **Sans la variable**, pas de repli : le seed échoue. Sur Scalingo, la variable est **refusée** (erreur explicite), même si elle est posée.
- `docs/sources/` n'est plus lu par le code (archive de la reprise historique).

---

## Comportement

### Un seul lecteur du format amont

Le format brut de `programs.json` n'est interprété que par `TeeImporter` (`libs/format-adapters`), le même lecteur que l'import canonical. Chaque dispositif devient un `CanonicalProgramInput` (identifiant `SlugCanonicalId` dérivé du slug), puis `CanonicalToPayloadMapper` le transforme en données Payload.

Même règle pour `projects.json` depuis le 2026-10-01 (ADR 0014 §8) : il n'est interprété que par `TeeProjectImporter`, le lecteur de l'import direct `import:projects`. Chaque projet devient un `CanonicalProjectInput` (identifiant `SlugCanonicalId.forProject(slug)`, dérivé de `project:<slug>`), puis `CanonicalProjectToPayloadMapper` le transforme en données Payload. L'ancien lecteur du seed (`ProjectMapper`, `types.ts`) est supprimé.

`UpstreamJsonSource.projects()` contrôle la forme de `projects.json` **enregistrement par enregistrement** (`TeeProjectRecords`) : un projet incomplet (titre `null`, champ obligatoire manquant) est écarté seul, les autres sont seedés. Une cellule facultative vide ou `null`, telle que Baserow l'exporte, est lue comme absente. Les enregistrements écartés sont exposés par `source.rejectedProjects` ; `run.ts` les liste en fin de seed et les **compte dans les erreurs** (code de sortie 1). Seul un fichier qui n'est pas une liste fait échouer le seed en bloc.

### Étape 1 : opérateurs

`OperatorImporter` déduplique les opérateurs cités (contact, autres, variantes), fait un **upsert par slug** et construit la table `nom → id`.

Puis, depuis `operators.json` :

1. `OperatorGroupImporter` fait un upsert des groupes, rapprochés par slug ou par nom (un groupe créé dans l'admin avec un slug à lui garde ce slug) (`filterCategories`, 12 au 2026-09-28) et pose le logo par défaut de 5 groupes (`OperatorGroupLogoDefaults` : Agence de l'eau, CCI, CMA, ADEME, Bpifrance), **sauf si le groupe a déjà un logo** (posé dans l'admin).
2. `OperatorProfileImporter` rapproche chaque opérateur amont d'un opérateur CMS par le slug de son nom :
   - `groups` est **remplacé par la liste amont** (une modification manuelle est perdue) ;
   - logo : un logo **uploadé à la main** (média sans `sourcePath`) n'est jamais écrasé ; un logo **importé** suit l'amont et est retiré si l'amont n'a plus d'`imagePath` ; un téléchargement en échec garde le logo actuel (`ImportedMediaPolicy`, même règle pour l'image des projets) ; un `imagePath` vide ou `null` vaut « pas de logo » ;
   - un opérateur amont inconnu du CMS est **signalé**, pas créé ; un opérateur du CMS absent d'`operators.json` n'est pas touché.

### Médias importés

`UpstreamMediaImporter` (`apps/cms/src/scripts/sync/media/`) transforme un chemin amont en id de média : il cherche un média par `sourcePath` et ne télécharge que s'il n'en trouve pas (texte alternatif `Logo de <nom>`, ou titre du projet). Il pose le type (`category`) : `operator-logo` pour les logos d'opérateurs et de groupes, `project-image` pour les images de projets ; un média retrouvé dont le type diffère est réaligné (compteur « recatégorisés »), ce qu'exigent les sélecteurs filtrés par type. `sourcePath` n'est écrit que par le seed (Local API, `overrideAccess`) : il est masqué dans l'admin et ignoré s'il arrive par l'API. Appels séquentiels. Un fichier introuvable (404), un refus HTTP ou un chemin invalide est signalé en fin de seed, jamais fatal : le document est gardé sans image.

### Étape 2 : dispositifs

Pour chaque dispositif, `CanonicalToPayloadMapper` :
1. résout les relations (opérateurs, zones géographiques par nom ou code COG) via `PayloadProgramRelations` ;
2. convertit le markdown en Lexical (`PayloadMarkdownToRichText`) ;
3. traduit thèmes, zones (les collectivités d'outre-mer, stockées comme régions à code INSEE à 3 chiffres, portent le niveau COG `OM`), type d'aide, montant/durée, contact (`formulaire` → conseiller), effectif (bornes structurées, tranche exacte sinon « taille spécifique »), secteurs NAF (les 21 sections → « tous secteurs »), territoires, critères (ancienneté + autres), variantes, statut « temporairement indisponible » ;
4. publie (`publie`) si l'URL et tous les liens d'étape sont valides, sinon laisse en `en-creation`.

L'écriture est un **upsert par `slug`**, faite sous `SystemWorkflowContext` : le statut de la source s'impose au workflow éditorial.

Chaque champ que l'amont peut porter est écrit à chaque sync, un champ absent étant remis à `null` ou `[]` (`additionalInfo`, `otherOperators`, dates de validité, les trois champs de contact, les sept champs de montant et de durée de tous les types d'aide, `variants`, `metaTitle`, `metaDescription`) : un `update` Payload part de la dernière version, brouillon en attente compris, et un champ laissé de côté publierait la valeur du brouillon. `Programs.linkedProjects` n'est pas écrit : c'est un champ `relationship` **virtuel** (sans colonne), éditable des deux côtés : la liaison n'est stockée que dans `Projects.programs` ; `readLinkedProjects` (afterRead du champ) le remplit avec les projets qui citent le dispositif, `syncLinkedProjects` (afterChange) reporte la sélection dans `Projects.programs` via `ProgramProjectLinks`. Une liaison modifiée dans le CMS, d'un côté ou de l'autre, efface l'empreinte du projet : la sync suivante le réécrit avec les dispositifs de l'amont.

**Redirections** : `ProgramsSync` applique `program_redirects` (`RedirectTombstoneBuilder`). Un ancien slug encore présent en amont est marqué `remplace` ; un ancien slug absent devient un dispositif `remplace` cloné depuis sa cible, sous l'ancien slug gardé tel quel. Ces dispositifs sont importés après les autres, pour que `replacedBy` désigne un dispositif déjà en base, et sont enregistrés en version brouillon, comme l'action « Remplacer » de l'admin.

**Écriture sur différence** : `ProgramImporter` calcule l'empreinte des données Payload (`UpstreamFingerprint`) et la compare à `upstreamFingerprint` du document (dernière version). Identique, et dispositif présent dans le store canonical : rien n'est écrit, le dispositif est compté « unchanged ». Un dispositif que Payload refuse de publier est laissé en création **sans empreinte** : il est retenté et signalé à chaque exécution.

### Étape 3 : projets

`ProjectsSync` (`apps/cms/src/scripts/sync/projects/`) :

1. **Lecture** : `TeeProjectImporter.importMany(projects, now)` produit les projets pivot. Les `linkedProjects` amont (des `id` numériques propres au fichier) sont traduits en slugs, puis en identifiants pivot ; `priority` devient `priorite` (`default` → `defaut`, autres clés → `par_secteur`), `highlightPriority` → `mise_en_avant` ; `faqs` et `titleFaq` → `faq`.
2. **Passe 1** (`ProjectImporter`) : pour chaque projet, `CanonicalProjectToPayloadMapper.map` donne les données Payload (thèmes, sections NAF, FAQ et descriptions converties en Lexical, priorités, dispositifs résolus par identifiant pivot via `PayloadProjectRelations`). L'image est calculée à part, à partir de `image.chemin_source`, par `UpstreamMediaImporter` et `ImportedMediaPolicy` : même règle que les logos d'opérateurs (image posée à la main conservée, image importée remplacée ou retirée selon l'amont, téléchargement en échec sans effet). Un chemin d'image amont inexploitable (non enraciné, contenant `..`) ne donne pas d'image dans le pivot, mais il est quand même transmis à `UpstreamMediaImporter` (`TeeProjectImporter.unusableImagePaths`) : il compte comme un téléchargement en échec et l'image en place est conservée, au lieu d'être retirée comme si l'amont n'en avait plus. **Upsert par slug**, sous `SystemWorkflowContext` pour que `assignCanonicalId` prenne l'identifiant dérivé du slug, avec `_status: 'published'`. Un projet qui n'a plus de projet lié en amont voit ses `linkedProjects` vidés ; les autres gardent leur valeur publiée jusqu'à la passe 2. Les dispositifs sont retrouvés par leur `canonicalId` ou par l'identifiant dérivé de leur slug : un dispositif que le seed n'a pu réécrire qu'en brouillon (ligne principale à l'ancien identifiant) reste lié.
3. **Passe 2** (`LinkedProjectsUpdater`) : une fois tous les projets créés, `mapLinkedProjects` résout les projets liés et chaque projet concerné est republié. Écritures séquentielles (en parallèle, Postgres détecte des deadlocks sur `projects_rels`).

Chaque champ Payload est écrit à chaque seed, un champ absent en amont étant remis à `null` ou `[]` : un `update` Payload part de la dernière version, brouillon en attente compris, et un champ laissé de côté publierait la valeur du brouillon. La règle vaut aussi pour les deux champs que `ProjectImporter` calcule lui-même : `image` reçoit la valeur de la ligne principale quand la politique média répond « inchangé » (image posée à la main, téléchargement en échec, seed sans import de médias), et `linkedProjects` est écrit dès la passe 1.

**Pivot** : les projets étant écrits publiés, le hook `syncProjectCanonicalOnChange` remplit `canonical.canonical_projects` pendant le seed, sans étape dédiée. La passe 1 écrit la ligne d'un projet avec ses projets liés déjà publiés (aucun au premier seed), la passe 2 la réécrit avec ceux de l'amont.

**Redirections** (depuis le 2026-10-02) : `ProjectsSync` applique `project_redirects` (`ProjectTombstoneBuilder`). Chaque ancien slug devient un projet `workflowStatus: 'remplace'`, cloné depuis sa cible et relié à elle par `replacedBy` ; il est importé après les autres projets et enregistré en version brouillon, comme un dispositif remplacé. Le hook l'écrit dans le pivot avec `statut_projet: 'remplace'` et `remplace_par`.

**Écriture sur différence** : l'empreinte d'un projet couvre ses données Payload, son image et ses projets liés tels que le CMS les résout. Inchangée, et projet présent dans le store : ni la passe 1 ni la passe 2 n'écrivent. Un projet lié n'est à jour qu'après la passe 2, qui pose l'empreinte.

**Avertissements** affichés en fin de seed (préfixés par le slug du projet), sans code de sortie non nul : thème secondaire inconnu, priorité de mise en avant non numérique, question de FAQ sans texte ou sans réponse, chemin d'image invalide, projet lié inconnu en amont ou introuvable dans le CMS, dispositif introuvable dans le CMS, secteur hors sections NAF. **Erreurs** (code de sortie 1) : enregistrement amont écarté pour sa forme, projet refusé par Payload, thème principal inconnu, échec d'une mise à jour de la passe 2.

### Disparus de l'amont et rapprochement

Après les imports, `UpstreamSync` :

1. **annule** (`workflowStatus: 'annule'`, `GoneDocumentsCanceller`) les dispositifs et les projets importés qui ne figurent plus en amont et n'y sont pas redirigés. Un document est « importé » quand son `canonicalId` est celui dérivé de son slug : un document créé dans l'admin n'est jamais annulé. Au-delà de `max(5, 10 %)` des documents importés, rien n'est annulé et la commande sort en erreur ;
2. **rapproche** le CMS et les deux stores canonical (`CanonicalReconciler`) : ligne attendue absente du store = erreur, ligne inattendue = retirée.

Un document modifié dans le back-office perd son empreinte (`clearUpstreamFingerprint`) et est réécrit depuis l'amont à l'exécution suivante.

### Idempotence

Ré-exécutable : une deuxième exécution n'écrit rien si l'amont n'a pas changé, et ne crée aucune version Payload (résultat du 2026-10-02 sur une base jetable, sans téléchargement d'images : 290 dispositifs et 97 projets créés à la première exécution, 290 et 97 « unchanged » à la seconde, en 0,6 s contre 17 s). Les médias sont retrouvés par `sourcePath` : un second seed n'en crée aucun et n'écrit rien de nouveau dans le bucket (136 médias au 2026-09-28 : 45 logos d'opérateurs, 91 images de projets).

### Logs de sortie

```
Source : https://raw.githubusercontent.com/.../programs.json + ...
Found 276 programs in source.
Found 76 unique operators. Upserting...
Found 12 operator groups. Upserting...
Operator groups ready: 12 groups, 67 operators updated.
Operators ready. Importing 288 programs...
Programs complete: 288 created, 0 updated, 0 unchanged, 0 errors.
Redirections : 1 dispositif(s) marqué(s) en place, 12 remplacé(s) cloné(s), 0 ignorée(s).
  ⚠ 47 × restriction de catégorie légale (micro-entreprises) sans champ Payload
  ...
Found 91 projects in source.
Pass 1: importing 97 projects...
Pass 1 complete: 97 created, 0 updated, 0 unchanged, 0 errors.
Redirections : 0 projet(s) marqué(s) en place, 6 remplacé(s) cloné(s), 0 ignorée(s).
Pass 2: updating linked projects...
Pass 2 complete: 74 updated, 0 errors.
Médias : 136 créés, 0 réutilisés (dont 0 recatégorisés), 0 en échec.
Rapprochement CMS ↔ canonical : aucun écart restant.
```

---

## Données que le CMS ne porte pas (signalées en fin de seed)

| Donnée amont | Volume (09/2026) | Raison |
|---|---|---|
| Non éligible aux micro-entreprises | 47 | aucun champ Payload |
| Montant de financement d'une étude | 53 | une seule case montant par type d'aide (coût restant à charge pour une étude) |
| Lien d'étape vers le formulaire conseiller | 31 | un lien Payload exige une URL |
| Durée d'un prêt | 10 | pas de champ durée pour les prêts |
| Territoires mêlant départements et régions (ex. « Landes, Nouvelle-Aquitaine, Occitanie ») | 12 | le formulaire n'a qu'un niveau de couverture : le niveau départemental est retenu, les régions restent dans le texte de retour (`geographicAreaFeedback`) |
| Texte libre d'effectif sans bornes (ex. « Moins de 250 salariés ») | 9 | on suit les bornes structurées, que le site TEE utilise pour l'éligibilité |
| `publicodes`, `illustration` | tous | exclus du modèle CMS (ADR 0001) |
| `color` d'`operators.json` | tous | présentation propre au front amont |
| Secteur d'un projet hors sections NAF (code `55`, `55.3`) | 0 | `Projects.sectors` n'accepte que les 21 sections ; le code est écarté et signalé (les priorités par secteur, elles, acceptent tout code NAF) |
| `id` numérique d'un projet et d'une question de FAQ | tous | propres au fichier amont, remplacés par le slug et l'identifiant pivot |

---

## Tests

```sh
pnpm test         # intégration, base tee_test
pnpm test:unit    # CanonicalToPayloadMapper.spec.ts, sans base
```

- `seed.int.spec.ts` : opérateurs, dispositifs, thèmes, Lexical, brouillon sur lien invalide, idempotence (fixture `apps/cms/tests/fixtures/programs.json`) ; projets (fixture `apps/cms/tests/fixtures/projects.json`, 5 projets) : publiés, `canonicalId` dérivé du slug, FAQ, priorités, projets liés présents dans le pivot en fin de seed, champs d'un brouillon en attente jamais publiés (image et projets liés compris, y compris après la seule passe 1). La suite supprime d'abord les projets de la fixture : elle ne dépend pas de l'ordre des fichiers de test.
- `project-images.int.spec.ts` : image d'un projet remplacée, retirée, gardée sur échec de téléchargement ou sur chemin amont inexploitable (compté en échec), jamais écrasée si posée à la main ; second seed sans nouveau projet ni média.
- `CanonicalProjectToPayloadMapper.spec.ts` (unitaire) : pivot projet → données Payload.
- `PayloadProjectRelations.spec.ts` (unitaire) : résolution par `canonicalId` stocké et par identifiant dérivé du slug.
- `operator-profiles.int.spec.ts` : groupes, opérateur multi-groupe, logos, logos de groupe et d'opérateur posés à la main conservés, avertissements, idempotence, règles d'écrasement au second import (logo remplacé, retiré, gardé sur 404) (fixtures `operators.json`, `pixel.webp`, `fetch` factice `FakeAssetFetch`).
- `upstream-media.int.spec.ts` : création d'un média (type posé), réutilisation sans téléchargement, réalignement d'un type erroné, fichier manquant, chemin refusé.
- `media-rules.int.spec.ts` : écriture des médias refusée à un créateur, `sourcePath` ignoré s'il est envoyé par l'API, sélecteurs de logo refusant une image de projet.
- `OperatorLogoResolver.spec.ts` (unitaire) : logo propre, secours par groupe, aucun logo.
- `vitest.config.mts` force `S3_BUCKET: ''` : les tests n'écrivent jamais dans un bucket réel.
- `upstream-roundtrip.int.spec.ts` : les 276 dispositifs de la copie amont passent par le CMS puis `ProgramCanonicalMapper`, et chaque champ porté doit ressortir identique à ce qu'a produit `TeeImporter`.

---

## En cas d'erreur

- Les erreurs par dispositif sont loggées individuellement et ne bloquent pas les suivants (`X created, Y updated, Z errors`).
- Causes fréquentes : opérateur de contact absent, type d'aide inconnu.
- Projets : même principe (`Error importing project "<slug>"`), et `pnpm seed` sort en code 1 si une erreur est remontée par les dispositifs ou les projets, ou si l'amont porte des projets écartés (`Projets amont écartés (n) :`, un par ligne, nommé par son slug ou sa position).
