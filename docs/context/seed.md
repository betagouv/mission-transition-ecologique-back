# Seed : import des données amont dans le CMS

## Objectif

`pnpm seed` remplit PayloadCMS (via la **Local API**) avec les dispositifs et projets du dépôt GitHub amont `betagouv/mission-transition-ecologique` (`libs/data/static/programs.json`, `projects.json`), qui fait foi. Le store canonical est alimenté au passage par le hook `syncCanonicalOnPublish`.

---

## Prérequis

1. Le PostgreSQL local doit tourner (`pnpm db:up`) et la base doit avoir son schéma : en dev, lancer `pnpm dev` une fois suffit (mode `push`) ; sur une base vierge hors dev, `pnpm migrate`.
2. Les variables d'environnement doivent être configurées (`.env` dans `apps/cms/`, voir `.env.example`) :
   ```
   DATABASE_URI=postgres://tee:tee@localhost:5432/tee
   CANONICAL_DATABASE_URI=postgres://tee:tee@localhost:5432/tee
   PAYLOAD_SECRET=<une-chaine-secrete>
   ```
3. Optionnel : `TEE_PROGRAMS_URL` / `TEE_PROJECTS_URL` pour lire une autre source que le dépôt amont.

---

## Utilisation

```sh
pnpm seed               # = nx run @tee-backoffice/cms:seed
pnpm data:snapshot      # rafraîchit la copie locale de secours (à commiter)
```

Le point d'entrée est `apps/cms/src/scripts/seed/run.ts`.

---

## Source des données

- `UpstreamJsonSource.fromSettings(Config.upstreamFallback())` lit les fichiers sur GitHub (timeout 30 s).
- **Avec `TEE_UPSTREAM_LOCAL_FALLBACK=1`** dans le `.env` (usage local), une panne GitHub (réseau, timeout, 5xx) bascule sur la copie versionnée `libs/format-adapters/static/upstream/`, avec un avertissement. Un 404 ou un JSON invalide échoue toujours : c'est un vrai changement amont.
- **Sans la variable**, pas de repli : le seed échoue. Sur Scalingo, la variable est **refusée** (erreur explicite), même si elle est posée.
- `docs/sources/` n'est plus lu par le code (archive de la reprise historique).

---

## Comportement

### Un seul lecteur du format amont

Le format brut de `programs.json` n'est interprété que par `TeeImporter` (`libs/format-adapters`), le même lecteur que l'import canonical. Chaque dispositif devient un `CanonicalProgramInput` (identifiant `SlugCanonicalId` dérivé du slug), puis `CanonicalToPayloadMapper` le transforme en données Payload.

### Étape 1 : opérateurs

`OperatorImporter` déduplique les opérateurs cités (contact, autres, variantes), fait un **upsert par slug** et construit la table `nom → id`.

### Étape 2 : dispositifs

Pour chaque dispositif, `CanonicalToPayloadMapper` :
1. résout les relations (opérateurs, zones géographiques par nom ou code COG) via `PayloadProgramRelations` ;
2. convertit le markdown en Lexical (`PayloadMarkdownToRichText`) ;
3. traduit thèmes, zones (les collectivités d'outre-mer, stockées comme régions à code INSEE à 3 chiffres, portent le niveau COG `OM`), type d'aide, montant/durée, contact (`formulaire` → conseiller), effectif (bornes structurées, tranche exacte sinon « taille spécifique »), secteurs NAF (les 21 sections → « tous secteurs »), territoires, critères (ancienneté + autres), variantes, statut « temporairement indisponible » ;
4. publie (`publie`) si l'URL et tous les liens d'étape sont valides, sinon laisse en `en-creation`.

L'écriture est un **upsert par `slug`**, faite sous `SystemWorkflowContext` : le statut de la source s'impose au workflow éditorial.

### Étape 3 : projets

`ProjectsSeed` importe `projects.json` (liaison vers les dispositifs par slug, puis projets liés en seconde passe).

### Idempotence

Ré-exécutable : une deuxième exécution met à jour au lieu de créer des doublons.

### Logs de sortie

```
Source : https://raw.githubusercontent.com/.../programs.json + ...
Found 276 programs in source.
Found 76 unique operators. Upserting...
Operators ready. Importing 276 programs...
Seed complete: 276 created, 0 updated, 0 errors.
  ⚠ 47 × restriction de catégorie légale (micro-entreprises) sans champ Payload
  ...
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

---

## Tests

```sh
pnpm test         # intégration, base tee_test
pnpm test:unit    # CanonicalToPayloadMapper.spec.ts, sans base
```

- `seed.int.spec.ts` : opérateurs, dispositifs, thèmes, Lexical, brouillon sur lien invalide, idempotence (fixture `apps/cms/tests/fixtures/programs.json`).
- `upstream-roundtrip.int.spec.ts` : les 276 dispositifs de la copie amont passent par le CMS puis `ProgramCanonicalMapper`, et chaque champ porté doit ressortir identique à ce qu'a produit `TeeImporter`.

---

## En cas d'erreur

- Les erreurs par dispositif sont loggées individuellement et ne bloquent pas les suivants (`X created, Y updated, Z errors`).
- Causes fréquentes : opérateur de contact absent, type d'aide inconnu.
