# Fonctionnalités actuelles de l'application

Liste **fonctionnelle** de ce que fait l'application aujourd'hui, sans vocabulaire
technique. Elle recense les fonctionnalités réellement utilisées ; les
fonctionnalités souhaitées sont regroupées en fin de document.

_Dernière mise à jour : 6 juillet 2026._

## Gestion des contenus

- **Dispositifs d'aide** : création et édition de fiches structurées (titre,
  opérateur porteur, opérateurs associés, lien, type d'aide, montants/durées
  selon le type d'aide, promesse, description, dates de validité, étapes avec
  liens, mode de contact, thèmes, informations complémentaires).
- **Opérateurs** : gestion des porteurs d'aides (nom, lien de contact).
- **Projets** : fiches projets avec descriptions courte/longue, thèmes, secteurs,
  priorité de mise en avant, et **projets liés** entre eux et aux dispositifs.
- **Zones géographiques** : référentiel des régions et départements, avec
  hiérarchie (rattachement) et distinction métropole / outre-mer.
- **Utilisateurs** : gestion des comptes (nom, rôle, opérateur, région, équipe).

## Édition et saisie assistée

- **Texte enrichi** pour les descriptions et les étapes.
- **Champs conditionnels** : les champs affichés s'adaptent au type d'aide, au
  mode de contact, à la couverture géographique, à la cible (taille d'entreprise,
  secteur d'activité).
- **Critères d'éligibilité** : taille d'entreprise (bornes min/max), couverture
  géographique (national / régional / départemental) avec sélection des zones,
  secteur d'activité (secteurs NAF), autres critères libres.
- **Variantes d'éligibilité** : règles conditionnelles « si (conditions cumulées)
  alors (le dispositif change) », avec un **résumé de la règle affiché en direct**.
- **Aides à la saisie** : sélection groupée des zones (métropole seule,
  métropole + outre-mer, tout vider), **compteur en direct des projets**
  correspondant aux thèmes choisis, sélection multiple de tailles d'entreprise,
  listes filtrées (opérateur restreint, zones selon la couverture).

## Workflow éditorial

- **Cycle de vie du dispositif à 9 états** : en création, en relecture, en cours
  de publication, publié, en cours de modification, importé, supprimé, archivé,
  remplacé.
- **Actions contextuelles selon le rôle** : enregistrer le brouillon, demander la
  relecture, valider/publier, demander des corrections, annuler la demande de
  relecture, supprimer, archiver, remplacer.
- **Remplacement** d'un dispositif par un autre (avec désignation du remplaçant).
- **Passage automatique** en « en cours de modification » quand on modifie un
  dispositif déjà publié.
- **Modification sans interruption de service** : modifier un dispositif déjà
  publié crée une nouvelle version en brouillon ; la version publiée reste en
  ligne, et reste exposée aux consommateurs externes, tant que la nouvelle version
  n'a pas été validée et publiée.

## Rôles et droits

- **3 rôles** : créateur, administrateur, super-administrateur.
- **Périmètre par opérateur** : un créateur ne voit et ne gère que les dispositifs
  de son opérateur, ou ceux qui lui sont explicitement assignés.
- **Assignation de contributeurs** sur un dispositif.
- **Champs réservés aux administrateurs** (référencement SEO, statut,
  contributeurs).
- **Blocage à la publication** : un dispositif publié n'est plus modifiable
  directement par un créateur. (encore en cours de réflexion métier)

## Historique, versions et suivi

- **Historique des versions** d'un dispositif, consultable : date, auteur de la
  modification, statut avant / statut après.
- **Comparaison de versions** (visualisation des différences).
- **Traçabilité** du dernier auteur de modification.
- **Verrouillage pendant l'édition** : accès exclusif au dispositif en cours
  d'édition.

## Relecture et collaboration

- **Fil de commentaires de relecture** par dispositif (discussion avec auteurs,
  avatars, horodatage), enregistré immédiatement et sans impacter le contenu du
  dispositif ni son historique.

## Liste et navigation

- **Vues liste** avec colonnes (titre, opérateur, type d'aide, statut, date de
  mise à jour) et **badges de statut** colorés.

## Authentification

- **Connexion des utilisateurs** et gestion de session.

## Référentiel de données et interopérabilité

- **Référentiel de données central** : toute la donnée des dispositifs est
  consolidée dans un modèle **stable et indépendant** de l'outil d'édition.
- **Conservation indépendante** de cette donnée (réversibilité : elle survit à un
  changement d'outil).
- **Synchronisation automatique** vers ce référentiel à chaque publication.
- **Identifiant unique et permanent** attribué à chaque dispositif.
- **Export au format TEE** (front end MTE) avec vérification aller-retour de
  cohérence.
- **Mise à disposition publique pour AGIR** via 3 accès : liste des dispositifs,
  fiche détail (format proposé par R2DA), et format pivot déclinaison ADEME
  (format proposé à R2DA).
- **Export automatique au format du schéma de données** : publication automatique
  des dispositifs vers **Grist** (puis de Grist vers **data.gouv** via plugin
  Grist) au format standard du schéma de données des aides.
- **Suivi des synchronisations** (traçabilité des dispositifs publiés non repris
  dans le référentiel).

## Reprise de données

- **Import initial** des dispositifs, opérateurs, projets, zones géographiques et
  comptes de démonstration depuis les sources existantes.

---

# Fonctionnalités par persona

Vue des fonctionnalités regroupées par profil d'utilisateur. Elle reflète les
droits réellement en place dans l'application (chaque persona hérite des
possibilités du précédent, sauf mention contraire).

## Créateur (contributeur d'un opérateur)

Rédige et met à jour les dispositifs de son opérateur, sans pouvoir les publier.

- **Créer un dispositif** et le compléter (contenu, montants, éligibilité,
  étapes, contact, thèmes).
- **Éditer uniquement les dispositifs de son opérateur** ou ceux qui lui sont
  explicitement assignés.
- **Rédiger en texte enrichi** et bénéficier des champs conditionnels et des aides
  à la saisie (sélection groupée de zones, compteur de projets, variantes avec
  résumé de règle).
- **Enregistrer un brouillon**.
- **Demander la relecture** d'un dispositif.
- **Répondre à une demande de corrections** et **relancer la relecture**.
- **Participer au fil de commentaires de relecture**.
- **Consulter l'historique des versions** de ses dispositifs (date, auteur, statut
  avant/après, comparaison).
