# ADR 0007 — Format pivot interne et paquet `@tee-backoffice/canonical`

**Date :** 2026-06-15
**Statut :** Accepté
**Décideurs :** Thibaut (data), Yohann (front)

---

## Contexte

Le CMS (Payload) est **éditorialisé** : il est façonné pour la saisie par des opérateurs (champs montant/durée conditionnels par type d'aide, tranches d'effectif, relations opérateurs, statut de workflow, champs conditionnels). Aucun format cible ne veut cette forme brute : tous veulent la version **normalisée** (montant unifié, intervalles, SIREN, codes COG/NAF…).

Plusieurs cibles existent ou arrivent : le format d'échange **AGIR**, le **schéma de données** national (« dispositif-aide ») et ses extensions, demain peut-être d'autres opérateurs. Toutes partagent une **normalisation lourde et commune**.

La règle de décision (DTO directs vs format pivot) tranche donc en faveur d'un **pivot** : ≥ 2 cibles partageant une normalisation non triviale. Le pivot fait la normalisation **une fois** au lieu de N fois, et **absorbe en aval** les divergences propres à chaque format — ce qui **protège l'interface du CMS** de toute pollution par des besoins spécifiques à un consommateur.

> **Vocabulaire** : « pivot » est le mot d'équipe. Techniquement, c'est notre **Canonical Data Model** (cf. *Enterprise Integration Patterns*) : un format interne, normalisé, **non publié**, par lequel transitent tous les formats source/cible. D'où le nom du paquet : `canonical`.

## Décision

### 1. Un paquet dédié `libs/canonical`

Création de la première lib du workspace : `@tee-backoffice/canonical` (générée via `@nx/js:library`, compilateur `tsc`, sans dépendance framework). Elle ne contient que du TypeScript pur et des schémas **zod**.

### 2. Zod comme source unique de vérité

Les schémas zod sont **autoritaires** ; les types TypeScript en sont **inférés** (`z.infer`). On ne maintient jamais un type et un schéma en parallèle (risque de dérive).

### 3. Clés du format = format wire à l'identique

Les clés des types reflètent **1:1** le format d'échange : **français, `snake_case`, sans accent ni apostrophe** (`date_cloture`, `types_aides`). C'est une **exception assumée** à la règle « code en anglais » du dépôt, limitée aux clés de contrat de données. Les noms de classes, méthodes et variables restent en anglais. Bénéfice : **zéro mapping** entre le type et le JSON.

### 4. Canonical = sur-ensemble permissif

