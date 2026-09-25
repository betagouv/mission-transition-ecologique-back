# Seed — Import initial des programmes

## Objectif

Le script `apps/cms/src/seed/programs.ts` importe les 234 programmes d'aide à la transition écologique depuis `docs/sources/programs.json` dans PayloadCMS via la **Local API**.

---

## Prérequis

1. Le PostgreSQL local doit tourner (`pnpm db:up`) et la base doit avoir son schéma : en dev, lancer `pnpm dev` une fois suffit (mode `push`) ; sur une base vierge hors dev, `pnpm migrate`.
2. Les variables d'environnement doivent être configurées (`.env` dans `apps/cms/`, voir `.env.example`) :
   ```
   DATABASE_URI=postgres://tee:tee@localhost:5432/tee
   CANONICAL_DATABASE_URI=postgres://tee:tee@localhost:5432/tee
   PAYLOAD_SECRET=<une-chaine-secrete>
   ```

---

## Utilisation

```sh
pnpm nx run @tee-backoffice/cms:seed
# ou depuis apps/cms/ directement :
pnpm seed
```

Le point d'entrée est `apps/cms/src/seed/run.ts` (script npm `seed` → `tsx src/seed/run.ts`).

---

## Comportement

### Étape 1 — Opérateurs

- Déduplique tous les noms d'opérateurs présents dans le JSON (champs `opérateur de contact` et `autres opérateurs`).
- Pour chaque opérateur : **upsert par slug** (si le slug existe déjà → skip, sinon → création).
- Construit une map `nom → id` Payload pour la résolution des relations.

### Étape 2 — Programmes

Pour chaque programme du JSON :
1. Mappe les champs JSON → structure Payload (voir `docs/context/programs-model.md` pour le mapping complet).
2. Convertit les dates `DD/MM/YYYY` → ISO 8601.
3. Convertit le markdown → Lexical via `convertMarkdownToLexical` de `@payloadcms/richtext-lexical` (listes, titres, gras… correctement structurés en nœuds Lexical).
4. Résout les relations opérateur par nom → id numérique Payload.
5. **Upsert par `slug`** : si un programme avec ce slug existe → `payload.update`, sinon → `payload.create`.

### Idempotence

Le script est **ré-exécutable sans effet de bord** : une deuxième exécution met à jour les données existantes au lieu de créer des doublons.

### Logs de sortie

```
[INFO] Reading programs.json...
[INFO] Found 234 programs in source file.
[INFO] Found 42 unique operators. Upserting...
[INFO] Operators ready. Importing 234 programs...
[INFO] Seed complete — 234 created, 0 updated, 0 errors.
```

---

## Tests

Les tests d'intégration du seed se trouvent dans `apps/cms/tests/int/seed.int.spec.ts`.

```sh
pnpm nx run @tee-backoffice/cms:test
```

Ils vérifient sur la base PostgreSQL de test (`tee_test`, vidée avant chaque exécution) :
- Les opérateurs sont créés
- Les programmes sont créés et chacun possède un opérateur
- Le champ `description` est un état Lexical valide (nœud `root`)
- La conversion markdown produit des nœuds structurés (`list`, `heading`)
- Le script est idempotent (2ème exécution → 0 created, 234 updated)

---

## Limitations connues

| Limitation | Raison |
|-----------|--------|
| `publicodes` non importé | Exclu du modèle CMS — voir ADR `docs/adr/0001-programs-collection.md` |
| `contactUrl` de l'opérateur non renseigné lors du seed | Non présent dans le JSON source |

---

## En cas d'erreur

- Les erreurs par programme sont loggées individuellement et ne bloquent pas les suivants.
- Le compte final indique le nombre d'erreurs : `X created, Y updated, Z errors`.
- Causes fréquentes : opérateur de contact absent dans le JSON, champ `id` manquant.
