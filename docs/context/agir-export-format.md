# Export AGIR — triple format (index + détail R2DA + pivot ADEME)

> Contexte de la tansmission de données vers AGIR. 
> Le convertisseur vit dans `libs/format-adapters/src/agir/`;
> les endpoints publics dans `apps/cms/src/endpoints/agir/`. 
> Source des données = **store canonical**
> (`CanonicalProgramRepository`, `CanonicalProjectRepository`), jamais les
> collections Payload.
>
> Ce document décrit d'abord les **dispositifs** (index, détail R2DA, pivot
> ADEME), puis les **projets** (index et pivot, section « Projets » en fin de
> document, ADR 0014).

## Endpoints (publics, lecture seule, JSON)

| Méthode | Route | Réponse | Source |
|---|---|---|---|
| GET | `/api/agir/programs` | `ListeDispositif[]` (index, 2 URLs/entrée) | `repository.findAll()` |
| GET | `/api/agir/programs/{slug}/detail` | `DetailDispositif` (proposition 1, R2DA) | `repository.findBySlug(slug)` |
| GET | `/api/agir/programs/{slug}/pivot` | `AdemePivot` (proposition 2) | `repository.findBySlug(slug)` |
| GET | `/api/agir/projects` | `ListeProjet[]` (index, 1 URL/entrée) | store des projets, `findAll()` |
| GET | `/api/agir/projects/{slug}/pivot` | `AgirProjetPivot` | store des projets, `findBySlug(slug)` ; références résolues sur les deux stores |

Règles communes aux routes des dispositifs (celles des projets sont dans la section « Projets ») :

- N'exposer que les dispositifs **publiés** (`statut_edition === 'pret_prod'`,
  `ExportPolicy.isPublished`) **et** dont `statut_dispositif ∈ { valide,
  temporairement_indisponible, remplace, archive }` (`AgirEtatMapper.isExportable`).
  Seul `inconnu` (et l'`abandonne` éditorial) est **absent** de l'index et renvoie
  `404` en détail/pivot. Un dispositif **archivé continue d'être transmis** (porté
  par `date_cloture` = date de fin, pas de statut dédié) ; un dispositif
  **remplacé** est transmis avec `statut = remplace` + `remplace_par`. Le filtre
  combiné = `AgirExportPolicy.isExportable`. ⚠️ L'export open data (Grist) reste,
  lui, restreint à `valide`/`temporairement_indisponible` (`SchemaExportPolicy`,
  indépendant d'AGIR).
- `404` si slug inconnu ou non exportable, `200` + corps JSON sinon.
- Le slug est encodé dans `urlDetail`/`urlPivot` (`encodeURIComponent`) : un tombstone `remplace` peut garder un ancien slug avec apostrophe ou majuscule. Payload décode le paramètre de route avant la recherche.
- Pas de pagination au MVP (volume faible).

## Environnements

| Environnement | Base URL | Index AGIR |
|---|---|---|
| Local | `http://localhost:3000` | <http://localhost:3000/api/agir/programs> |
| Préprod | `https://preprod.back.mission-transition-ecologique.incubateur.net` | <https://preprod.back.mission-transition-ecologique.incubateur.net/api/agir/programs> |
| Review app (une par PR) | URL de la review app Scalingo (`tee-back-preprod-pr<n>`) | `{baseUrl}/api/agir/programs` |
| Production | pas encore déployée | |

L'index des projets est à la même base : `{baseUrl}/api/agir/projects`.

Aucune authentification : un simple `GET` suffit.

```sh
BASE=https://preprod.back.mission-transition-ecologique.incubateur.net

curl "$BASE/api/agir/programs"                                    # index
curl "$BASE/api/agir/programs/accelerateur-decarbonation/detail"  # détail R2DA
curl "$BASE/api/agir/programs/accelerateur-decarbonation/pivot"   # pivot ADEME
```

Les liens absolus `urlDetail`/`urlPivot` de l'index sont construits à partir
de la base URL publique (`PublicBaseUrlResolver.resolve` de `src/utils/`,
partagé par `agirProgramEndpoints.ts` et `agirProjectEndpoints.ts`).

La forme des URL n'est écrite qu'à un endroit, `AgirRoutes`
(`libs/format-adapters/src/agir/`) : les endpoints y prennent leur `path`
(`AgirRoutes.PROGRAM_PIVOT` = `/agir/programs/:slug/pivot`...) et les exporters
d'index y construisent leurs liens à partir des mêmes gabarits (slug encodé,
préfixe `/api` de Payload). Une route renommée ne peut donc pas laisser l'index
servir des liens vers l'ancienne. Ces routes restent un contrat avec AGIR : les
specs les écrivent en toutes lettres, pour qu'un changement fasse échouer un
test.