Le périmètre actuel se limite **au format canonical** (pas encore de projections AGIR / schéma, pas de DTO). Les contraintes spécifiques à une cible (`siren`/`nom_normalise` requis à l'export schéma, `promesse`/`contact_question` requis pour TEE…) sont **optionnelles** au niveau canonical et seront portées plus tard par chaque **projection**. Un dispositif `en_creation` doit pouvoir exister sans son éligibilité complète.

### 5. Règles inter-champs « au plus près »

- Les règles purement locales (qui ne voient qu'un seul objet) sont exprimées dans le schéma de cet objet : `contact_question` est une **union discriminée** (`email`/`url` → valeur requise et validée ; `ADEME`/`CE` → pas de valeur).
- Les deux règles qui touchent des champs frères de premier niveau sont des `superRefine` appliqués au schéma racine, **mais leur logique vit dans le module du champ** (`fields/aide.schema.ts`) :
  - `duree` requise si `types_aides` contient `etude` ou `formation` ;
  - `remplace_par` obligatoire si `statut === 'remplace'`.

### 6. Primitifs brandés

Les identifiants métier sont des types nominaux (zod `.brand()`) : `Cuid2`, `Slug`, `Siren`, `CogCode` (+ `RegionCogCode`, restreint au niveau région pour les conditions de variante), `NafCode`. Un `Siren` n'est pas assignable là où un `CogCode` est attendu. Le brand est produit **par le parsing** — les consommateurs obtiennent des valeurs brandées en sortie du validateur, ils ne les construisent pas à la main.

### 7. Clés ouvertes préservées

`autres_donnees` (section 6) et `variante.autres_champs` acceptent des clés libres (`.passthrough()` / `z.record`). Les clés inconnues **survivent** à la validation (round-trip sans perte). Les clés inconnues de **premier niveau** sont au contraire **supprimées** (objet strict).

### 8. Éligibilité — forme « refacto »

Abandon des deux blocs parallèles (`eligibilite_textes` + `eligibilite`) au profit d'un **unique objet `eligibilite`, un sous-objet par critère**, chacun portant `texte` (version rédigée) et, quand elle existe, `structure` (source de vérité pour le calcul) :

| Critère | `texte` | `structure` |
|---|---|---|
| `effectif` | ✔ | `{ intervalles: Intervalle[] }` |
| `categorie_legale` | ✔ | `{ microentrepreneur_exclu: boolean }` |
| `secteur_activite` | ✔ | `{ inclusions: NafCode[], exclusions?: NafCode[] }` |
| `secteur_geographique` | ✔ | `{ inclusions: CogCode[], exclusions?: CogCode[] }` |
| `anciennete` | ✔ | — |
| `autres_criteres` | ✔ | — |

L'exclusion micro-entrepreneur vit dans `categorie_legale` (et non dans `effectif`).

### 9. API publique

- `canonicalProgramSchema` — schéma racine zod.
- `CanonicalProgramData` — type des données **validées** en sortie (`z.infer`, brandé).
- `CanonicalProgramInput` — type **à produire** par les DTO/ETL en amont (`z.input`, chaînes simples, défauts optionnels).
- `CanonicalProgram` — value object immuable encapsulant des données **validées** (construction gardée, getters/helpers métier).
- `CanonicalProgramValidator` — point d'entrée de validation : `validate(unknown)` (non bloquant, renvoie le programme ou les `ZodIssue[]`) et `parse(unknown)` (lève `ZodError`).

## Conséquences

- Le format évoluera (les formats cibles ne sont pas figés) : les **golden fixtures** et les tests épinglent le contrat et signalent précisément ce qui casse lors d'un changement.
- Les couches DTO/ETL (CMS → pivot par le front ; pivot → AGIR ; schéma ↔ pivot ; cron Grist) à venir s'appuient toutes sur **ce type et ce validateur** comme contrat partagé.
- À terme, l'objectif est de **rapprocher le pivot du schéma de données** au fur et à mesure de sa maturation, jusqu'à ce qu'il ne reste que « schéma + extensions + quelques champs à usage unique ».

## Décisions ouvertes / TODO

- `source` : valeur `SCHEMA` (données importées via le schéma de données) — libellé à confirmer.
- `statut` : 7 valeurs initiales (`en_creation`, `en_reecriture`, `pret_prod`, `actif`, `temporairement_indisponible`, `archive`, `remplace`) — à compléter ultérieurement.
- `nafCodeSchema` : regex volontairement permissive — à resserrer quand la granularité NAF retenue se précise.
- `themes` : V0 = taxonomie interne en libellés français — arbitrage thèmes ADEME / schéma à venir.

## Structure du paquet

```
libs/canonical/src/
  index.ts                                   barrel (API publique)
  shared/
    primitives.ts                            Cuid2, Slug, dates ISO, Siren, CogCode, NafCode, Url, Intervalle…
    operateur.schema.ts                      Operateur, Operateurs
  canonical-program/
    enums.ts                                 source, statut, types_aides, themes, contact_question type
    canonical-program.schema.ts              schéma racine (merge + superRefine)
    canonical-program.types.ts               CanonicalProgramData (z.infer)
    CanonicalProgram.ts                      value object
    CanonicalProgramValidator.ts             validateur
    fields/                                  identite, contenu, aide (+ refines), eligibilite
    variants/                                variante (conditions + modifications + autres_champs)
    additional-data/                         autres_donnees (clés connues + ouvertes)
  __fixtures__/                              valid-minimal, valid-full
```
