# ADR 0009 — Verrouillage de document et commentaires de relecture

**Date :** 2026-06-29
**Statut :** Accepté
**Décideurs :** PO, Tech Lead

---

## Contexte

Le ticket #6 (évolutions UX/UI du back-office opérateur) regroupe une série de chantiers découpés par PR. La **PR 5** couvre deux fonctionnalités transverses au cycle de relecture des dispositifs :

- **Point 12, verrouillage de document** : éviter que deux éditeurs travaillent simultanément sur le même dispositif et écrasent mutuellement leurs modifications.
- **Point 15, commentaires de relecture** : permettre aux relecteurs (administrateurs) de laisser des retours rédigés directement sur le dispositif, sans canal externe.

Ces deux besoins sont indépendants du moteur de workflow (ADR 0005) : ils n'ajoutent pas d'état ni de transition, ils sécurisent et outillent l'édition.

---

## Décisions

### 1. Verrouillage de document via `lockDocuments` natif

**Décision :** Activer explicitement le verrouillage natif de Payload 3 sur la collection `Programs` :

```ts
lockDocuments: {
  duration: 300,
}
```

**Justification :**
- Payload 3 fournit le verrouillage de document en standard (activé par défaut). Quand un utilisateur ouvre un dispositif en édition, le document est verrouillé pour les autres : toute tentative de mise à jour ou de suppression concurrente échoue (Local API, REST API et UI admin).
- Le verrou se libère automatiquement après `duration` d'inactivité (300 secondes, soit la valeur par défaut Payload). Il est rafraîchi tant que l'éditeur interagit avec le document.
- La config est posée **explicitement** plutôt que laissée implicite : elle documente l'intention et offre un point unique pour ajuster la durée.

**Portée :** seule la collection `Programs` est concernée par la PR 5. Les autres collections conservent le comportement par défaut.

### 2. Commentaires de relecture : collection dédiée `ReviewComments`

**Décision :** Les commentaires vivent dans une **collection dédiée** `review-comments` (une ligne = un commentaire), liée au dispositif par une relation, plutôt que dans un champ `array` embarqué sur `Programs`.

| Champ | Type | Comportement |
|---|---|---|
| `program` | `relationship` → `programs` | Dispositif commenté, requis, indexé |
| `text` | `textarea` | Saisi par le relecteur, requis |
| `author` | `relationship` → `users` | Lecture seule, posé automatiquement à la création |
| `createdAt` | timestamp natif | Posé automatiquement par Payload |

La collection est masquée de la navigation admin (`admin.hidden`) : elle se pilote uniquement depuis la sidebar du dispositif. L'auteur est posé par le hook `beforeChange` `assignCommentAuthor` (`src/hooks/reviewComments/assignCommentAuthor.ts`) à partir de `req.user`. Accès : lecture et création pour tout utilisateur authentifié ; modification et suppression réservées aux admins.

**Pourquoi une collection et non un `array`.** Le besoin produit est l'**enregistrement immédiat** : cliquer sur « Envoyer » doit persister le commentaire tout de suite, sans attendre le bouton « Enregistrer » du formulaire. Avec un `array` sur `Programs`, persister un commentaire impose une mise à jour du dispositif (`PATCH /api/programs/{id}`), ce qui :
- déclenche la **validation complète du formulaire** (échec sur un brouillon incomplet) ;
- avec `?draft=true` pour contourner la validation, fait basculer `_status` à `draft` et **déclenche une transition de workflow parasite** (un dispositif `publié` repasse en « en cours de modification ») ;
- génère une **nouvelle version** du dispositif à chaque commentaire.

Une collection séparée supprime ces trois effets de bord : créer un commentaire est un simple `POST /api/review-comments`, qui ne touche jamais le dispositif. Comportement vérifié : ajouter un commentaire à un dispositif `publié` laisse son statut inchangé.

**Présentation : fil de discussion.** Le champ `reviewComments` sur `Programs` est un champ **`ui`** (sans colonne en base) positionné dans la **sidebar sous la description SEO**, rendu par le composant `ReviewCommentsThread` (`apps/cms/src/components/programs/ReviewCommentsThread.tsx`). Il affiche les commentaires comme un fil de messagerie (séparateurs de date, avatar à initiales, auteur, horodatage, bulle de texte, état vide illustré) et une zone de saisie « Commentaire » (envoi à la touche Entrée ou via le bouton). Il lit le fil via `GET /api/review-comments?where[program][equals]={id}` et envoie via `POST /api/review-comments` (mise à jour optimiste, puis rechargement). Les noms d'auteurs non peuplés sont résolus via `/api/users`. Tant que le dispositif n'a pas d'`id` (jamais enregistré), la saisie est désactivée avec une invite à enregistrer le dispositif d'abord. Ce composant ajoute une entrée à l'`importMap` (régénération requise).

**Justification :**
- Version **simple** voulue par le produit : un fil plat, sans threading ni résolution.
- La présentation « chat » (avatars, auteur, heure, bulles) reprend la maquette produit.
- La sidebar sous la description SEO maintient le fil à portée de regard, à l'emplacement libéré par le retrait de « Historique des transitions » (ADR PR 4).

---

## Conséquences

- **Schéma SQLite** : la collection crée la table `review_comments`. La base fixture commitée (`tee-poc.db`) est reseedée après le changement de schéma, conformément au workflow de branches. Le seed des deux bases (`tee-poc.db` + `canonical.db`) est refait à neuf pour conserver des `canonicalId` cohérents entre les deux.
- **Pas d'impact canonical** : un commentaire est une donnée éditoriale interne, non mappée vers le format pivot (`libs/canonical`). Le store canonical est inchangé.
- **Pas d'impact workflow** : créer un commentaire ne met jamais à jour le dispositif, donc aucune transition ni version supplémentaire.

---

## Alternatives écartées

- **Champ `array` embarqué sur `Programs`** : plus proche de la formulation initiale (« champ array auteur/date/texte »), versionné avec le dispositif, mais incompatible avec l'enregistrement immédiat sans effets de bord (validation, transition de workflow parasite, churn de version). Écarté pour ces raisons.
- **Verrouillage applicatif maison** : inutile, Payload 3 le fournit nativement et l'intègre aux API et à l'UI.