**En production** (`NODE_ENV=production` : prod, préprod, review apps), seule
la variable `PUBLIC_BASE_URL` (`Config.publicBaseUrl()`) est lue. Elle est à
renseigner sur chaque app Scalingo ; sur les review apps, `scalingo.json` la
redéfinit avec l'URL de la review app. Sans elle, les endpoints qui produisent
des liens absolus répondent en erreur : les en-têtes `x-forwarded-*` ne sont
pas lus, un client qui atteindrait l'app sans passer par le routeur pouvant les
forger et faire apparaître son propre domaine dans les liens.

**Hors production**, la base est résolue dans cet ordre :

1. la variable `PUBLIC_BASE_URL` si elle est renseignée ;
2. sinon les en-têtes `x-forwarded-host` / `x-forwarded-proto` ;
3. sinon `req.origin` (`http://localhost:3000` en local).

La préprod étant réinitialisée et reseedée à chaque déploiement (ADR 0012), son
contenu reflète l'amont au moment du dernier déploiement, complété par le
pipeline quotidien.

## Vocabulaire AGIR — ⚠️ choix à confirmer

Centralisé dans `AgirVocabulary` (un seul fichier pour ajuster). Valeurs
**placeholder** tant qu'AGIR n'a pas tranché :

- `source` : `INTERNE → tee`, `ADEME → ademe`, `SCHEMA → schema` (`AgirSourceMapper`).
- `statut` / `etatDispositif` (index + détail + pivot, **vocabulaire unique**
  français snake_case, `AgirEtatMapper`) : `valide → en_prod`,
  `temporairement_indisponible → temporairement_indisponible`,
  `remplace → remplace`, `archive → en_prod` (l'archivage est porté par
  `date_cloture`, pas par un statut).
- `themes` (pivot) : vocabulaire wire à 7 valeurs (`AgirThemeMapper`) ; les 3
  thèmes de la famille environnement (`environnemental`/`ecoconception`/
  `biodiversite`) sont repliés sur `environnement`.
- `contact_question` (pivot) : aucun delta, la forme canonical est reprise telle
  quelle (`conseiller_entreprise`/`email`/`url`).
- `typeDispositif` (détail) : libellés d'affichage des `types_aides` joints par
  ` | ` (`AgirTypeDispositifMapper`). Format unique/liste/enum à confirmer.
- `typeSecteur` (détail) : déduit du niveau COG (`PAYS → National`,
  `REG → Régional`, `DEP → Départemental`…), `Régional et départemental` pour
  des régions (ou collectivités d'outre-mer) listées avec des départements,
  `Inconnu` pour tout autre mélange.
- Noms de clés `urlDetail` / `urlPivot` de l'index : à confirmer avec AGIR.

## 1. `ListeDispositif` (index)

Schéma cible `ListeDispositif TEE R2DA v1.0` + 2 URLs ajoutées.

| Champ | Source canonical |
|---|---|
| `idDispositif` | `slug` |
| `idFonctionnel` | `slug` |
| `titre` | `titre` |
| `source` | `AgirSourceMapper(source)` |
| `dateDispositif.dateDebut` | `date_ouverture` (omis si absent) |
| `dateDispositif.dateFin` | `date_cloture` (omis si absent) |
| `dateDerniereModification` | `date_mise_a_jour` |
| `etatDispositif` | `AgirEtatMapper(statut_dispositif)` |
| `urlDetail` *(ajout)* | `{baseUrl}/api/agir/programs/{slug}/detail` |
| `urlPivot` *(ajout)* | `{baseUrl}/api/agir/programs/{slug}/pivot` |

## 2. `DetailDispositif` (proposition 1, R2DA)

Stratégie : **mapper ce qu'on a, omettre le reste** (pas de `null`/`{}`
parasites). Garde-fou de sortie `agir-detail.schema.ts` (`.strict()`).

