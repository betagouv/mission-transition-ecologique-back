# Convention de codes géographiques (COG)

> Convention de référencement des zones géographiques, fondée sur le **Code
> Officiel Géographique (COG)** de l'INSEE. Vocation : être partagée par
> plusieurs équipes / projets pour que tout le monde encode les territoires de
> la même façon.

## 1. Principe

Le code géographique seul **n'est pas une clé** : `53` désigne *à la fois* la
région Bretagne **et** le département Mayenne. La vraie clé est le **couple
`(niveau, code)`** — c'est exactement ainsi que l'INSEE (un fichier par niveau)
et l'API `geo.api.gouv.fr` (un endpoint par niveau) organisent les données.

On sérialise ce couple en une chaîne **`PREFIXE-code`** où le préfixe est le
discriminateur de niveau. Ainsi `REG-53` ≠ `DEP-53`, sans ambiguïté possible.

## 2. Dictionnaire des niveaux (source de vérité)

| Préfixe | Niveau | Format du code | Exemple |
|---|---|---|---|
| `PAYS-` | Pays / territoire étranger | 5 chiffres `99xxx` | `PAYS-99100` (France) |
| `REG-` | Région | 2 chiffres (DROM `01`–`06`) | `REG-53` (Bretagne) |
| `DEP-` | Département | `01`–`95`, Corse `2A`/`2B`, DROM `971`–`976`, CTCD `69M`/`69D` | `DEP-2A` |
| `ARR-` | Arrondissement départemental | département + 1 chiffre | `ARR-382` |
| `CAN-` | Canton | département + 2 chiffres | `CAN-7601` |
| `COM-` | **Commune** | 5 caractères (Corse `2A`/`2B` + 3) | `COM-75056` (Paris) |
| `OM-` | **Collectivité / territoire d'outre-mer** | 3 chiffres hors DROM | `OM-988` (Nouvelle-Calédonie) |
| `EPCI-` | EPCI / collectivité portant un SIREN | SIREN, 9 chiffres | `EPCI-200046977` (Métropole de Lyon) |

⚠️ **Piège n°1** : `COM` = **commune** (5 caractères). Les collectivités
d'outre-mer (3 chiffres) ont leur **propre** niveau `OM` — ne jamais les coder
en `COM`.
⚠️ **Piège n°2** : un code outre-mer à 3 chiffres peut être un **département**
(DROM, `971`–`976`) ou une **collectivité** (`OM`, le reste). Voir §4.

## 3. Regex — garde de forme **souple** (pas une validation d'existence)

```
^(PAYS|REG|DEP|ARR|CAN|COM|OM|EPCI)-[0-9A-Z]+$
```

Construite à partir des préfixes du dictionnaire (jamais redéclarés ailleurs).
Elle vérifie **uniquement la forme** : préfixe connu + corps alphanumérique non
vide. Elle accepte volontairement tous les cas irréguliers (`2A`, `69M`, SIREN,
codes outre-mer…) et **ne dit pas** si le code existe réellement.

> **L'existence se valide contre le référentiel INSEE** (fichiers COG / API),
> keyé par `(niveau, code)`. Une regex ne peut pas faire autorité : le COG est
> irrégulier (lettres, codes réutilisés) et re-millésimé chaque 1ᵉʳ janvier.

## 4. Catalogue des cas particuliers

### 4.1 Corse — lettres dans le code

- Départements : **`2A`** (Corse-du-Sud), **`2B`** (Haute-Corse) → `DEP-2A`, `DEP-2B`.
- Communes : commencent par `2A`/`2B` → `COM-2A004` (Ajaccio), `COM-2B033` (Bastia).
- Région : `94` → `REG-94`. La **Collectivité de Corse** (statut particulier
  depuis 2018) se cible au niveau région `REG-94` ; `2A`/`2B` subsistent comme
  circonscriptions départementales.

### 4.2 Outre-mer — trois familles, ne pas confondre

