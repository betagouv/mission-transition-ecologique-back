# Export AGIR — triple format (index + détail R2DA + pivot ADEME)

> Contexte de la tansmission de données vers AGIR. 
> Le convertisseur vit dans `libs/format-adapters/src/agir/`;
> les endpoints publics dans `apps/cms/src/endpoints/agir/`. 
> Source des données = **store canonical**
> (`CanonicalProgramRepository`), jamais les collections Payload.

## Endpoints (publics, lecture seule, JSON)

| Méthode | Route | Réponse | Source |
|---|---|---|---|
| GET | `/api/agir/programs` | `ListeDispositif[]` (index, 2 URLs/entrée) | `repository.findAll()` |
| GET | `/api/agir/programs/{slug}/detail` | `DetailDispositif` (proposition 1, R2DA) | `repository.findBySlug(slug)` |
| GET | `/api/agir/programs/{slug}/pivot` | `AdemePivot` (proposition 2) | `repository.findBySlug(slug)` |

Règles communes :

- N'exposer que les dispositifs **publiés** (`statut_edition === 'pret_prod'`,
  `ExportPolicy.isPublished`) **et** dont `statut_dispositif ∈ { valide,
  temporairement_indisponible }` (`AgirEtatMapper.isExportable`). Les
  `archive`/`remplace`/`abandonne`/`inconnu` sont **absents** de l'index et
  renvoient `404` en détail/pivot. Le filtre combiné = `AgirExportPolicy.isExportable`.
- `404` si slug inconnu ou non exportable, `200` + corps JSON sinon.
- Pas de pagination au MVP (volume faible).

## Vocabulaire AGIR — ⚠️ choix à confirmer

Centralisé dans `AgirVocabulary` (un seul fichier pour ajuster). Valeurs
**placeholder** tant qu'AGIR n'a pas tranché :

- `source` : `INTERNE → tee`, `ADEME → ademe`, `SCHEMA → schema` (`AgirSourceMapper`).
- `etatDispositif` (index + détail) : `valide → inProd`,
  `temporairement_indisponible → temporairement indisponible` (`AgirEtatMapper`).
- `statut` (pivot ADEME) : `valide → actif`,
  `temporairement_indisponible → indisponible` (`AgirStatutMapper`).
- `typeDispositif` (détail) : libellés d'affichage des `types_aides` joints par
  ` | ` (`AgirTypeDispositifMapper`). Format unique/liste/enum à confirmer.
- `typeSecteur` (détail) : déduit du niveau COG (`PAYS → National`,
  `REG → Régional`, `DEP → Départemental`…), `Inconnu` si mixte/inconnu.
- Noms de clés `urlDetail` / `urlPivot` de l'index : à confirmer avec AGIR.

## 1. `ListeDispositif` (index)

Schéma cible `ListeDispositif TEE R2DA v1.0` + 2 URLs ajoutées.

| Champ | Source canonical |
|---|---|
| `idDispositif` | `autres_donnees.ademe_id_dsp ?? slug` |
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
4. `statut` ← `AgirStatutMapper` (`actif`/`indisponible`) ; `statut_edition`,
   `statut_dispositif`, `remplace_par` **supprimés**.
5. `montant` / `duree` : **objet `{ type, valeur }`** inchangé.
6. `contact_question` : types distincts conservés (`ADEME`/`conseiller_entreprise`/
   `email`/`url`). Pas de type `formulaire` dans le canonical.
7. `themes` : français inchangés.
8. `eligibilite`, `variantes`, `operateurs`, `etapes_activation`, contenu
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
| `secteur_geographique.inclusions` | ✅ `listeRegion` | ✅ | codes COG **bruts** (`RegionNameResolver` inutilisé) |
| `secteur_geographique.exclusions` | ❌ | ✅ | perdues en P1 |
| `themes` | ✅ `thematique` (FR) | ✅ (FR) | taxonomie non mappée vers une réf. AGIR/ADEME |
| `variantes` | ❌ | ✅ | **lacune P1** |
| `autres_donnees.ademe_id_dsp` | ✅ `idDispositif` | ✅ (racine) | |
| `autres_donnees` (reste) | ❌ | ❌ | passthrough interne — non exporté **volontairement** |

> En une phrase : le **pivot (P2) est l'export complet** (quasi sans perte), le
> **détail R2DA (P1) est une projection d'affichage avec pertes**. Si AGIR peut
> consommer le pivot, c'est la source de vérité à privilégier ; le détail R2DA
> sert l'UI et accepte les omissions ci-dessous.

## Lacunes du Détail R2DA (proposition 1) — à arbitrer avec AGIR

Toutes les pertes notables sont en P1 (le pivot ne perd rien d'essentiel).

1. **Contact / question (`contact_question`)** — ⚠️ seul le canal `email` est
   exporté (`mailContact`). Les canaux `url` (formulaire en ligne), `ADEME` et
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
   `RegionNameResolver` (codes → noms) existe dans `shared/` mais **n'est pas
   utilisé**. → confirmer si AGIR attend des codes, des libellés, ou des objets
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
- **Taxonomies non mappées** : `themes` (FR interne) et `types_aides` (enum
  interne) sont livrés tels quels, faute de correspondance vers une nomenclature
  ADEME/AGIR (non fournie à ce stade).
- **`remplace_par` retiré** .

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

## Tests

`libs/format-adapters/src/agir/*.spec.ts` (golden fixtures `valid-minimal` /
`valid-full` de `__fixtures__/canonical-programs.ts`, + variantes
`indisponible`/`archived`/`draft` pour les filtres). Les endpoints ne portent pas
de logique testable : la projection est couverte par la lib.
