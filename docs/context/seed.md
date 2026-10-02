# Seed : import des données amont dans le CMS

## Objectif

`pnpm seed` remplit PayloadCMS (via la **Local API**) avec les dispositifs, projets et opérateurs du dépôt GitHub amont `betagouv/mission-transition-ecologique` (`libs/data/static/programs.json`, `projects.json`, et `apps/nuxt/src/public/json/operator/operators.json` pour les groupes et logos d'opérateurs), qui fait foi. Les logos et images de projets sont téléchargés depuis le dossier public du front amont et importés dans `Media` (ADR 0013). Le store canonical est alimenté au passage par le hook `syncCanonicalOnPublish`.

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
pnpm data:snapshot      # rafraîchit la copie locale de secours (à commiter)
```

Le point d'entrée est `apps/cms/src/scripts/seed/run.ts`.

---

## Source des données

- `UpstreamJsonSource.fromSettings(Config.upstreamFallback())` lit les fichiers JSON sur GitHub (timeout 30 s) ; `operators.json` est validé par `teeOperatorSchema`.
- `UpstreamAssetSource` télécharge les logos et images par leur chemin amont (`raw.githubusercontent.com/.../main/apps/nuxt/src/public` + chemin, timeout 30 s).
- **Avec `TEE_UPSTREAM_LOCAL_FALLBACK=1`** dans le `.env` (usage local), une panne GitHub (réseau, timeout, 5xx) bascule sur la copie versionnée `libs/format-adapters/static/upstream/`, avec un avertissement. Un 404 ou un JSON invalide échoue toujours : c'est un vrai changement amont.
- Les images **ne sont pas versionnées** dans `static/upstream/` : en repli, les groupes sont rattachés depuis la copie d'`operators.json`, les téléchargements échouent et sont signalés, le seed se termine.
- **Sans la variable**, pas de repli : le seed échoue. Sur Scalingo, la variable est **refusée** (erreur explicite), même si elle est posée.
- `docs/sources/` n'est plus lu par le code (archive de la reprise historique).

---

## Comportement

### Un seul lecteur du format amont

Le format brut de `programs.json` n'est interprété que par `TeeImporter` (`libs/format-adapters`), le même lecteur que l'import canonical. Chaque dispositif devient un `CanonicalProgramInput` (identifiant `SlugCanonicalId` dérivé du slug), puis `CanonicalToPayloadMapper` le transforme en données Payload.

### Étape 1 : opérateurs

`OperatorImporter` déduplique les opérateurs cités (contact, autres, variantes), fait un **upsert par slug** et construit la table `nom → id`.

Puis, depuis `operators.json` :

1. `OperatorGroupImporter` fait un upsert des groupes, rapprochés par slug ou par nom (un groupe créé dans l'admin avec un slug à lui garde ce slug) (`filterCategories`, 12 au 2026-09-28) et pose le logo par défaut de 5 groupes (`OperatorGroupLogoDefaults` : Agence de l'eau, CCI, CMA, ADEME, Bpifrance), **sauf si le groupe a déjà un logo** (posé dans l'admin).
2. `OperatorProfileImporter` rapproche chaque opérateur amont d'un opérateur CMS par le slug de son nom :
   - `groups` est **remplacé par la liste amont** (une modification manuelle est perdue) ;
   - logo : un logo **uploadé à la main** (média sans `sourcePath`) n'est jamais écrasé ; un logo **importé** suit l'amont et est retiré si l'amont n'a plus d'`imagePath` ; un téléchargement en échec garde le logo actuel (`ImportedMediaPolicy`, même règle pour l'image des projets) ; un `imagePath` vide ou `null` vaut « pas de logo » ;
   - un opérateur amont inconnu du CMS est **signalé**, pas créé ; un opérateur du CMS absent d'`operators.json` n'est pas touché.

### Médias importés

`UpstreamMediaImporter` (`apps/cms/src/scripts/seed/media/`) transforme un chemin amont en id de média : il cherche un média par `sourcePath` et ne télécharge que s'il n'en trouve pas (texte alternatif `Logo de <nom>`, ou titre du projet). Il pose le type (`category`) : `operator-logo` pour les logos d'opérateurs et de groupes, `project-image` pour les images de projets ; un média retrouvé dont le type diffère est réaligné (compteur « recatégorisés »), ce qu'exigent les sélecteurs filtrés par type. `sourcePath` n'est écrit que par le seed (Local API, `overrideAccess`) : il est masqué dans l'admin et ignoré s'il arrive par l'API. Appels séquentiels. Un fichier introuvable (404), un refus HTTP ou un chemin invalide est signalé en fin de seed, jamais fatal : le document est gardé sans image.

### Étape 2 : dispositifs

Pour chaque dispositif, `CanonicalToPayloadMapper` :
1. résout les relations (opérateurs, zones géographiques par nom ou code COG) via `PayloadProgramRelations` ;
2. convertit le markdown en Lexical (`PayloadMarkdownToRichText`) ;
3. traduit thèmes, zones (les collectivités d'outre-mer, stockées comme régions à code INSEE à 3 chiffres, portent le niveau COG `OM`), type d'aide, montant/durée, contact (`formulaire` → conseiller), effectif (bornes structurées, tranche exacte sinon « taille spécifique »), secteurs NAF (les 21 sections → « tous secteurs »), territoires, critères (ancienneté + autres), variantes, statut « temporairement indisponible » ;
4. publie (`publie`) si l'URL et tous les liens d'étape sont valides, sinon laisse en `en-creation`.

L'écriture est un **upsert par `slug`**, faite sous `SystemWorkflowContext` : le statut de la source s'impose au workflow éditorial.

### Étape 3 : projets

`ProjectsSeed` importe `projects.json` (liaison vers les dispositifs par slug, image importée en média via `UpstreamMediaImporter`, selon la même règle que les logos d'opérateurs : image posée à la main conservée, image importée remplacée ou retirée selon l'amont, téléchargement en échec sans effet ; puis projets liés en seconde passe).

### Idempotence

Ré-exécutable : une deuxième exécution met à jour au lieu de créer des doublons. Les médias sont retrouvés par `sourcePath` : un second seed n'en crée aucun et n'écrit rien de nouveau dans le bucket (136 médias au 2026-09-28 : 45 logos d'opérateurs, 91 images de projets).

### Logs de sortie

```
Source : https://raw.githubusercontent.com/.../programs.json + ...
Found 276 programs in source.
Found 76 unique operators. Upserting...
Found 12 operator groups. Upserting...
Operator groups ready: 12 groups, 67 operators updated.
Operators ready. Importing 276 programs...
Seed complete: 276 created, 0 updated, 0 errors.
  ⚠ 47 × restriction de catégorie légale (micro-entreprises) sans champ Payload
  ...
Médias : 136 créés, 0 réutilisés (dont 0 recatégorisés), 0 en échec.
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

---

## Tests

```sh
pnpm test         # intégration, base tee_test
pnpm test:unit    # CanonicalToPayloadMapper.spec.ts, sans base
```

- `seed.int.spec.ts` : opérateurs, dispositifs, thèmes, Lexical, brouillon sur lien invalide, idempotence (fixture `apps/cms/tests/fixtures/programs.json`).
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