**a) DROM (Départements et Régions d'Outre-Mer)** — territoire codable **à deux
niveaux** (région *et* département), pour le même espace :

| Territoire | `REG-` | `DEP-` |
|---|---|---|
| Guadeloupe | `REG-01` | `DEP-971` |
| Martinique | `REG-02` | `DEP-972` |
| Guyane | `REG-03` | `DEP-973` |
| La Réunion | `REG-04` | `DEP-974` |
| Mayotte | `REG-06` | `DEP-976` |

> Choisir le niveau qui correspond à l'intention de ciblage ; les deux codes
> désignent la même zone (il n'y a pas de `REG-05`). Communes : 5 chiffres
> `97xxx` → `COM-97411`.

**b) COM (Collectivités d'Outre-Mer, art. 74)** — code 3 chiffres, niveau `OM` :

| Territoire | Code | Encodage |
|---|---|---|
| Saint-Pierre-et-Miquelon | `975` | `OM-975` |
| Saint-Barthélemy | `977` | `OM-977` |
| Saint-Martin | `978` | `OM-978` |
| Wallis-et-Futuna | `986` | `OM-986` |
| Polynésie française | `987` | `OM-987` |

**c) Statut spécial / sui generis** — également niveau `OM` :

| Territoire | Code | Encodage |
|---|---|---|
| Nouvelle-Calédonie (sui generis, Titre XIII) | `988` | `OM-988` |
| Terres australes et antarctiques (TAAF) | `984` | `OM-984` |
| Île de Clipperton | `989` | `OM-989` |

> Règle mémo : **`97x`** partagé entre DROM (`971`–`974`, `976` → `DEP-`) et COM
> (`975`, `977`, `978` → `OM-`) ; **`98x`** toujours `OM-`.

### 4.3 Collectivités à statut particulier

| Cas | Code INSEE | Encodage recommandé | Remarque |
|---|---|---|---|
| Métropole de Lyon | `69M` | `EPCI-200046977` | porte un SIREN ; sinon `DEP-69M` accepté |
| Conseil départemental du Rhône | `69D` | `DEP-69D` | le Rhône « hors Métropole » |
| CTU de Martinique | `972` | `REG-02` ou `DEP-972` | collectivité = région = département |
| CTU de Guyane | `973` | `REG-03` ou `DEP-973` | idem |
| Ville de Paris | `75` / `75056` | `DEP-75` ou `COM-75056` | commune + département fusionnés (2019) |
| Collectivité de Corse | `94` | `REG-94` | voir §4.1 |

### 4.4 Arrondissements municipaux (Paris, Lyon, Marseille)

Subdivisions **sans personnalité juridique**, dans l'espace `COM-` (5 chiffres) :

- Paris : `75101`–`75120` → `COM-75101`
- Lyon : `69381`–`69389` → `COM-69381`
- Marseille : `13201`–`13216` → `COM-13201`

> Pour cibler la ville entière, préférer le code commune (`COM-75056` Paris,
> `COM-69123` Lyon, `COM-13055` Marseille), pas les arrondissements.

### 4.5 Communes déléguées / associées

Issues de fusions (communes nouvelles, loi Marcellin). **Même format que les
communes** (5 chiffres) et **même espace `COM-`** ; elles conservent l'ancien
code INSEE de la commune absorbée (ex. `COM-14051` Beaufour). Le discriminateur
« commune active vs déléguée/associée » n'est **pas** dans le code : c'est une
métadonnée INSEE (`TYPECOM` = `COM`/`COMA`/`COMD`/`ARM`), portée par le
référentiel, **pas** un niveau distinct. Ne nécessite pas de préfixe propre.

### 4.6 Pays et territoires étrangers

5 chiffres commençant par `99` → niveau `PAYS-` : `PAYS-99100` (France),
`PAYS-99109` (Allemagne), `PAYS-99131` (Belgique).

> « France métropolitaine » (hors outre-mer) **n'a pas** de code COG unique :
> l'exprimer par `PAYS-99100` **moins** les codes outre-mer, via les
> inclusions/exclusions du consommateur.

### 4.7 Arrondissements départementaux et cantons

Niveaux intermédiaires entre le département et la commune. Chacun a son **préfixe
dédié** — donc aucun conflit avec les autres niveaux, même si la forme du code
ressemble (un arrondissement à 3 chiffres ≠ un code DROM, le préfixe tranche).

| Niveau | Préfixe | Format du code | Exemple |
|---|---|---|---|
| Arrondissement départemental (sous-préfecture) | `ARR-` | département + 1 chiffre | `ARR-382` |
| Canton | `CAN-` | département + 2 chiffres (découpage 2015) | `CAN-7601` |

> ⚠️ **Arrondissement *départemental* (`ARR-`) ≠ arrondissement *municipal*.**
> Les arrondissements de Paris/Lyon/Marseille (§4.4) sont des codes commune à 5
> chiffres et relèvent de `COM-`. Le `ARR-` ici désigne la circonscription de
> sous-préfecture.

## 5. Hors périmètre

Cette convention couvre **tous les niveaux du COG**. Restent en dehors les
**zonages d'étude** de l'INSEE (bassins de vie, zones d'emploi, aires
d'attraction des villes…) : ce ne sont pas des circonscriptions administratives
du COG, ils relèvent d'une nomenclature distincte. À traiter par une convention
propre si le besoin apparaît.

> Tous les niveaux n'ont pas forcément un consommateur dans chaque projet : un
> projet donné peut n'implémenter qu'un sous-ensemble des préfixes (p. ex. ne
> jamais émettre de `CAN-`). Le dictionnaire reste la référence commune ; chacun
> en utilise la part qui le concerne.

## 6. Tableau récapitulatif

| Cas | Code INSEE | Encodage |
|---|---|---|
| France | `99100` | `PAYS-99100` |
| Pays étranger | `99xxx` | `PAYS-99109` |
| Région métropole | `11`–`94` | `REG-53` |
| Région DROM | `01`–`06` | `REG-01` |
| Département métropole | `01`–`95` | `DEP-35` |
| Département Corse | `2A` / `2B` | `DEP-2A` |
| Département DROM | `971`–`976` | `DEP-971` |
| Métropole de Lyon | `69M` | `EPCI-200046977` |
| Conseil dép. du Rhône | `69D` | `DEP-69D` |
| Arrondissement départemental | dépt + 1 ch. | `ARR-382` |
| Canton | dépt + 2 ch. | `CAN-7601` |
| Commune | `DDCCC` (5 ch.) | `COM-75056` |
| Commune Corse | `2A`/`2B` + 3 | `COM-2A004` |
| Arrondissement municipal | 5 chiffres | `COM-75101` |
| Commune déléguée/associée | 5 chiffres | `COM-14051` |
| Collectivité d'outre-mer | `975`,`977`,`978`,`986`,`987` | `OM-987` |
| Nouvelle-Calédonie / TAAF / Clipperton | `988`/`984`/`989` | `OM-988` |
| EPCI / collectivité à SIREN | SIREN (9 ch.) | `EPCI-200046977` |

## 7. Validation : deux couches

1. **Forme** → la regex du §3 (préfixe connu + corps non vide). Bon marché, sans I/O.
2. **Existence** → contre le référentiel INSEE (fichiers COG / `geo.api.gouv.fr`),
   keyé par `(niveau, code)`. Seule cette couche fait autorité ; elle encode déjà
   `69M`, les CTU, les arrondissements municipaux, etc.

## Sources

- INSEE — [Code officiel géographique (COG)](https://www.insee.fr/fr/information/2560452) ·
  [COG 2026](https://www.insee.fr/fr/information/8740222) ·
  [Codification des collectivités et territoires d'outre-mer](https://www.insee.fr/fr/information/7929495) ·
  [Codification des pays et territoires étrangers](https://www.insee.fr/fr/information/8658873)
- [API Découpage administratif — geo.api.gouv.fr](https://geo.api.gouv.fr/decoupage-administratif)
- INSEE — [Rhône et Métropole de Lyon : deux collectivités à compétences départementales](https://www.insee.fr/fr/statistiques/5425551)
