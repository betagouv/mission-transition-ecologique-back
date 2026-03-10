# GitHub Copilot — Instructions

## Commits

Utiliser les **Conventional Commits** : https://www.conventionalcommits.org

Format : `<type>(<scope>): <description>`

Types autorisés :
- `feat` — nouvelle fonctionnalité
- `fix` — correction de bug
- `docs` — documentation uniquement
- `refactor` — refactoring sans ajout de fonctionnalité ni correction de bug
- `test` — ajout ou modification de tests
- `chore` — tâches de maintenance (deps, config, build)
- `ci` — configuration CI/CD

Exemples :
```
feat(cms): add User collection with role field
fix(cms): resolve SQLite index conflict on startup
docs: update README with install instructions
chore: upgrade PayloadCMS to 3.80.0
```

Règles :
- Description en anglais, à l'impératif, sans majuscule, sans point final
- Scope optionnel mais recommandé (ex: `cms`, `auth`, `api`)
- Breaking changes : ajouter `!` après le type/scope et un footer `BREAKING CHANGE:`