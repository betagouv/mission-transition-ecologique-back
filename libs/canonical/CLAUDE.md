# `@tee-backoffice/canonical` — instructions locales

> Ces règles ont la **priorité** sur le `CLAUDE.md` racine pour tout le périmètre `libs/canonical/**`.

## Langue — exception au format pivot

La règle racine (« Code en anglais », `CLAUDE.md:68`) reste valable pour le code : variables, fonctions, classes, fichiers et **commentaires** sont en anglais.

**Exception intentionnelle** : les **clés du format pivot** (= format wire) sont en **français `snake_case`** — `statut_dispositif`, `types_aides`, `secteur_geographique`, `date_mise_a_jour`… Idem pour les **valeurs d'enum** (`financement`, `pret_prod`, `remplace`…), les **messages de validation** zod et les **labels/descriptions** du dictionnaire `COG_NIVEAUX`.

C'est un choix de conception assumé (source de vérité métier en français) — voir **ADR 0007** (`docs/adr/0007-canonical-pivot-format.md`). Ne pas « angliciser » ces clés/valeurs pour se conformer à la règle racine.
