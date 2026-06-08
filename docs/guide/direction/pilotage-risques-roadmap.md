# Pilotage, points d'attention et maturité

> Public : Directeur de service · Dernière mise à jour : 2026-06-08

## En bref

Ce document synthétise ce que le back-office permet de piloter, les points de vigilance à connaître en tant que directeur, et l'état d'avancement de l'outil. Il complète les documents thématiques en prenant de la hauteur sur la valeur et les limites actuelles.

## Ce que l'outil permet de piloter

Le back-office donne à la direction une visibilité sur l'**activité éditoriale** : combien de dispositifs sont publiés, en attente de relecture, en cours de modification ou retirés. L'état de chaque dispositif étant explicite, on peut à tout moment mesurer le volume du catalogue actif et la charge de validation en attente.

Il rend aussi lisible la **contribution par opérateur** : chaque dispositif étant rattaché à un opérateur et à ses contributeurs, on peut apprécier qui alimente le catalogue et sur quels périmètres.

Enfin, il structure la **qualité de l'orientation** offerte aux entreprises, via le maillage entre projets-types et dispositifs (voir « Projets et mise en relation »).

## Indicateurs naturels à suivre

Sans outil de reporting dédié à ce stade, plusieurs grandeurs sont déjà observables dans l'application et constituent des indicateurs de pilotage pertinents :

Le **nombre de dispositifs publiés** et sa progression dans le temps ; le **volume en attente de relecture**, révélateur d'un éventuel goulot d'étranglement côté validation ; la **répartition par opérateur** et par type d'aide ; et le **taux de dispositifs reliés à des projets-types**, indicateur de l'utilité réelle du catalogue côté entreprise.

## Points d'attention pour la direction

La séparation des rôles est la garantie centrale de l'outil, mais elle suppose une **équipe d'administrateurs disponible** : ce sont les seuls à pouvoir publier. Un sous-dimensionnement de l'équipe centrale se traduirait directement par un allongement des délais de mise en ligne.

La qualité du catalogue dépend fortement de la **rigueur de saisie** (éligibilité, thématiques, zones géographiques). L'outil structure les champs mais ne peut pas garantir l'exactitude du contenu : un travail de relecture éditoriale reste indispensable.

Enfin, l'outil **n'est pas le site public** : il alimente le contenu, mais l'expérience finale des entreprises dépend aussi de la façon dont ce contenu est exploité côté site.

## État de maturité (preuve de concept)

L'application est aujourd'hui une **preuve de concept**. Les fondations métier sont en place et fonctionnelles, mais plusieurs mécanismes sont volontairement simplifiés en attendant une décision de passage à l'échelle.

| Élément | État actuel | À prévoir |
|---|---|---|
| Catalogue de dispositifs + circuit de validation | Fonctionnel | — |
| Rôles et cloisonnement par opérateur | Fonctionnel | Différencier réellement admin / super-admin |
| Étape « en cours de publication » | Instantanée, sans traitement automatique | Branchements automatiques (mail, activation à une date) |
| Import de dispositifs en masse | Prévu, non livré | Interface d'import |
| Remplacement d'un dispositif | Manuel (désignation du remplaçant) | Activation automatique à échéance |
| Reporting / tableaux de bord | Absent | À définir selon les besoins de pilotage |

> **Donnée importante.** Au stade POC, la base de données peut être réinitialisée et re-remplie à partir de données d'exemple. Tant que ce stade n'est pas dépassé, l'outil n'est pas destiné à héberger des données de production critiques sans sauvegarde dédiée.

## En synthèse

Le back-office TEE remplit déjà sa fonction première : produire, valider et publier un catalogue d'aides structuré, sous contrôle de rôles. Les chantiers restants relèvent de l'industrialisation (automatisations, import, reporting) plus que des fondations. Pour la direction, les deux leviers les plus directs sur la valeur sont le **dimensionnement de l'équipe de validation** et la **rigueur éditoriale** de la saisie.
