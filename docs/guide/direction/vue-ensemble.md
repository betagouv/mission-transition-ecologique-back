# Vue d'ensemble du back-office TEE

> Public : Directeur de service · Dernière mise à jour : 2026-06-08

## En bref

Le back-office TEE est l'**interface d'administration interne** du service Transition Écologique des Entreprises (ADEME / BetaGouv). Il sert à constituer et tenir à jour le **catalogue des dispositifs d'aide** (subventions, prêts, avantages fiscaux, formations, diagnostics) destinés à accompagner les entreprises dans leur transition écologique, puis à **contrôler leur mise en ligne** sur le site public.

Ce n'est pas le site vu par les entreprises : c'est l'outil de production de contenu qui l'alimente. Les équipes y saisissent et qualifient les aides ; le site public consomme ensuite ce contenu une fois publié.

## À quoi ça sert, concrètement

Le back-office répond à trois besoins de service :

D'abord, **centraliser l'information sur les aides** dans un référentiel unique et structuré, plutôt que dans des fichiers dispersés. Chaque dispositif y est décrit de façon homogène : nature de l'aide, montant, conditions d'éligibilité, zone géographique, opérateur porteur, démarches à suivre.

Ensuite, **encadrer la qualité éditoriale** : aucun dispositif n'est publié sans passer par un circuit de relecture et de validation. La direction dispose ainsi d'une garantie que ce qui est visible publiquement a été contrôlé.

Enfin, **organiser la collaboration** entre les opérateurs (qui connaissent leurs aides) et l'équipe centrale (qui valide et publie), chacun intervenant dans un périmètre défini par son rôle.

## Les grands objets manipulés

| Objet | Ce que c'est | Rôle |
|---|---|---|
| Dispositif d'aide | Une aide concrète proposée à une entreprise (appelé « Dispositif » dans l'outil) | Le cœur du catalogue, ce qui sera publié |
| Opérateur | L'organisme qui porte le dispositif (ADEME, CCI, région…) | Rattache chaque aide à son émetteur |
| Projet-type | Un besoin concret d'entreprise (rénover un bâtiment, réduire ses déchets…) | Sert à orienter l'entreprise vers les bons dispositifs |
| Zone géographique | Régions, départements et autres territoires | Délimite où une aide s'applique |
| Utilisateur | Une personne qui accède au back-office | Porte un rôle qui définit ses droits |

## Qui l'utilise

Trois profils interviennent : les **créateurs** (souvent côté opérateur) qui saisissent et soumettent les dispositifs ; les **administrateurs** qui relisent, valident et publient ; et le **super-administrateur** qui dispose de tous les droits, y compris les actions exceptionnelles. Le détail de la répartition figure dans « [Rôles et gouvernance des accès](roles-et-gouvernance.md) ».

## Ce qu'il faut comprendre comme directeur

Le back-office est le **point de contrôle de la qualité et de la mise en ligne** des aides. Sa valeur tient moins à la saisie qu'au circuit de validation qui l'entoure : c'est lui qui garantit qu'une information publiée a été vérifiée, et qui trace qui a fait quoi. La suite de cette documentation détaille ce circuit, les objets métier et les points de vigilance.

> **Maturité.** L'application est une preuve de concept. Les fondations (catalogue, rôles, circuit de validation) sont en place et fonctionnelles ; certaines étapes restent simplifiées en vue d'une montée en charge ultérieure (voir « [Pilotage, points d'attention et maturité](pilotage-risques-roadmap.md) »).
