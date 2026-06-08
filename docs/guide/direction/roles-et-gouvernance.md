# Rôles et gouvernance des accès

> Public : Directeur de service · Dernière mise à jour : 2026-06-08

## En bref

L'accès au back-office repose sur **trois rôles hiérarchisés**. Chacun définit ce qu'une personne peut voir et faire. Ce système est le garant de la sécurité et de la séparation des responsabilités : il assure qu'un contributeur externe ne peut pas publier seul, et que les opérations sensibles restent maîtrisées par l'équipe centrale.

## Les trois rôles

| Rôle | Qui | Ce qu'il peut faire |
|---|---|---|
| Créateur | Souvent un contributeur côté opérateur | Crée et édite les dispositifs qui lui sont rattachés, les soumet à relecture. Ne publie pas. |
| Administrateur | Équipe centrale TEE | Relit, valide, publie ; gère opérateurs, projets-types et utilisateurs ; effectue les opérations sensibles (archiver, remplacer…). |
| Super-administrateur | Responsable de l'outil | Tous les droits, y compris toute action exceptionnelle ou de secours. |

Ces rôles suivent une **hiérarchie** : un rôle supérieur hérite des droits des rôles inférieurs. Le super-administrateur peut tout faire ; l'administrateur fait tout sauf ce qui est réservé au super-administrateur ; le créateur agit dans le périmètre le plus restreint.

## Le principe de périmètre

Un **créateur est rattaché à un opérateur**. Concrètement, cela signifie qu'il voit l'ensemble des dispositifs de son opérateur, mais qu'il ne peut **modifier que ceux qu'il a créés ou auxquels il a été explicitement associé**. Les autres lui apparaissent en lecture seule. Il ne peut pas non plus rattacher un dispositif à un opérateur qui n'est pas le sien.

Cette logique cloisonne naturellement le travail : chaque opérateur reste maître de ses propres aides, sans pouvoir interférer avec celles des autres.

## Ce que voit chaque rôle

Tous les rôles accèdent aux **dispositifs**. En revanche, les écrans de configuration — utilisateurs, opérateurs, projets-types, médias — sont **réservés aux administrateurs et super-administrateurs**. La gestion des **zones géographiques** est, elle, réservée au seul super-administrateur. Un créateur n'a donc accès qu'à ce qui relève directement de son travail de saisie.

| Domaine | Créateur | Administrateur | Super-admin |
|---|---|---|---|
| Dispositifs | Visible (édition limitée à son périmètre) | Complet | Complet |
| Publication d'un dispositif | Non | Oui | Oui |
| Opérateurs, Projets, Utilisateurs, Médias | Masqué | Visible | Visible |
| Zones géographiques | Masqué | Masqué | Visible |
| Actions exceptionnelles (override) | Non | Non | Oui |

## Valeur pour la gouvernance

Ce dispositif de rôles apporte trois garanties à la direction : la **traçabilité** (chaque dispositif sait qui peut le modifier), la **séparation des pouvoirs** (créer n'est pas publier), et le **cloisonnement par opérateur** (chacun chez soi). C'est la base sur laquelle peut s'appuyer une politique de contribution ouverte aux opérateurs sans perte de contrôle éditorial.

## Points d'attention

> Au stade actuel (preuve de concept), les rôles **administrateur** et **super-administrateur** disposent en pratique des **mêmes droits**. La distinction est conservée volontairement dans le système, pour pouvoir différencier leurs prérogatives plus tard sans tout refondre. Tant que cette différenciation n'est pas activée, il convient d'attribuer le rôle administrateur avec le même soin que le rôle super-administrateur.

> Un utilisateur créé sans rôle explicite reçoit par défaut le rôle le plus restreint (créateur).
