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

### 2. Commentaires de relecture : champ `array` en sidebar

**Décision :** Ajouter un champ `reviewComments` de type `array` dans la **sidebar**, positionné **sous la description SEO** :

| Sous-champ | Type | Comportement |
|---|---|---|
| `text` | `textarea` | Saisi par le relecteur, requis |
| `author` | `relationship` → `users` | Lecture seule, horodaté automatiquement |
| `date` | `date` (`dayAndTime`) | Lecture seule, horodaté automatiquement |

Le label de ligne réutilise le composant existant `NumberedRowLabel` (`clientProps: { singular: 'Commentaire' }`), sans nouveau composant admin (donc pas de régénération d'`importMap`).

**Justification :**
- Version **simple** voulue par le produit : un fil de commentaires plat, suffisant pour des retours de relecture, sans threading ni résolution.
- La sidebar sous la description SEO maintient le commentaire à portée de regard pendant l'édition, à l'emplacement libéré par le retrait de « Historique des transitions » (ADR PR 4).

### 3. Horodatage automatique via le hook `stampReviewComments`

**Décision :** Un hook `beforeChange` (`src/hooks/programs/stampReviewComments.ts`) renseigne `author` (utilisateur courant) et `date` (maintenant) sur les **nouveaux** commentaires uniquement.

**Justification :**
- `author` et `date` sont en lecture seule dans l'UI : un nouveau commentaire arrive donc au hook sans ces champs. Le hook ne remplit que les lignes dépourvues d'`author`, ce qui **préserve** l'auteur et la date d'origine des commentaires existants (aucune réécriture lors d'une édition ultérieure).
- Le hook est inséré dans la chaîne `beforeChange` avant `beforeChangeWorkflow`, à l'image de `assignCreatorOnCreate`. Il n'interfère pas avec la logique de workflow.

---

## Conséquences

- **Schéma SQLite** : le champ `array` crée de nouvelles tables (`programs_review_comments` et leur équivalent versionné). La base fixture commitée (`tee-poc.db`) est reseedée après le changement de schéma, conformément au workflow de branches.
- **Pas d'impact canonical** : `reviewComments` est une donnée éditoriale interne, non mappée vers le format pivot (`libs/canonical`). Le store canonical est inchangé.
- **Accès** : aucune restriction d'accès spécifique n'est posée sur `reviewComments` dans cette version simple ; tout utilisateur disposant du droit d'édition du dispositif peut ajouter un commentaire.

---

## Alternatives écartées

- **Commentaires en collection dédiée (relation)** : plus extensible (threading, notifications), mais surdimensionné pour le besoin « version simple ». Un `array` embarqué suffit et reste versionné avec le dispositif.
- **Verrouillage applicatif maison** : inutile, Payload 3 le fournit nativement et l'intègre aux API et à l'UI.
