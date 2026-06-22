# Commentaires de code

## Langue

Tous les commentaires de code sont en **anglais uniquement**, sans exception.

## Quand commenter

Commenter avec **parcimonie**. Un commentaire n'a de valeur que là où le code
ne peut pas se suffire à lui-même.

- Code lisible et explicite : **pas de commentaire**. Un nom de variable, de
  fonction ou de classe clair vaut mieux qu'un commentaire.
- Logique non triviale (algorithme subtil, contournement, contrainte métier
  non évidente, raison d'un choix surprenant) : **commenter le « pourquoi »**,
  pas le « quoi ».

## Comment commenter

- Le plus **court possible** : une ligne suffit dans la grande majorité des cas.
- Expliquer l'intention ou la contrainte, jamais paraphraser le code.

Exemples :

```ts
// ❌ Paraphrase inutile
// increment the counter
counter++

// ❌ Commentaire sur du code déjà clair
// get the user by id
const user = await getUserById(id)

// ✅ Explique une contrainte non évidente
// Payload re-runs beforeChange on publish, so skip the sync when status is unchanged
if (previousStatus === nextStatus) return
```
