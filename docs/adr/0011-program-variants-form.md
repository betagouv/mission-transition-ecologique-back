# ADR 0011 : Formulaire des variantes (champs conditionnels) dans Payload

**Date :** 2026-06-30
**Statut :** Accepté
**Décideurs :** Yohann (front)

---

## Contexte

Un dispositif peut adapter certains champs selon le profil de l'entreprise (taille, zone) sans dupliquer le dispositif entier. La source `docs/sources/programs.json` porte cela dans un tableau `champs conditionnels` (7 dispositifs, 29 variantes). Le format pivot `libs/canonical` modélise déjà cela : `varianteSchema` (conditions `{ effectif?, regions? }` + modifications) et `variantes` optionnel sur la racine (voir ADR 0007).

Manquaient : (1) l'UI d'édition dans Payload, et (2) le câblage vers le canonical. La maquette UX (ticket #38) impose une liste de variantes répétable, des conditions cumulées avec un connecteur « ET », un rappel de la valeur générique, et un encart « RÉSUMÉ DE LA RÈGLE ».

## Décision

### Modèle de données (collection `Programs`)

Section `collapsible` « Conditions d'éligibilité variables selon le type de profil » insérée après `additionalInfo`, contenant un array `variants` :

- `variants[]` (label « Variable N ») :
  - `conditions[]` (≥ 1, label « 1. À quelles entreprises s'applique cette variante ? ») :
    - `etConnector` (`ui`) : pastille « ET » entre conditions (positionnel, à partir de la 2ᵉ ligne).
    - `conditionType` (`select` : `companySize` | `geographicArea`).
    - `companySizeValue` (**`json`**, multiselect custom) : voir contournement ci-dessous.
    - `geographicAreaValue` (`relationship` `geographic-areas` `hasMany`).
    - `conditionReminder` (`ui`) : « Valeur générique actuelle : … ».
  - `modifications[]` (≥ 1, label « 2. Que faut-il modifier pour ces entreprises ? ») :
    - `field` (`select`) parmi 7 cibles, voir tableau.
    - `newValue` (`text`, affiché pour les champs texte).
    - `contactOperator` (`relationship` `operators`), `otherOperators` (`relationship` `operators` `hasMany`) : affichés pour les champs opérateur.
    - `modReminder` (`ui`) : valeur générique barrée + « ✓ Remplacera… ».
  - `ruleSummary` (`ui`) : encart « RÉSUMÉ DE LA RÈGLE » (« Si … ET …, alors … passe de … à … »).

Vocabulaire et bornes centralisés dans `apps/cms/src/constants/variantOptions.ts` (`CONDITION_TYPE_OPTIONS`, `MODIFIABLE_FIELD_OPTIONS`, `COMPANY_SIZE_TO_INTERVAL`).

### Champs modifiables → mapping canonical (`varianteModificationsSchema`)

| Option UI (`field`) | Saisie | Cible canonical |
|---|---|---|
| Montant de l'aide (`montant`) | texte | `montant { type, valeur }` |
| Durée (`duree`) | texte | `duree { type, valeur }` |
| Lien du dispositif (`urlSource`) | texte | `url_source` |
| Opérateur de contact (`contactOperateur`) | relation `operators` | `operateurs.contact = { nom }` |
| Autres opérateurs (`autresOperateurs`) | relation `operators` `hasMany` | `operateurs.autres = [{ nom }]` |
| Éligibilité (taille) (`eligibiliteEffectif`) | texte | `eligibilite.effectif.texte[]` |
| Autres critères (`autresCriteres`) | texte | `eligibilite.autres_criteres.texte[]` |

Les champs multi-valeurs s'**accumulent** sur plusieurs lignes de modification. Le mapping vit dans `ProgramCanonicalMapper.mapVariantes` / `mapVarianteConditions` / `mapVarianteModifications`. Conditions : tailles → `effectif { min, max }` (dérivé des buckets), zones → `regions` (codes COG). Logique **ET** entre conditions ; le **OU** sur régions passe par une seule condition multi-zones.

### Composants admin (`apps/cms/src/components/programs/`)

`VariantsSectionLabel`, `VariantsSectionIntro`, `VariantEtConnector`, `VariantConditionReminder`, `VariantModificationReminder`, `VariantRuleSummary`, `CompanySizeMultiSelect`, plus les helpers `variantFieldPath.ts`, `useGeographicAreaNames.ts`, `useOperatorNames.ts`. Le titre de l'accordéon reprend le style natif Payload (comme « Éligibilité ») ; seul le suffixe « - facultatif » est en italique atténué.

## Contournement d'un bug Payload (important)

Un `select hasMany` imbriqué **deux niveaux d'array** (`variants[] → conditions[] → valeur`) casse la clé étrangère de la table de versions (`_v…`) sous SQLite + drafts : Payload insère l'id **texte** de la ligne dans une colonne `parent_id` **integer** (`FOREIGN KEY constraint failed`). Vérifié par reproduction sur DB neuve. Expériences :

- `select hasMany` à **un** niveau d'array : OK.
- `relationship hasMany` à **deux** niveaux : OK (table `_rels` partagée).
- `select hasMany` à **deux** niveaux : **échec**.

Conséquence : `companySizeValue` est stocké en **`json`** (une colonne, pas de sous-table) et édité par le composant `CompanySizeMultiSelect` (construit sur `SelectInput` + `useField`, rendu identique au select natif). Les zones et opérateurs restent des `relationship` (non concernés).

## Limites assumées

- `eligibilite` n'expose que `effectif` (taille) et `autres_criteres` ; `categorie_legale`, `secteur_activite`, `secteur_geographique`, `anciennete` ne sont pas surchargeables (jamais utilisés dans les `champs conditionnels` de la source).
- La valeur générique barrée n'est pas résolue pour `eligibiliteEffectif` / `autresCriteres` (texte dérivé) : le résumé écrit alors « prend la valeur X ».
- Validation « champ requis » conditionnelle non implémentée (typage strict de la signature `validate` de Payload trop coûteux) ; le mapper ignore proprement les valeurs vides et le service canonical ne persiste qu'un canonical valide.

## Seed

`VariantMapper` (`apps/cms/src/scripts/seed/programs/`) traduit les `champs conditionnels` de `docs/sources/programs.json` en `variants` : noms de régions → zones géographiques (résolus par nom), `effectif >=`/`<=` → buckets de taille, opérateurs nommés → relations `operators` (créés par `OperatorImporter`, étendu aux opérateurs de variantes). `pnpm seed` peuple ainsi 29 variantes sur 7 dispositifs.

## Conséquences

- Les 7/7 dispositifs à `champs conditionnels` de la source sont reproductibles, et le seed les crée réellement.
- Le store canonical reçoit les variantes au publish via le hook `syncCanonicalOnPublish` (chemin inchangé).
- Toute future imbrication multi-valeur à deux niveaux d'array doit suivre le contournement (JSON ou relation, jamais `select hasMany`).