| Champ | Source canonical |
|---|---|
| `idDispositif` / `idFonctionnel` / `titre` / `source` / `dateDispositif` / `dateDerniereModification` / `etatDispositif` | comme l'index |
| `typeDispositif` | `AgirTypeDispositifMapper(types_aides)` |
| `elligibilite.texteElligibilite` | concat des `eligibilite.*.texte` (puces `- `) |
| `elligibilite.secteurActivite.listeSecteurActivite` | `eligibilite.secteur_activite.structure.inclusions` (NAF) |
| `elligibilite.secteurGeographique.listeRegion` | `eligibilite.secteur_geographique.structure.inclusions` (COG) |
| `elligibilite.secteurGeographique.typeSecteur` | déduit du niveau COG |
| `documentation.vignette.urlImage` / `.alt` | `illustration.url` / `.alt` |
| `description.organisme` | `operateurs.contact.nom` |
| `description.descriptionCourte` / `.descriptionLongue` | `description` / `description_longue` |
| `description.partenaires` | `operateurs.autres[].nom` |
| `description.montantAide` | `montant.valeur` |
| `description.thematique` | `themes` (français) |
| `description.mailContact` | `contact_question.valeur` si `type === 'email'` |
| `etapeDepot[]` | `etapes_activation[]` → `{ ordreEtape: i+1, libelleEtape: description, lienEtape: 1er lien url }` |

**Omis (pas de source)** : `sousTypeAAP`, `dateDispositif.millesime/dateDeResultat/Releve`,
`elligibilite.documentation` (Alfresco), `tailleEntreprise`, `ancienneteActivite`,
`documentation.aideAuDepot/aideAuxEtudes/listePiece`,
`description.acronyme/typeDepot/typeProjet/cibleprojet/cibleTexteAide/financement/fonds/programmeAAP`.

## 3. `AdemePivot` (proposition 2)

= **canonical wire** + deltas ADEME. L'exporter construit une **liste blanche**
explicite (champ par champ) puis re-valide via `ademe-pivot.schema.ts`
(`.strict()`) : aucun champ interne ajouté plus tard ne peut fuir.

Deltas vs canonical :

1. `id` ← `slug` (jamais le cuid2).
2. `ademe_id_dsp` ← `autres_donnees.ademe_id_dsp` **si présent** ; le reste de
   `autres_donnees` n'est **pas** émis.
3. `source` ← `AgirSourceMapper` (minuscules).
4. `statut` ← `AgirEtatMapper` (`en_prod`/`temporairement_indisponible`/
   `remplace`) ; `statut_edition`/`statut_dispositif` **supprimés**. `archive` est
   remonté en `en_prod` (date de fin dans `date_cloture`).
5. `remplace_par` : **conservé** quand `statut === 'remplace'`, résolu du cuid2
   canonical vers le **slug** du remplaçant (`RemplaceParResolver`, construit sur
   `repository.findAll()`) ; omis si le pointeur est introuvable. Les dispositifs
   `remplace` proviennent des **redirections amont** (`redirects.json`) : depuis
   le 2026-10-02 ce sont des dispositifs du CMS (`workflowStatus: 'remplace'`,
   `replacedBy`), écrits par le seed et la sync quotidienne, que le hook pousse
   dans le store (voir `docs/context/schema-grist-export.md` §Pipeline quotidien).
6. `montant` / `duree` : **objet `{ type, valeur }`** inchangé.
7. `contact_question` : repris tel quel du canonical (aucune traduction de
   vocabulaire). Pas de type `formulaire` dans le canonical : la valeur
   `"formulaire"` de la source TEE désigne la mise en relation
   Conseillers-Entreprises et devient `conseiller_entreprise`.
8. `themes` : vocabulaire wire à 7 valeurs (`AgirThemeMapper`, famille
   environnement repliée sur `environnement`).
9. `eligibilite`, `variantes`, `operateurs`, `etapes_activation`, contenu
   éditorial : forme canonical inchangée.

