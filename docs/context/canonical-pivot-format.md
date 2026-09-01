# Format pivot (canonical) — référence des champs

Référence consolidée du format **pivot interne** implémenté dans `libs/canonical`
(`@tee-backoffice/canonical`). Pour les décisions de conception, voir
[ADR 0007](../adr/0007-canonical-pivot-format.md).

> Le « pivot » est notre **Canonical Data Model** : format interne, normalisé,
> **non publié**, par lequel transitent tous les formats source/cible
> (AGIR, schéma de données, Grist…).

## Conventions générales

- **Clés** : français, `snake_case`, sans accent ni apostrophe. **Valeurs** textuelles en français accentué normal.
- **Dates** : ISO 8601. Date seule (`2025-12-31`) ou date-heure avec offset (`2026-03-19T17:00:00+01:00`).
- **Champs absents** : un champ optionnel sans valeur est **absent** (pas de `null`, pas de `""`).
- **Markdown** : `description`, `description_longue`, descriptions d'étapes acceptent du Markdown.
- **Validation** : zod est la source de vérité ; le type `CanonicalProgramData` en est inféré. Point d'entrée : `CanonicalProgramValidator`.

## Sections

### 1. Identité

| Champ | Type | Requis | Notes |
|---|---|---|---|
| `id` | `Cuid2` | ✔ | Généré en amont, seulement validé. |
| `slug` | `Slug` (kebab-case) | ✔ | Identifiant lisible unique (URLs). |
| `source` | `ADEME` \| `INTERNE` \| `SCHEMA` | ✔ | Provenance. |
| `date_mise_a_jour` | date-heure ISO | ✔ | Dernière modif réelle du contenu. |

### 2. Contenu éditorial

| Champ | Type | Requis |
|---|---|---|
| `titre` | string | ✔ |
| `promesse` | string ≤ 180 | — |
| `description` | Markdown ≤ 5000 | ✔ |
| `description_longue` | Markdown | — |
| `illustration` | `{ url: Url, alt?: string }` | — |
| `meta` | `{ titre, description }` | — |

