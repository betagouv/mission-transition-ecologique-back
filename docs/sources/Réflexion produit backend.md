# Réflexion produit backend

[Collaboration R2DA](https://www.notion.so/Collaboration-R2DA-2f86523d57d780edbadfdb05de86dfa1?pvs=21)

Les récents travaux sénatoriaux et du gouvernement mis en oeuvre concernant les aides aux entreprises :

1. Synthèse du rapport sénatorial sur la commission d’enquête aides publiques aux entreprises : [https://www.senat.fr/rap/r24-808-1/r24-808-1-syn.pdf](https://www.senat.fr/rap/r24-808-1/r24-808-1-syn.pdf)
2. Une concertation confiée au Haut Commissariat au Plan et à la stratégie par Lecornu pour la cartographie des aides aux entreprises : [https://www.strategie-plan.gouv.fr/actualites/aides-aux-entreprises-une-concertation-confiee-au-haut-commissariat-la-strategie-et-au](https://www.strategie-plan.gouv.fr/actualites/aides-aux-entreprises-une-concertation-confiee-au-haut-commissariat-la-strategie-et-au)
3. Note SGPE (à garder en interne):

[Referentiel National des Aides (1).pdf](R%C3%A9flexion%20produit%20backend/Referentiel_National_des_Aides_(1).pdf)

Aujourd'hui, il n'existe pas de base de données de l'ensemble des offres publiques. Alors, comment les pouvoirs publics peuvent piloter les [211 milliards d'euros d'aides aux entreprises](https://www.senat.fr/notice-rapport/2024/r24-808-1-notice.html) si nous ne sommes pas en mesure de savoir où elles sont ? Et pour les entreprises, comment accéder à ces offres si celles-ci sont dispersées entre les différents opérateurs publics ?

# 1) Cibles & problèmes rencontrés

Une partie des problèmes utilisateurs a déjà été identifiée au cours du déploiement et du partenariat inter-opérateurs mis en place par la Startup d’Etat *Transition écologique des entreprises*. En revanche, il est nécessaire de valider ces problèmes/cas d’usage et les besoins en terme de fonctionnalités du produit back-end auprès de ses utilisateurs finaux. 

### **🤵🏻‍♀️ Les tutelles étatiques**

*DGE, DINUM, DILA, ANCT, MASA, DGFIP et pour la transition écologique : CGDD, SGPE*

- Il n'existe pas de base de données de l'ensemble des aides publiques (comprenant les aides à la transition écologique)
- Il n’existe pas de suivi exhaustif et transparent des aides et subventions accordées par aide
- Il n’existe pas de pilotage et rationalisation des aides publiques (risque de doublons d’aides poursuivant un même objectif portées par des opérateurs différents)
- Il existe depuis peu une définition et un schéma de données des dispositifs d’aides publiques portée par l’équipe Transition écologique des entreprises ([https://www.data.gouv.fr/datasets/catalogue-des-dispositifs-daides-a-la-transition-ecologique-pour-les-entreprises](https://www.data.gouv.fr/datasets/catalogue-des-dispositifs-daides-a-la-transition-ecologique-pour-les-entreprises))
- Mais, les acteurs publics nationaux et régionaux ne sont soumis à aucune obligation de partager leurs dispositifs d’aide et d’accompagnement.
- Plusieurs plateformes existent et référencent aujourd’hui les milliers d’aides disponibles. Elles travaillent en silos et recréent une base de données dans le but d'y voir plus clair. (exemple : [https://plateforme-aides-etat.finances.gouv.fr/](https://plateforme-aides-etat.finances.gouv.fr/connexion)
- Ce travail est complexe, surtout face à la variabilité des aides.

**Hypothèse :** Créer un outil de pilotage et de rationalisation des aides, avec la possibilité de produire des statistiques qui pourraient être publics.  

A termes, cela pourrait être soutenu par une inscription dans la loi de l’obligation de référencer les aides de chaque opérateur.

**Objectif :** harmonisation des aides, réduction des coûts, transparence, visibilité sur les actions priorisés par le gouvernement et l’impact des investissements.

### 🧑‍💼 Les opérateurs (gestionnaire des aides) publics

*CCI, CMA, Bpifrance, OFB, Banque de France, ANAP, ANACT, Caisse des dépôts, Atout-France, ADEME…*

- Nous pouvons distinguer les opérateurs selon :
    - Les têtes de réseau / les acteurs locaux
    - Les opérateurs qui ont déjà leur système back-end / les opérateurs qui n’en ont pas ⇒ Pas de backend chez certains opérateurs qui mène vers un manque de rationnalisation, et de visibilité ( ex : cci cma ) ⇒ premiers utilisateurs a aller chercher
- Absence de socle commun, travail en silo entre opérateurs, les bases données ne sont pas inter-opérables il existe donc une multitude de données ~~Intégration hétérogène des données d’aides chez chaque opérateur.~~
- Écriture et mises à jour coûteuses, sans accompagnement, peu outillées, sans aide extérieure,
- Difficulté à piloter les aides (usage, impact, articulation avec les projets).
- Difficulté à avoir une visibilité sur la cartographie du réseau complet pour savoir orienter l’entreprise vers le bon interlocuteur.
- **Hypothèse 1** : créer un référentiel commun pour l’écriture des aides permettrait d’améliorer leur qualité et de réduire les coûts de coordination.
- **Hypothèse** 2 : créer un référentiel commun permet aux opérateurs de donner plus de visibilité à leurs dispositifs. (aide à la communication)

### 👨🏽‍💻 Les partenaires data/services numériques

*DINUM, SGPE, TEE, Aides-Agri, Aides-Territoires, Les-Aides, Aides-Entreprises, Atout-France*

- Aujourd’hui, la plupart des dispositifs existants interviennent en bout de chaîne, sans plateforme de pilotage : ils agrègent des aides déjà publiées, avec des formats hétérogènes, une information souvent peu lisible et difficilement comparable. Cette logique de recensement multi-plateformes limite la qualité de la donnée, la capacité de pilotage et la compréhension.
- Données non-exhaustives et hétérogènes
- Données obsolètes (ex. Chèque Vert Grand Est)
- Responsabilité floue
- Multiplication des acteurs et des coûts
- Multiplication des points d’entrée pour les opérateurs, les conseillers et les entreprises

Hypothèse : Mobilisation des fonctionnalités et éléments engagés au sein des différents acteurs dans un objectif d’harmonisation -

Objectif : 1 compte par porteur d’aide, 1 schéma de données, des connexions avec les bases des porteurs d’aide et une harmonisation à terme, 1 remontée du montant des aides accordées, 1 tableau de bord de pilotage pour les administrations centrales
Changer de paradigme et agréger dans un format commun en début de chaine plutôt qu’à la fin, ce qui permet de ne réaliser le travail d’agrégation qu’une seule fois

### 🕵🏻‍♀️ Les conseillers

*CCI, CMA, Bpifrance, DR ADEME*

- Peu outillés, avec des interfaces souvent identiques à celles des entreprises.
- Accès fragmenté à l’information, peu contextualisée.
- Travail chronophage pour consolider des PDF de synthèse des aides disponibles pour les entreprises.
- Difficulté à obtenir une représentation fiable **et à jour** des aides proposées.
- Difficulté à qualifier rapidement l’éligibilité et à orienter les entreprises.
- **Hypothèse** : une plateforme unique, alimentée par les opérateurs eux-mêmes, pourrait devenir l’outil de référence des conseillers.
- À noter : dans certains cas (notamment pour les aides régionales), un même acteur peut cumuler les rôles de conseiller et de gestionnaire d’aide.

### 🧑‍🔧 Les entreprises

*MEDEF, CPME, U2P, METI…*

- La **multiplicité** **des dispositifs publics**, dispersés sur les sites des différents opérateurs, au niveau national et régional, qui ne permet pas aux entreprises d’avoir une vision globale de l’offre.
- Une expérience de recherche sur des catalogues d’aides existantes jugée **fastidieuse et non ciblée. P**as de filtre en fonction des critères d’éligibilité, pas de lien direct avec des projets concrets, titre des aides non explicite, étapes pour en bénéficier difficiles…)
- Un **déchiffrage complexe** des critères d'éligibilité de chaque offre qui rend difficile à l’accès aux dispositifs
- Des TPE et PME qui n’ont **pas les compétences en interne** ou le temps dédié.

---

## 2) Solution envisagée

La Startup d’État explore la conception d’un produit backend permettant d’améliorer **la qualité, la lisibilité et le pilotage des aides publiques à destination des entreprises.** 

La transition écologique constitue le terrain pilote, avec l’ADEME comme opérateur initial, dans **une vision à terme multi-opérateurs et multi-sectorielle.** L’objectif est de capitaliser sur les apprentissages, les fonctionnalités déjà existantes (intégration automatique des données de l’ADEME, envoi de mails automatiques auprès des porteurs d’aides…) et le travail multi-opérateurs réalisés par Transition écologique des entreprises.

Les cibles sont les tutelles et l**es opérateurs en charge du pilotage ainsi que les conseillers** en charge de créer, d’écrire, de mettre à jour, de diffuser et d’orienter les entreprises vers les aides publiques adaptées.

~~Le parti pris de la solution est d’intervenir plus tôt dans le cycle de vie des aides, au moment où les opérateurs les conçoivent et les rédigent.~~ 

Pour y parvenir, la solution propose de mettre en place un référentiel exhaustif des aides existantes et un cadre commun d’écriture (schéma de données, règles éditoriales, critères d’éligibilité structurés) dès la conception d’une nouvelle aide. 

Cette solution a pour objectif de :

- Offrir un outil de pilotage efficace permettant d’avoir une vue des aides proposées aux entreprises, une rationalisation efficiente, et une meilleure évaluation des aides distribuées,
- Améliorer la qualité des aides à la source pour faciliter l’accès et la lisibilité des aides auprès des entreprises,
- Faciliter leur mise à jour et de rendre possible leur diffusion cohérente via une API de référence,
- Faciliter le travail des conseillers sur le terrain.

Faut-il mettre ici un point : ce dont on a besoin pour y arriver ? 

---

## 3) Les fonctionnalités du produit back-end (à étudier) :

**Création d’un outil de gestion des aides inter-opérateurs**

- Gestion des dispositifs des aides multi-opérateur suivant le schéma de données porté par TEE
- Gouvernance et conventions (ADEME – multi-opérateurs)
- Responsabilisation des acteurs publics sur les offres à destinations des entreprises

**Création et gestion des projets** 

- Regroupement des offres par enjeux de la cible (entreprise)
- Gestion des responsabilité sur ces projets mettant en visibilité les offres
    - Rationalisation des offres
    - Expertise vulgariser des contenus pour présentation des offres

**Agrégation & schématisation de données**

- **Édito des aides** : écriture vulgarisée pour les entreprises homogène de l’ensemble des aides
- **Découpage par critères d’éligibilité**
- **Activation des aides** : modalités de contact (mail, conseiller entreprise, lien externe)
- ***Agrégation** : des aides avec les dispositifs déjà existant (aides financières R2DA)*
- **Structuration des projets sectoriels** ( aides = projets + ressources + témoignages + FAQ).

**Interface opérateurs**

- **Un back-office** accessible à l’ensemble des opérateurs (nationaux, régionaux, territoriaux)
    - ajout d’une aide
    - mise à jour
- Définition des responsabilités dans la complétude et la qualité de la données
    - ADEME : Entre R2DA et ces aides multi-opérateurs
- **Une plateforme front** servant de représentation commune pour les opérateurs et les conseillers.
- Dashboard à destination des tutelles pour prioriser projets et aides. (Pilotage par l’impact)

**Un outil de pilotage**

- Suivi et mesure d’impact sur ces offres pour les opérateurs/tutelles
- Articuler ces résultats sur le travail du prévisionnel et de la rationalisation des offres

---

## 4) Impact recherché (estimé au regard de l’investigation)

- Améliorer la compréhension et l’appropriation des aides par les entreprises
    - Indicateur qualitatif
- Favoriser la mutualisation et la cohérence inter-opérateurs
    - Indicateur : Nombre d’entité publique
- Permettre un pilotage par l’impact pour les tutelles
    - Indicateur : Tutelles et opérateurs embarqués sur l’enjeu de pilotage

🎉 **Indicateur d’impact principal** : nombre de requêtes API (usage de la donnée par des partenaires et services tiers).

---

## 5) Méthode d’investigation

- Entretiens individuels avec des tutelles, opérateurs et des conseillers pour :
    - identifier les problèmes réels,
    - tester les hypothèses de solution
- Cartographie de l’écosystème (opérateurs, plateformes existantes, partenaires) et identification des synergies possibles.
- Organisation d’ateliers inter-opérateurs pour travailler sur le socle commun.
- Déploiement d’un ou plusieurs POC

---

## POC envisagés

### POC 1 – Usage de la transition écologique

- Inscription dans un temps long, avec des briques déjà existantes.
- Nécessité d’un alignement fort avec la DETSI.
- ⚠️ Absence de légitimité claire d’un acteur unique pour porter ce commun au niveau national.

### POC 2 – Gestion centralisée et inter-opérateurs toutes thématiques confondues

- Gestion centralisée des aides tout en conservant l’agilité.
- Éviter une internalisation complète à l’ADEME afin de préserver la légitimité multi-opérateurs.
- Acteurs à explorer : DILA, DGE.

---

## Points de vigilance

- Risque de doublon avec les autres plateformes sans clarification forte de la proposition de valeur ([les-aides.fr](http://les-aides.fr), aides-territoires, [aides-entreprises.fr](http://aides-entreprises.fr)…)
    - L’idée de notre solution back, c’est de faire du commun plus tôt, dès l’écriture des opérateurs, versus juste du recensement dans des catalogues.
- Si intégré à l’ADEME = dépendance excessive à un opérateur unique.
- Qualité de l’ADEME en tant que sponsor (produit transverse inter-administration)
- Accès et fiabilité de la donnée locale.
- Stratégie d’embarquement des opérateurs sur le long terme.
- Périmètre de la TE trop restrictif
- Vérifier si la notion de projet est pertinente en dehors de la TE ?
- **Quel portage ??**
- Qu’est ce que qui intéresse vraiment la DETSI ? Comment lier ce projet à celui de notre porteur actuel, l’ADEME.

---

![Capture d’écran 2026-01-29 à 15.17.25.png](R%C3%A9flexion%20produit%20backend/Capture_decran_2026-01-29_a_15.17.25.png)

Positionnement vis à vis de les [aides.fr](http://aides.fr) ? 

- La mise en place d’un schéma commun : catalogue ouvert pour toutes les plateformes dont [les-aides.fr](http://les-aides.fr) ⇒ notre schéma est légitime
- compte utilisateur pour que les opérateurs administre et suit les aides ⇒ on peut devenir le backend de les-aides.fr
- interface pour que les décideurs aient accès à une vision globale
- aides-entreprises à la manière de aides-territoires

---

## 4 sujets à investiguer :

1. **Les tutelles** ont-elles besoin d’une aide au pilotage ? sont-ils prêts à financer ? Quels sont leurs besoins ?
    1. Hypothèse : Pas de suivi, de listing exhaustif des aides pour piloter/rationaliser
    2. Qui : DGE (Anne), CGDD (François), des préfectures ? (Provence-Alpes-Côte-d’Azur et Hauts-de-France)
2. **Les têtes de réseau** ont-elles besoin d’une cartographie du réseau ? 
    1. Hypothèse : Connaitre et faire connaitre les spécifiés locales pour un meilleur aiguillage
    2. Qui : DR ADEME (Grand Est et Corse), CCI France (Valérie), CMA France (Maëlle)
3. **Les opérateurs** ont-ils besoin d’un outil d’aide à l’écriture des dispositifs ? Et/ou d’une aide à la visibilité de leur dispositif ? 
    1. Hypothèse 1 : créer un référentiel commun pour l’écriture des aides permettrait d’aider les opérateurs dans leur documentation et leur diffusion des dispositifs auprès de leurs cibles.
    2. Qui : Une région (Hauts-de-France/région Provence-Alpes-Côte d’Azur : Charles) ? ALEC (ALOEN en Bretagne), Conseiller ADEME sur les aides-européennes, des collectivités ? Grenoble qui nous avait contacté ?
4. Qui rencontrer ? Les services numériques ? la Dinum ? (organisation / gestion de la donnée en tant que telle)
    1. Hypothèse : Mieux gérer les données, les standardiser et les agréger de manière qualitative et automatisée
    2. qui : Pôle data de la DINUM ? 

4 sujets à garder en tête : 

- gestion de la donnée
- aide au pilotage
- cartographie du réseau
- aide à l’écriture

## 6. Etapes de validation de l’investigation du produit et du budget

🟢 *Déjà au courant et soutien fort*

🟠 *En cours*

🔴 *Plutôt pas un soutien a priori*

Go/no go à aller chercher pour les financements (alliés et ceux qui ne nous soutiennent pas forcément etc.) : 

ADEME - CGDD - Bpifrance - 🟢 DGE (organiser un point dédié) en priorité avant avril

SGPE en priorité avant avril

Organiser un comité d’investissement pour go/no go global (idéalement on a déjà parler aux parties)

En parallèle : voir avec Dinum / pousser côté 🟢 Dila (peut s’entendre pour 2027 à relancer) ? DGTrésor ? 

Ministères en charge des affaires sociales, des
territoires, de la décentralisation ?

🟠 HCSP (soutien cabinet) 

Les prochaines étapes et ce pourquoi on a besoin d’une équipe : 

- Valider les hypothèses
- Faire un POC/MVP sur un outil de gestion et suivi des aides avec un focus TE pour commencer

Ce qu’il manque sur la TE et ce qu’on attend pour ouvrir à d’autres domaines : 

- Manque des opérateurs et aides ⇒ Agences de l’eau/des régions/ un test avec une collectivité/ aides européennes ?
- Besoin de tester les fonctionnalités de mises à jour, du compte de porteur d’aides, de remontées de données sur les aides réellement accordées (par exemple avec Bpifrance ?)
- Besoin de tester les fonctionnalités de tableau de bord et pilotage auprès des tutelles

Une fois ces éléments et l’investigation validées, nous proposons d’ouvrir l’outil pour référencer l’entièreté des aides, nous pourrions alors intégrer opérateurs par opérateurs et les tutelles selon un calendrier bien défini.