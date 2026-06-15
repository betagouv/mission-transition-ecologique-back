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
| `meta` | `{ titre, description }` | — |

### 3. Faits structurés

**Cycle de vie** : `statut` (✔, enum 7 valeurs : `en_creation`, `en_reecriture`, `pret_prod`, `actif`, `temporairement_indisponible`, `archive`, `remplace`), `date_ouverture` (date ISO), `date_cloture` (date/date-heure ISO), `remplace_par` (`Cuid2`, **requis si `statut = remplace`**).

**Nature** : `types_aides` (✔, array ≥ 1 d'enum : `etude`, `formation`, `financement`, `pret`, `avantage_fiscal`, `assistance`, `information`), `montant` (string), `duree` (string, **requise si `types_aides` contient `etude`/`formation`**), `activable_en_autonomie` (boolean, défaut `false`).

**Acteurs & contact** :
- `operateurs` (✔) : `{ contact: Operateur, autres?: Operateur[] }`.
  - `Operateur` : `nom` (✔), `nom_normalise` (—, requis export schéma), `siren` (`Siren`, —, requis export schéma).
- `contact_question` : union discriminée — `{ type: 'ADEME' | 'CE' }` (sans valeur) | `{ type: 'email', valeur: email }` | `{ type: 'url', valeur: url }`.
- `url_source` (URL).
- `etapes_activation` : array 1–6 de `{ description (Markdown, ✔), liens?: ( { texte, url } | { formulaire: true } )[] }`.

### 4. Éligibilité & ciblage

`eligibilite` (objet optionnel) — **un sous-objet par critère**, chacun `{ texte?, structure? }` :

| Critère | `texte` | `structure` |
|---|---|---|
| `effectif` | `string[]` | `{ intervalles: { min?, max? }[] }` |
| `categorie_legale` | `string[]` | `{ microentrepreneur_exclu: boolean }` |
| `secteur_activite` | `string[]` | `{ inclusions: NafCode[], exclusions?: NafCode[] }` |
| `secteur_geographique` | `string[]` | `{ inclusions: CogCode[], exclusions?: CogCode[] }` |
| `anciennete` | `string[]` | — |
| `autres_criteres` | `string[]` | — |

Sémantique : exclusions prioritaires sur inclusions. Codes COG préfixés (`PAYS-`, `REG-`, `DEP-`, `COM-`, `EPCI-`).

`themes` : array ≥ 1 d'enum (V0, libellés français) : `batiment`, `mobilite`, `dechets`, `eau`, `energie`, `rh`, `analyses`, `ecoconception`, `biodiversite`.

### 5. Variantes

`variantes` : array de `{ conditions, modifications, autres_champs? }`.
- `conditions` : `{ effectif?: { min?, max? }, regions?: RegionCogCode[] }` — codes COG **niveau région** (`REG-…`) ; au moins une condition requise (ET entre `effectif` et `regions`, OU entre régions).
- `modifications` : sous-ensemble (partiel, **au moins une clé**) de `{ montant, duree, url_source, operateurs, eligibilite }`.
- `autres_champs` : clés libres (`Record<string, unknown>`), préservées.

### 6. Autres données

`autres_donnees` : `{ ademe_id_dsp? }` **+ clés libres préservées** (`.passthrough()`).
