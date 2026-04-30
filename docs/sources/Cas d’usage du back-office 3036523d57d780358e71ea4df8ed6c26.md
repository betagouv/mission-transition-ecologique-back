# Cas d’usage du back-office

un espace back-office "Mon espace opérateur" permettant aux opérateurs d'ajouter, éditer, mettre à jour, suivre les statistiques de leurs aides.

- Avec une première page expliquant en quoi consiste cet espace, intégrant une mire de connexion Proconnect, et une mire de connection / création de compte (au choix)
- un tableau de bord avec un moteur de recherche (3 types de données : aides, projets, conseillers)
- l'accès à mes aides suivies, mes projets suivis (raccourcis)
- une page statistique personnalisable
- un centre de notification (nouvelles aides ajoutées, nouveaux projets, aides suivies qui arrivent à échéances...)

**vue opérateurs**

**👁️ ajout / mise à jour d’une aide**

En tant qu’opérateur :

- J’ai besoin d’ajouter une nouvelle aide manuellement
- Je souhaite lier une aide à un projet existant
- J’ai besoin de partager une aide à un collègue pour demander une relecture, un avis, une info manquante…
- J’ai besoin de créer une nouvelle aide, en dupliquant une aide existante
- J’ai besoin d’une aide à la réécriture / vulgarisation
- J’ai besoin de supprimer une aide manuellement
- J’ai besoin de mettre à jour les données d’une aide manuellement
- Je souhaite faire une suggestion de projet
- Je souhaite être informé avant la date de fin d’une aide pour penser à la renouveler ou la mettre à jour.

**En tant qu'Administrateur global :**

- J’ai besoin de faire un import de masse d’aides d’un BDD d’un opérateur
    
    Je choisis d'écraser / remplacer une aide / ou ajouter une nouvelle aide : (ex : aide Géothermie 2026 remplace la donnée 2025)
    
- J’importe de l’info structurée mais qui peut être ajustée, je regarde ce qui rentre dans les cases, je réadapte les champs. j’ai besoin de m’assurer que chaque champs est complété (critères d'éligibilité, date de fin, étapes, contact…)
- j’ai besoin de notifier le référent de l’aide d’un besoin de complément d’info
- J’ai besoin d’accéder à un journal d'audit (registre chronologique détaillé de toutes les modifications apportées**)** "Qui a modifié quoi et quand ?"
- j’ai besoin de m’assurer que les nouvelles aides ajoutées respectent les guidelines, sont lisibles et vulgarisées pour les entreprises
- j’ai besoin de lier les aides avec les idées de projets correspondants
- j’ai besoin d’ajouter des nouveaux opérateurs sur la BDD (onboarding, création de compte, référent…)
- j’ai besoin de créer des liens entre des dispositifs connexes (ex : la variation régionale d’un dispositif “dispositif conditionnel”)
- **fonctionnalités**
    - [ ]  Possibilité de connexion avec Agent connect ?
    - [ ]  Espace connecté avec gestion des habilitations : droits d’admin/modération, droits d’édition, droits de consultation…
    - [ ]  Guide d’édition ([cf RNB](https://www.notion.so/le-r-f-rentiel-national-des-batiments-RNB-3036523d57d780ba803edfe5e3e3c2ab?pvs=21)) / assistant IA
    - [ ]  Service de réécriture
    - [ ]  Centre de notifications

**👁️ consultation des aides**

En tant qu’opérateur :

- Je souhaite consulter uniquement les aides proposées par mon organisation
- Je souhaite consulter uniquement les aides dont je suis responsable
- Je souhaite consulter les aides de l’ensemble des opérateurs disponibles sur un projet
- Je recherche spécifiquement une aide sur le catalogue

En tant que région / département /ville :

- Je souhaite consulter les aides disponibles sur ma région, département ou ma ville

En tant qu’Opco, fédération  :

- Je souhaite consulter les aides disponibles pour les secteurs d’activités qui me concernent.

En tant que conseiller :

- Je souhaite consulter les aides disponibles pour une entreprise en particulier
- Je souhaite faire un extract des aides

En tant que tutelle

- Je souhaite avoir un aperçu de l'exhaustivité des aides sur un projet pour identifier les manques, les doublons, les aides à soutenir…
- **fonctionnalités**
    - [ ]  Moteur de recherche des aides et des projets
    - [ ]  Catalogue des aides avec filtres opérateur, secteur d’activité, secteur géographique, projets
    - [ ]  Tableau de bord des aides suivis par l’utilisateur
    - [ ]  Place de marché des tutelles et opérateurs
    - [ ]  Tableau de bord avec aides et projets “suivis”

**📊 suivi des performances**

En tant qu’opérateur :

- je souhaite consulter les stats d'une aide (passage à l’action en autonomie, via Conseillers-entreprises, répartition géographique, secteur d’activité et taille des entreprises)
- je souhaite exporter les stats

En tant que tutelle :

- je souhaite connaitre les enveloppes dédiée et les enveloppes distribués par aide auprès des entreprises

**👁️ consultation des contacts**

En tant qu’opérateur :

- je souhaite accéder à la cartographie des conseillers / référents par thématique (nom, prénom du référent, poste, organisation, contact mail, dispositifs liés, projets liés)
- **fonctionnalités**
    - [ ]  Ajouter une rubrique contact sur les fiches projets
    - [ ]  Catalogue des contacts avec filtres projet, région, opérateur…

**↗️ Intégration**

En tant qu’opérateur :

- je souhaite intégrer des aides sur mon site (filtrage secteur d’activité, géographique, opérateur…)
- **fonctionnalités**
    - [ ]  Widgets à paramétrer
    
    🎉 **Indicateur d’impact** : nombre de requêtes API (usage de la donnée par des partenaires et services tiers
    

**💫 GEO** 

**Import de masse**

Administrateur global 

j’associe l’aide à un projet

on récupère de l’info structurée mais qui peut être ajustée (aides RD2A), on regarde ce qui rentre dans les cases, on réadapte. 

Ecraser / remplacer une aide : (ex : Géothermie 2026 remplace la donnée 2025)