## Couverture du canonical par les deux formats

Légende : ✅ exporté fidèlement · ⚠️ exporté mais dégradé/partiel · ❌ absent.

| Donnée canonical | Détail (P1, R2DA) | Pivot (P2, ADEME) | Commentaire |
|---|---|---|---|
| `id` (cuid2) | ❌ | ❌ | remplacé par le slug ; identifiant interne durable non exposé |
| `slug` | ✅ `idFonctionnel` | ✅ `id` | |
| `source` | ✅ | ✅ | |
| `date_mise_a_jour` | ✅ | ✅ | |
| `titre` | ✅ | ✅ | |
| `promesse` | ❌ | ✅ | pas de champ R2DA |
| `description` | ✅ `descriptionCourte` | ✅ | |
| `description_longue` | ✅ `descriptionLongue` | ✅ | |
| `illustration` | ✅ `vignette` (url + alt) | ✅ | `creditVisuel`/`titreVisuel` R2DA non alimentés |
| `meta` (SEO) | ❌ | ✅ | omission acceptable (usage interne) |
| `statut_dispositif` | ✅ `etatDispositif` | ✅ `statut` | |
| `date_ouverture` / `date_cloture` | ✅ | ✅ | |
| `types_aides` | ⚠️ `typeDispositif` (chaîne jointe) | ✅ (enum) | format P1 à confirmer |
| `montant` | ⚠️ `montantAide` (valeur seule) | ✅ `{ type, valeur }` | le libellé `montant.type` est perdu en P1 |
| `duree` | ❌ | ✅ | **lacune P1** |
| `operateurs.contact` | ⚠️ `organisme` (nom) | ✅ | `siren`/`nom_normalise` perdus en P1 |
| `operateurs.autres` | ⚠️ `partenaires` (noms) | ✅ | `siren` perdus en P1 |
| `contact_question` | ⚠️ `email` → `mailContact` **seulement** | ✅ | **lacune P1** (voir ci-dessous) |
| `url_source` | ❌ | ✅ | **lacune P1 majeure** |
| `etapes_activation` | ⚠️ `etapeDepot` (1 lien/étape) | ✅ | liens multiples + redirection conseiller perdus en P1 |
| `eligibilite.*.texte` | ✅ `texteElligibilite` (concat) | ✅ | |
| `eligibilite.effectif.structure` | ❌ (texte seul) | ✅ | `tailleEntreprise` R2DA non alimenté |
| `eligibilite.anciennete` | ⚠️ texte seul | ✅ | `ancienneteActivite` (number) R2DA non alimenté |
| `eligibilite.categorie_legale` | ⚠️ texte seul | ✅ | exclusion micro-entrepreneur non structurée en P1 |
| `secteur_activite.inclusions` | ✅ `listeSecteurActivite` | ✅ | codes NAF **bruts** (pas de libellés) |
| `secteur_activite.exclusions` | ❌ | ✅ | perdues en P1 |
| `secteur_geographique.inclusions` | ✅ `listeRegion` | ✅ | codes COG **bruts** : `PAYS-99100` pour un dispositif national, `REG-`/`OM-`/`DEP-` sinon (noms non utilisés) |
| `secteur_geographique.exclusions` | ❌ | ✅ | perdues en P1 |
| `themes` | ✅ `thematique` (FR) | ✅ (FR) | taxonomie non mappée vers une réf. AGIR/ADEME |
| `variantes` | ❌ | ✅ | **lacune P1** |
| `statut_dispositif = remplace` | ⚠️ `etatDispositif` (état seul) | ✅ `statut` + `remplace_par` (slug) | cible de redirection portée par le pivot |
| `autres_donnees.ademe_id_dsp` | ❌ (idDispositif = slug) | ✅ (racine) | `idDispositif`/`idFonctionnel` = `slug` |
| `autres_donnees` (reste) | ❌ | ❌ | passthrough interne — non exporté **volontairement** |

> En une phrase : le **pivot (P2) est l'export complet** (quasi sans perte), le
> **détail R2DA (P1) est une projection d'affichage avec pertes**. Si AGIR peut
> consommer le pivot, c'est la source de vérité à privilégier ; le détail R2DA
> sert l'UI et accepte les omissions ci-dessous.