`illustration.alt` est optionnel : à défaut, le front dérive un libellé depuis le titre (préoccupation d'affichage, pas une donnée du pivot).

### 3. Faits structurés

**Cycle de vie** : deux axes orthogonaux —
- `statut_edition` (✔, où en est la rédaction) : `inconnu`, `en_creation`, `en_reecriture`, `pret_prod`, `archive`, `abandonne` (abandonné avant publication).
- `statut_dispositif` (✔, validité réelle de l'aide) : `inconnu`, `valide`, `temporairement_indisponible`, `remplace`, `archive`.

`date_ouverture` (date ISO), `date_cloture` (date/date-heure ISO), `remplace_par` (`Cuid2`, **requis si `statut_dispositif = remplace`**).

**Nature** : `types_aides` (✔, array ≥ 1 d'enum — les 8 types du schéma de données interministériel : `assistance`, `avantage_fiscal`, `conseil`, `etude`, `financement`, `formation`, `information`, `pret`), `montant` (objet `{ type, valeur }`), `duree` (objet `{ type, valeur }`, **requise si `types_aides` contient `etude`/`formation`**).

`montant` et `duree` sont **auto-décrits** : `type` porte le libellé d'affichage (qui dépend de la nature de l'aide — « montant du financement », « coût de l'accompagnement », « montant du prêt », « durée du prêt »…) et `valeur` la chaîne affichée. Le libellé voyage avec la donnée : aucun mapping type d'aide → libellé à reconstruire côté front, ce qui évite les conflits quand les 8 types sont repliés sur les catégories de filtrage du front.

**Acteurs & contact** :
- `operateurs` (✔) : `{ contact: Operateur, autres?: Operateur[] }`.
  - `Operateur` : `nom` (✔), `nom_normalise` (—, requis export schéma), `siren` (`Siren`, —, requis export schéma).
- `contact_question` : union discriminée — `{ type: 'conseiller_entreprise' }` (sans valeur) | `{ type: 'email', valeur: email }` | `{ type: 'url', valeur: url }`. Côté source TEE, `"formulaire"` = mise en relation Conseillers-Entreprises → `conseiller_entreprise` (même sémantique que `{ formulaire: true }` dans les liens d'étape).
- `url_source` (URL).
- `etapes_activation` : array 1–6 de `{ description (Markdown, ✔), liens?: ( { texte, url } | { conseiller_entreprise: true } )[] }`.

### 4. Éligibilité & ciblage

`eligibilite` (objet optionnel) — **un sous-objet par critère**, chacun `{ texte?, structure? }` :

| Critère | `texte` | `structure` |
|---|---|---|
| `effectif` | `string[]` | `{ min?, max? }` (au moins une borne) |
| `categorie_legale` | `string[]` | `{ autorise?: (CategorieLegale \| string)[], interdit?: (CategorieLegale \| string)[] }` |
| `secteur_activite` | `string[]` | `{ inclusions: NafCode[], exclusions?: NafCode[] }` |
| `secteur_geographique` | `string[]` | `{ inclusions: CogCode[], exclusions?: CogCode[] }` |
| `anciennete` | `string[]` | — |
| `autres_criteres` | `string[]` | — |

Sémantique : exclusions prioritaires sur inclusions. Codes COG **préfixés par niveau** : tout le monde dans le projet utilise les mêmes préfixes — dictionnaire unique `COG_NIVEAUX` (`libs/canonical/src/shared/cog.ts`), jamais redéfini ailleurs. Le préfixe est le discriminateur : il lève l'ambiguïté entre niveaux (`53` = région Bretagne **ou** département Mayenne), car le code seul n'est pas une clé — c'est le couple `(niveau, code)`, comme dans les fichiers INSEE et geo.api.gouv.fr.

| Préfixe | Niveau | Comment mapper | Exemple |
|---|---|---|---|
| `PAYS-` | Pays / territoire étranger | code INSEE `99xxx` | `PAYS-99100` (France) |
| `REG-` | Région | 2 chiffres (DROM 01–06) | `REG-53` (Bretagne) |
| `DEP-` | Département | métropole `01`–`95`, Corse `2A`/`2B`, DROM `971`–`976`, CTCD `69M`/`69D` | `DEP-2A` |
| `ARR-` | Arrondissement départemental | département + 1 chiffre | `ARR-382` |
| `CAN-` | Canton | département + 2 chiffres | `CAN-7601` |
| `COM-` | **Commune** | code à **5 caractères** | `COM-75056` (Paris) |
| `OM-` | **Collectivité d'outre-mer** | `975`, `977`, `978`, `984`, `986`–`989` | `OM-988` (Nouvelle-Calédonie) |
| `EPCI-` | EPCI / intercommunalité (et collectivités à SIREN) | SIREN 9 chiffres | `EPCI-200046977` (Métropole de Lyon) |

Catalogue complet des cas particuliers (Corse, DROM, COM, statuts particuliers, arrondissements, cantons…) : voir `docs/adr/0007b-COG_CONVENTION.md` (convention partagée). `ARR-` (arrondissement départemental) ≠ arrondissement municipal de Paris/Lyon/Marseille, qui sont des codes commune `COM-`.

⚠️ Ne pas confondre `COM` (commune) et `OM` (outre-mer) — c'est le piège historique. La regex `cogCodeSchema` est une **garde de forme volontairement souple** (préfixe connu + corps alphanumérique) : elle accepte les cas irréguliers (`2A`, `69M`, SIREN…) et ne valide **pas** l'existence réelle. L'existence se vérifie contre le référentiel INSEE / `GeographicAreas`, keyé par `(niveau, code)` (hors paquet canonical).

`categorie_legale.structure` porte deux listes optionnelles `autorise` / `interdit`. Chaque entrée est soit une valeur du vocabulaire fermé `CategorieLegale` (V0 : `micro_entrepreneur` — les autres valeurs seront ajoutées plus tard), soit un texte libre.

`themes` : array ≥ 1 d'enum (V0, libellés français) : `batiment`, `mobilite`, `dechets`, `eau`, `energie`, `rh`, `environnemental`, `ecoconception`, `biodiversite`.

### 5. Variantes

`variantes` : array de `{ conditions, modifications, autres_champs? }`.
- `conditions` : `{ effectif?: { min?, max? }, regions?: CogCode[] }` — `regions` accepte **tout niveau COG** (région, département, collectivité d'outre-mer, commune…), pas seulement `REG-…` ; au moins une condition requise (ET entre `effectif` et `regions`, OU entre les zones).
- `modifications` : sous-ensemble (partiel, **au moins une clé**) de `{ montant, duree, url_source, operateurs, eligibilite }`.
- `autres_champs` : clés libres (`Record<string, unknown>`), préservées.

### 6. Autres données

`autres_donnees` : `{ ademe_id_dsp? }` **+ clés libres préservées** (`.passthrough()`).
