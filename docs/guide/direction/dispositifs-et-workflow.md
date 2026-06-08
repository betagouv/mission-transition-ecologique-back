# Dispositifs d'aide et workflow éditorial

> Public : Directeur de service · Dernière mise à jour : 2026-06-08

## En bref

Le **dispositif d'aide** est l'objet central du back-office : c'est ce qui décrit une aide proposée aux entreprises et ce qui finit publié sur le site. Sa mise en ligne n'est jamais directe : chaque dispositif suit un **circuit éditorial encadré** qui va de la création à la publication, avec des étapes de relecture et des droits différenciés selon les rôles. C'est ce circuit qui constitue la principale valeur de pilotage de l'outil.

## Ce que décrit un dispositif

Chaque dispositif regroupe, de façon structurée, tout ce qu'une entreprise doit savoir : la nature de l'aide, le montant ou l'avantage, ce qu'elle promet, la description détaillée, les étapes pour en bénéficier, le mode de contact, les conditions d'éligibilité (taille d'entreprise, secteur d'activité, zone géographique) et l'opérateur qui la porte.

La nature de l'aide structure le formulaire : selon qu'il s'agit d'un **financement**, d'un **prêt**, d'un **avantage fiscal**, d'une **formation** ou d'un **diagnostic / étude**, les champs de montant affichés s'adaptent. Cela garantit que chaque type d'aide est décrit avec les bonnes informations, sans surcharger l'éditeur de champs inutiles.

## Le circuit de validation, étape par étape

Un dispositif passe par une série d'états qui retracent son cycle de vie réel. Les états principaux sont les suivants :

| État | Signification |
|---|---|
| En création | Le dispositif est en cours de rédaction, pas encore soumis |
| En relecture | Soumis à un administrateur pour validation |
| En cours de publication | Étape de traitement précédant la mise en ligne |
| Publié | Visible publiquement sur le site |
| En cours de modification | Un dispositif déjà publié est en train d'être retravaillé |
| Importé | Créé via un flux d'import (à venir) |
| Archivé | Retiré du catalogue, conservé pour l'historique |
| Annulé | Abandonné |
| Remplacé | Remplacé par un autre dispositif, qui doit être désigné |

Le parcours nominal est : **création → relecture → publication**. Un dispositif déjà publié peut être repris (« en cours de modification »), repasser en relecture, puis être republié : la version en ligne reste visible tant que la nouvelle version n'est pas validée, ce qui évite toute rupture côté public. Les états « archivé », « annulé » et « remplacé » sont des fins de vie.

## Qui peut faire quoi dans ce circuit

La règle structurante : **un créateur prépare, un administrateur valide et publie**.

Un **créateur** peut créer un dispositif et le soumettre à relecture, mais il ne peut pas le publier lui-même. La publication (et la dépublication) est réservée aux **administrateurs** et au **super-administrateur**. Les actions sensibles — archiver, annuler, remplacer, ou modifier un dispositif déjà en ligne — relèvent également des administrateurs. Le **super-administrateur** peut, en dernier recours, effectuer n'importe quelle transition.

Cette séparation des responsabilités est le mécanisme clé : elle garantit qu'aucune information n'arrive en ligne sans relecture, et que les opérations à fort impact restent entre les mains de profils habilités.

## Valeur pour le pilotage

Le circuit rend l'état de chaque aide lisible à tout moment : on sait ce qui est en attente de relecture, ce qui est publié, ce qui a été retiré. Il trace les transitions (un historique est conservé), ce qui facilite le suivi de l'activité éditoriale et la reddition de comptes. Enfin, la distinction « remplacé » avec désignation du dispositif remplaçant permet de gérer proprement le renouvellement des aides dans le temps.

## Points d'attention

> L'étape « en cours de publication » est aujourd'hui **instantanée** : elle est conçue pour accueillir plus tard des traitements automatiques (envoi d'un mail, activation à une date donnée), mais ces traitements ne sont pas encore actifs. La publication est donc immédiate après validation.

> L'**import** de dispositifs en masse est prévu (état « importé ») mais l'interface correspondante n'est pas encore livrée.

Le détail de ces limites figure dans « [Pilotage, points d'attention et maturité](pilotage-risques-roadmap.md) ».