## Lacunes du Détail R2DA (proposition 1) — à arbitrer avec AGIR

Toutes les pertes notables sont en P1 (le pivot ne perd rien d'essentiel).

1. **Contact / question (`contact_question`)** — ⚠️ seul le canal `email` est
   exporté (`mailContact`). Les canaux `url` (formulaire en ligne) et
   `conseiller_entreprise` sont **perdus** : le schéma R2DA n'a aucun champ
   dédié. Conséquence : l'usager ne sait plus **comment poser sa question** quand
   le contact n'est pas un e-mail. → champ à ajouter (cf. recommandations).
2. **URL source du dispositif (`url_source`)** — ❌ le lien vers la page réelle
   de l'aide n'existe pas dans R2DA et n'est pas exporté. C'est probablement le
   champ **le plus utile** pour rediriger l'usager. → à ajouter.
3. **Durée (`duree`)** — ❌ ex. « 8 jours de formation » : perdue (R2DA n'a que
   `montantAide`). → ajouter un pendant `dureeAide`.
4. **Variantes (`variantes`)** — ❌ montant / opérateur / éligibilité
   conditionnels (par région ou effectif) totalement absents. Le détail affiche
   **les valeurs de base**, qui peuvent être fausses pour un profil donné. R2DA
   n'a pas de notion de variante. → décider : aplatir, exposer, ou documenter la
   limite.
5. **Éligibilité structurée** — `effectif {min,max}`, ancienneté, exclusion
   micro-entrepreneur et les **exclusions** NAF/COG ne survivent que dans le
   `texteElligibilite` concaténé. R2DA prévoit `tailleEntreprise` et
   `ancienneteActivite` (number) : non alimentés (forme numérique non garantie
   côté canonical). → filtrage fin impossible côté AGIR tant que ce n'est pas
   tranché.
6. **Format des codes** — `listeSecteurActivite` = codes NAF bruts (`C`,
   `33.20`) ; `listeRegion` = codes COG bruts (`REG-53`, `PAYS-99100`).
   `TerritoryNameResolver` (codes → noms) existe dans `shared/` mais **n'est
   pas utilisé**. Depuis le 29/09/2026, un dispositif national porte
   `PAYS-99100` (`typeSecteur` = `National`) et les départements cités par
   l'amont (`DEP-40`, `DEP-13`…) sont transmis ; des régions listées avec des
   départements donnent `typeSecteur` = `Régional et départemental` (valeur à
   confirmer avec AGIR, comme le reste du vocabulaire). → confirmer si AGIR attend des codes, des libellés, ou des objets
   `{ code, label }`.
7. **SIREN des opérateurs** — `operateurs.*.siren` perdus ; seuls les noms
   passent. Identification fiable de l'organisme dégradée.
8. **Mineurs** — `promesse` et `meta` non mappés (pas de champ / interne) ;
   `montant.type` (libellé) perdu en P1 ; `etapeDepot` ne garde qu'**un** lien
   par étape et ignore les redirections `conseiller_entreprise` ;
   `vignette.creditVisuel`/`titreVisuel` non alimentés.

## Lacunes du Pivot ADEME (proposition 2)

Le pivot est quasi exhaustif. Points ouverts (par choix, pas par oubli) :

- **`id` interne (cuid2) non exposé** (seul le slug). Si ADEME veut une clé
  stable indépendante d'un slug renommable, prévoir de la remonter.
- **Taxonomies partiellement mappées** : `themes` passe par le vocabulaire wire
  à 7 valeurs (`AgirThemeMapper`) ; `types_aides` reste livré tel quel, faute de
  correspondance vers une nomenclature ADEME/AGIR (non fournie à ce stade).
- **`remplace_par` conservé** : résolu du cuid2 canonical vers le slug du
  remplaçant. Omis (silencieux) si le dispositif cible n'est pas dans le store.

## Recommandations — champs à proposer à AGIR (Détail R2DA)

Pour combler les pertes P1 sans toucher au canonical (qui les porte déjà) :

| Ajout proposé (R2DA) | Source canonical | Priorité |
|---|---|---|
| `urlSource` (ou `urlDispositif`) | `url_source` | **haute** |
| `contactQuestion` ou objet `contact { type, valeur }` | `contact_question` (tous canaux) | **haute** |
| `dureeAide` | `duree.valeur` (+ `duree.type`) | moyenne |
| gestion des `variantes` (liste de surcharges conditionnelles) | `variantes` | moyenne |
| `tailleEntreprise` / `ancienneteActivite` au bon format | `eligibilite.effectif.structure` / `anciennete` | à cadrer |
| `listeRegion` / `listeSecteurActivite` : codes **ou** libellés `{ code, label }` | `RegionNameResolver`, libellés NAF | à confirmer |
| `siren` dans `organisme` / `partenaires` | `operateurs.*.siren` | basse |

Questions de vocabulaire encore ouvertes : voir « Vocabulaire AGIR » plus haut
(chaînes `etatDispositif`/`statut`/`source`/`typeDispositif`/`typeSecteur`, et
noms des clés `urlDetail`/`urlPivot`).

## Projets (index + pivot)

Ajoutés le 2026-10-01 (ADR 0014, feature 008). La projection vit dans
`libs/format-adapters/src/agir/projects/`, les endpoints dans
`apps/cms/src/endpoints/agir/agirProjectEndpoints.ts`. Ils lisent le store
`canonical.canonical_projects`, jamais la collection Payload `Projects`.

> ⚠️ **Format placeholder** : AGIR n'a pas encore spécifié ce qu'il attend pour
> les projets. Les noms de clés (`idProjet`, `etatProjet`, `urlPivot`) et le
> vocabulaire reprennent ceux des dispositifs et sont **à confirmer avec AGIR**.
> Il n'y a pas de « détail R2DA » pour les projets : R2DA décrit un dispositif
> d'aide.

### Routes

| Méthode | Route | Réponse |
|---|---|---|
| GET | `/api/agir/projects` | `ListeProjet[]` : tous les projets stockés |
| GET | `/api/agir/projects/{slug}/pivot` | `AgirProjetPivot` : pivot du projet avec ses deltas d'export |

```sh
# Local (pnpm nx run @tee-backoffice/cms:dev)
curl http://localhost:3000/api/agir/projects
curl http://localhost:3000/api/agir/projects/plan-action-eco-energie/pivot
curl -i http://localhost:3000/api/agir/projects/inconnu/pivot          # 404

# Préprod
BASE=https://preprod.back.mission-transition-ecologique.incubateur.net
curl "$BASE/api/agir/projects"
curl "$BASE/api/agir/projects/plan-action-eco-energie/pivot"
curl "$BASE/api/agir/projects/vehicule-propre/pivot"                   # tombstone : statut remplace, remplace_par voiture-propre
```

Aucune authentification, pas de pagination (91 projets et 6 tombstones au
2026-10-01).

### Règles

- **Pas de filtre d'export** : le store ne contient que des projets publiés ou
  remplacés (`CanonicalSyncPolicy`), donc tout projet stocké est servi, tombstones
  de redirection compris (`etatProjet` / `statut` = `remplace`). Un brouillon du
  CMS est absent de l'index et répond `404` en pivot ; un brouillon enregistré
  par-dessus une version publiée laisse servie la version publiée.
- **`404`** `{ "error": "Projet introuvable" }` si le slug n'est pas dans le
  store, `200` + corps JSON sinon.
- **Les projets remplacés sont des projets du CMS** (depuis le 2026-10-02) :
  le seed et la sync quotidienne les créent (`workflowStatus: 'remplace'`,
  `replacedBy`). Un ancien slug est donc servi dès la fin d'un seed, y compris
  juste après une réinitialisation de la préprod. Un projet `annule` (disparu de
  l'amont sans redirection) n'est plus dans le store : il répond `404`.
- **Slug encodé** dans `urlPivot` (`encodeURIComponent`) : un tombstone peut
  garder un ancien slug non kebab-case (`maintenance-préventive`).
- **Aucun lien mort** (`AgirProjetReferences`) : le pivot interne référence
  dispositifs et projets par identifiant pivot ; l'export les résout en slugs
  et écarte ce que l'API ne sert pas :
  - `dispositifs` : seulement les dispositifs **exportables vers AGIR**
    (`AgirExportPolicy.isExportable`, la règle de `/api/agir/programs`) ; un
    dispositif non publié, `inconnu` ou absent du store est écarté ;
  - `projets_lies.projets` : seulement les projets `valide` ; un projet lié
    remplacé (tombstone) ou absent du store est écarté ;
  - `remplace_par` : slug du projet courant, omis s'il est introuvable ;
  - une liste dont toutes les références sont écartées reste présente, vide.
  Cas passager : un projet créé dans l'admin sous le slug d'un projet amont
  remplace, à sa publication, la ligne amont du store (un slug, une ligne ;
  voir `canonical-project-format.md`, « Règles du store »). Les projets qui
  référençaient l'identifiant amont perdent ce lien dans leur pivot exporté
  jusqu'à la sync quotidienne suivante, qui réécrit le projet depuis l'amont. L'`id` exporté
  étant le slug, AGIR ne voit aucun changement d'identifiant.
- **Image** : `image.url` est rendue absolue (un chemin enraciné
  `/api/media/file/...` est préfixé par la base URL publique). L'image est
  **omise** si le résultat n'est pas une URL `http(s)` absolue (URL relative au
  protocole `//hôte/...`, `mailto:`, base URL inutilisable). `chemin_source`
  n'est jamais exposé.
- **Liste blanche** : `AgirProjetPivotExporter` construit la sortie champ par
  champ puis la revalide par `agirProjetPivotSchema` (`.strict()`) : un champ
  ajouté plus tard au pivot interne ne peut pas fuir.

### Vocabulaire (placeholder, centralisé dans `AgirVocabulary`)

- `source` : comme les dispositifs (`INTERNE → tee`, `AgirSourceMapper`).
- `etatProjet` (index) et `statut` (pivot), `AgirVocabulary.ETAT_PROJET` via
  `AgirProjetEtatMapper` : `valide → en_prod`, `remplace → remplace`. Pas d'état
  « indisponible » : tout projet stocké est publié.
- `theme_principal` et `themes` : vocabulaire wire à 7 valeurs des dispositifs
  (`AgirThemeMapper`, famille environnement repliée sur `environnement`, sans
  doublon dans `themes`).

### `ListeProjet` (index)

Type `ListeProjet` (`agir-projet-liste.types.ts`), produit par
`AgirProjetListeExporter`.

| Champ | Source pivot |
|---|---|
| `idProjet` | `slug` |
| `titre` | `titre` |
| `source` | `AgirSourceMapper(source)` |
| `etatProjet` | `AgirProjetEtatMapper(statut_projet)` |
| `dateDerniereModification` | `date_mise_a_jour` |
| `urlPivot` | `{baseUrl}/api/agir/projects/{slug encodé}/pivot` |

```json
{
  "idProjet": "plan-action-eco-energie",
  "titre": "Mettre en place un plan d’action éco-énergie",
  "source": "tee",
  "etatProjet": "en_prod",
  "dateDerniereModification": "2026-03-19T17:00:00+01:00",
  "urlPivot": "https://preprod.back.mission-transition-ecologique.incubateur.net/api/agir/projects/plan-action-eco-energie/pivot"
}
```

### `AgirProjetPivot` (pivot)

= pivot interne du projet (`docs/context/canonical-project-format.md`) + deltas
d'export. Type inféré de `agirProjetPivotSchema` (`agir-projet-pivot.schema.ts`).

| Champ exporté | Type | Delta par rapport au pivot interne |
|---|---|---|
| `id` | slug (ancien slug toléré si `statut = remplace`) | `slug`, jamais le cuid2 |
| `source` | `tee` / `ademe` / `schema` | minuscules (`AgirSourceMapper`) |
| `date_mise_a_jour` | date-heure ISO | aucun |
| `statut` | `en_prod` \| `remplace` | remplace `statut_projet` |
| `remplace_par` | slug | cuid2 résolu en slug du projet courant |
| `titre`, `nom_court`, `description_courte` | chaîne | aucun |
| `image` | `{ url }` | URL `http(s)` absolue, sans `chemin_source` |
| `description_longue`, `description_complementaire` | `{ titre?, contenu }` | aucun |
| `theme_principal`, `themes` | thème AGIR | vocabulaire wire (`AgirThemeMapper`) |
| `secteurs` | code NAF[] | aucun |
| `priorite` | `{ defaut?, mise_en_avant?, par_secteur? }` | aucun |
| `dispositifs` | slug[] | cuid2 résolus en slugs, dispositifs non exportables écartés |
| `projets_lies` | `{ titre?, description?, projets: slug[] }` | cuid2 résolus en slugs, projets remplacés écartés |
| `faq` | `{ titre?, questions[{ question, reponse }] }` | aucun |
| `seo` | `{ titre?, description? }` | aucun |

`remplace_par` et `dispositifs[]` acceptent un **slug hérité** (non kebab-case) :
ils peuvent désigner un tombstone, qui garde son ancien slug.
`projets_lies.projets[]` reste en kebab-case strict : seuls des projets `valide`
y figurent.

Exemple abrégé, d'après le projet complet des fixtures (slugs de dispositifs fictifs) :

```json
{
  "id": "plan-action-eco-energie",
  "source": "tee",
  "date_mise_a_jour": "2026-03-19T17:00:00+01:00",
  "statut": "en_prod",
  "titre": "Mettre en place un plan d’action éco-énergie",
  "nom_court": "Plan éco-énergie",
  "description_courte": "Réduire durablement vos consommations d’énergie.",
  "image": { "url": "https://cdn.example.org/media/plan-eco-energie.webp" },
  "description_longue": { "titre": "Pourquoi agir ?", "contenu": "Un plan d’action structure vos **économies d’énergie**." },
  "theme_principal": "energie",
  "themes": ["energie", "batiment"],
  "secteurs": ["C", "I"],
  "priorite": { "defaut": 3, "mise_en_avant": 1, "par_secteur": [{ "code_naf": "C", "priorite": 1 }] },
  "dispositifs": ["slug-du-dispositif-1", "slug-du-dispositif-2"],
  "projets_lies": { "titre": "Projets complémentaires", "projets": ["isolation-thermique"] },
  "faq": { "titre": "Questions fréquentes", "questions": [{ "question": "Par où commencer ?", "reponse": "Par un **diagnostic** de vos consommations." }] },
  "seo": { "titre": "Plan d’action éco-énergie" }
}
```

Tombstone de redirection :

```json
{
  "id": "vehicule-propre",
  "statut": "remplace",
  "remplace_par": "voiture-propre",
  "...": "le reste est le contenu du projet courant"
}
```

### Questions à poser à AGIR pour les projets

- Noms de clés de l'index (`idProjet`, `etatProjet`, `urlPivot`) et valeurs de
  `statut`.
- Références par slug : est-ce suffisant, ou faut-il un identifiant stable
  indépendant d'un slug renommable (même question que pour les dispositifs) ?
- `secteurs` et `priorite.par_secteur[].code_naf` : codes NAF bruts, sans
  libellé.
- Faut-il exposer les tombstones dans l'index, ou seulement en pivot ?

## Tests

`libs/format-adapters/src/agir/*.spec.ts` (golden fixtures `valid-minimal` /
`valid-full` de `__fixtures__/canonical-programs.ts`, + variantes
`indisponible`/`archived`/`draft` pour les filtres). Les endpoints ne portent pas
de logique testable : la projection est couverte par la lib.

Projets : `libs/format-adapters/src/agir/projects/*.spec.ts` (fixtures
`minimalProject` / `fullProject` / `replacedProject` de
`__fixtures__/canonical-projects.ts`) et, côté CMS,
`apps/cms/tests/int/agir-projects.int.spec.ts` (handlers appelés directement
avec `createLocalReq`, sans serveur HTTP : index des projets publiés, brouillon
absent, slugs des dispositifs et projets liés dans le pivot, 404).

Disponibilité : les endpoints ouvrent le store à la première requête. Si cette
ouverture échoue (base momentanément injoignable), la requête répond `500` et
la suivante réessaie (`RetryableMemo`) : l'échec n'est plus gardé en mémoire
jusqu'au redémarrage du conteneur. Vaut pour les routes des dispositifs comme
pour celles des projets.