- **Limites** : ne peut pas publier, ne peut plus modifier un dispositif une fois
  publié, ne voit pas les dispositifs des autres opérateurs, n'accède pas aux
  champs réservés (référencement SEO, statut, contributeurs).

## Administrateur (gestion des aides / relecteur-valideur)

Relit, valide, publie et gère les dispositifs de tous les opérateurs.

- **Voir et éditer les dispositifs de tous les opérateurs** (périmètre global).
- **Valider et publier** un dispositif, **demander des corrections**.
- **Archiver** ou **remplacer** un dispositif (avec désignation du remplaçant).
- **Supprimer** un dispositif.
- **Assigner des contributeurs** à un dispositif.
- **Renseigner les champs réservés** : référencement SEO, statut.
- **Gérer les commentaires de relecture** (modération).
- **Mettre à jour les opérateurs** et **gérer les projets**.

## Super-administrateur

Contrôle complet, y compris les référentiels et les comptes.

- **Forcer n'importe quelle transition de statut** (au-delà des règles du
  workflow).
- **Gérer le référentiel des zones géographiques** (créer, modifier, supprimer).
- **Créer et supprimer des opérateurs**.
- **Administrer les comptes utilisateurs** (rôles, opérateur, région, équipe).
- **Modifier directement le statut** d'un dispositif.

## Consommateur de données externe (AGIR / ADEME / écosystème État)

Réutilise la donnée publiée, sans compte.

- **Consulter la liste des dispositifs publiés**.
- **Consulter la fiche détail** d'un dispositif.
- **Récupérer le format pivot ADEME** d'un dispositif.
- **Récupérer l'export au format TEE** (référentiel des aides).

## Automatismes (système)

Comportements automatiques, sans intervention d'un persona.

- **Synchronisation automatique** vers le référentiel central à chaque
  publication.
- **Attribution d'un identifiant unique et permanent** à chaque dispositif.
- **Passage automatique** en « en cours de modification » à l'édition d'un
  dispositif déjà publié.
- **Verrouillage d'un dispositif** en cours d'édition (accès exclusif).
- **Suivi des synchronisations** (traçabilité des dispositifs non repris dans le
  référentiel).

---

# Fonctionnalités à venir / souhaitées

Fonctionnalités souhaitées, non encore développées, regroupées par thème.

## Gestion des contenus

- **Pilotage des projets par secteur** : éligibilité des projets par secteur
  d'activité.
- **Gestion des témoignages**
    - Liens témoignages / projets
    - Liens témoignages / dispositifs
- **Gestion de la FAQ**
    - Lien FAQ / projets
- **Gestion des thématiques**
- **[Projection moyen terme] Priorisation des projets par secteur** : priorisation
  par secteur par un comité opérateurs (gouvernance à construire).

## Notifications et relances

- **Relance automatique de fin de dispositif** : email envoyé aux contributeurs
  assignés au plus tard 30 jours avant la date de fin de validité d'un dispositif,
  pour anticiper sa mise à jour, son archivage ou son remplacement.

## Tableau de bord et restitution

- **Tableau de bord, vitrine du back-office** (prototype SGPE ?)
    - Catalogue des aides avec filtres
    - Données de pilotage
    - À propos

## Authentification

- **Connexion via ProConnect**.

## Référentiel de données et interopérabilité

- **Versionnement des API d'export** : versionner les API et formats d'export pour
  faire évoluer les schémas sans casser les consommateurs existants.
- **Versionnement du format pivot** : versionner le schéma du référentiel de
  données central pour en faire évoluer la structure de façon maîtrisée.

## Reprise de données

- **Importation via l'API R2DA**.
- **Importation CSV contraint** (format imposé).
- **Importation via des API partenaires**.
