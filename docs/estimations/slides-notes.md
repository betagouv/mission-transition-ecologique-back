# Slides notes — Présentation RÉCAP

**Audience** : ADEME / SGPE / partenaires opérateurs
**Format** : 12-15 slides, ~30 min de présentation + 15 min Q&R
**Objectif** : obtenir l'arbitrage sur la trajectoire technique et le périmètre de financement

---

## Slide 1 — Le RÉCAP en une phrase

> **Un outil unifié de gestion des aides à la transition écologique, conçu comme la source de vérité du dispositif TEE et le tableau de bord stratégique du SGPE.**

---

## Slide 2 — Pourquoi maintenant ?

- Le POC actuel valide le **modèle de données** (Programs, Operators, Projects, Workflow 9 états) et l'**accès rôles** (super-admin, admin, creator)
- Les opérateurs (CMA, CCI, ADEME, BPI) ont besoin d'un **outil éditorial guidé**, pas d'une admin générique
- Le SGPE a besoin d'une **vision consolidée** des aides et de leur usage
- Le site TEE public a besoin d'**une seule source** pour ses contenus

---

## Slide 3 — Les 6 modules à construire

| Module | À quoi ça sert |
|---|---|
| 🎯 **Wizard de création** | Parcours guidé en 5 étapes pour les opérateurs |
| 📊 **Tableau de bord** | Vision rapide pour chaque opérateur |
| 📥 **Import** (CSV / API / RSS) | Intégrer des aides depuis SI existants ou sources externes |
| 👁 **Outil de veille** | Catalogue consolidé inter-opérateurs |
| 📈 **Pilotage** | Statistiques sectorielles pour le SGPE |
| 🤝 **Démarchage** | Leads enrichis pour les conseillers de terrain |

---

## Slide 4 — Phasage en 3 paliers

```
P1 — POC enrichi          (3-4 mois)   →  Démonstrable, 1 opérateur fictif
P2 — MVP pilote           (6-9 mois)   →  Mise en service avec 1 opérateur réel
P3 — Plateforme nationale (12-18 mois) →  ≤ 50 opérateurs, SLA, RGAA AA, RGPD
```

Volumétrie cible P3 : ~500 aides, ~10 000 entreprises trackées/mois.

---

## Slide 5 — La question centrale : Payload ou pas Payload ?

**Le POC actuel utilise PayloadCMS**. La question : doit-on rester dessus pour le RÉCAP ?

**3 signaux qui poussent à sortir, dès P1** :

1. **Wizard custom** — Payload n'est pas conçu pour des parcours guidés
2. **DSFR obligatoire** — Payload admin n'est pas DSFR, ni RGAA AA
3. **ProConnect OIDC** — Payload n'a pas de provider natif

**2 signaux qui pousseront plus tard (P3)** :

4. Visibilité hiérarchique (opérateur / pilote national)
5. Tracking & analytics (read-models, projections)

---

## Slide 6 — 4 stratégies (3 Payload + 1 externe)

| Approche | Idée | Pour qui |
|---|---|---|
| **A1 — Payload custom** | Tout dans `/admin` Payload, customisations lourdes | ❌ Non recommandé |
| **A2 — Hybride Payload + Next.js DSFR** ⭐ | Payload pour API + super-admin, app Next.js DSFR pour parcours | ✅ P1 et P2 |
| **A3 — Custom Next.js + Postgres** ⭐ | Postgres + Drizzle + Next.js (sans Payload) | ✅ P3 |
| **A4 — Grist (Suite numérique État)** | Feuille de calcul relationnelle, SecNumCloud, ProConnect natif | ✅ Bloc 2 Veille uniquement |

---

## Slide 7 — Architecture cible (A2 Hybride)

```
┌───────────────────────────────────────────────┐
│  apps/recap (Next.js + DSFR)                  │
│  ─ Wizard, Dashboard, Pilotage, Démarchage    │
│  ─ ProConnect (next-auth OIDC)                │
│  ─ DSFR @codegouvfr/react-dsfr                │
└──────────────┬────────────────────────────────┘
               │
               │ libs/domain (entités, types)
               │ libs/api-client (Payload typé)
               │
┌──────────────▼────────────────────────────────┐
│  apps/cms (PayloadCMS + Next.js)              │
│  ─ Admin pour super-admins                    │
│  ─ API REST/GraphQL headless                  │
│  ─ Workflow hooks, génération payload-types   │
└──────────────┬────────────────────────────────┘
               │
       ┌───────▼────────┐
       │   PostgreSQL   │
       └────────────────┘
```

---

## Slide 8 — Architecture interne : DDD C-mix

| Type module | Approche | Exemples |
|---|---|---|
| **Core domain** | Hexagonal strict (ports/adapters) | Wizard, Workflow, Tracking, Leads, Pilotage |
| **Supporting** | Entités riches + repositories abstraits | Catalogue, Veille, Import |
| **Generic** | DDD léger | Operators, Users, GeographicAreas |

→ Rigueur **là où elle paie**, pragmatisme ailleurs. Surcoût ≈ +10-15 % vs DDD léger, ROI positif à 12 mois.

---

## Slide 9 — 6 scénarios chiffrés

| Scénario | Stack | Effort (j/h) | Durée (2 devs) | Coût (TJM 700€) |
|---|---|---|---|---|
| S2 (POC P1) | A2 Payload+Next | 81-119 | 7-10 sem. | **57k-83k €** |
| S3 (MVP P1+P2) | A2 Payload+Next | 166-247 | 14-21 sem. | **116k-173k €** |
| **S4 (Plateforme P3, sortie Payload)** ⭐ | A3 Custom Next.js | **300-445** | **25-37 sem.** | **210k-312k €** |
| S5 (Plateforme P3, reste sur Payload) | A2 Payload+Next | 249-370 | 21-31 sem. | 174k-259k € |
| **S6 (Composite Custom + Grist Veille)** | A3 + A4 Grist | **285-420** | **24-35 sem.** | **200k-294k €** |
| S1 (POC Payload-custom, **non recommandé**) | A1 Payload custom | 80-118 | 7-10 sem. | — |

---

## Slide 10 — Recommandation principale : S2 → S3 → S4

```
P1   ─── S2: Hybride Lite               81-119 j/h
P2   ─── S3: Hybride Standard         +85-128 j/h
P3   ─── S4: Sortie Payload Full      +135-198 j/h
                                ─────────────────
                       Total : 300-445 j/h (~25-37 sem. à 2 devs)
```

**Pourquoi** : la sortie Payload en P3 paye les exigences plateforme État (RGAA AA certifié, pen-test, DPIA Démarchage, souveraineté complète).

---

## Slide 11 — Variante défendue : S5

**Rester sur Payload jusqu'au bout** : ~50-75 j/h d'économie sur P3.

**Conditions de viabilité** :
- Équipe stable à 2 devs sur toute la durée
- Exigences RGAA "best-effort" plutôt que "certifié"
- Pen-test ne révèle pas de vulnérabilité côté Payload
- Pas d'évolution majeure du wizard

**Risque** : dette technique latente. Si une exigence force la bascule plus tard, surcoût rétroactif estimé à +30-40 % du delta S4-S5.

---

## Slide 11 bis — Variante allégée : S6 (Composite Grist Veille)

**Externaliser le bloc 2 (Veille) vers Grist** (Suite numérique de l'État, SecNumCloud, ProConnect natif).

**Économie nette vs S4** : ~15-25 j/h (~10k-17k €).

**Pourquoi Grist** :
- Hébergement SecNumCloud gratuit pour agents publics
- Adopté par 15 ministères / 15 000 agents (légitimité SGPE)
- ACL granulaires natives, formules Python, API REST + webhooks
- Le cas d'usage Veille (catalogue éditable + commentaires + filtres) est **exactement son cœur fonctionnel**

**Architecture composite** :

```
Bloc 1 Gestion aides   →  Custom Next.js + Postgres
Bloc 2 Veille SGPE     →  Grist (sync depuis Postgres)
Bloc 3 Pilotage        →  Custom Next.js + read-models PG
Bloc 4 Démarchage      →  Custom Next.js + workers Sirene
```

**Conditions** :
- Acceptation Grist par le SGPE (à valider en amont)
- Sync unidirectionnel Postgres → Grist (pas d'éditions structurelles dans Grist)
- Pas de PII dans Grist (bloc 4 reste dans RÉCAP)

**Pourquoi pas Grist partout** : RGAA AA non conforme déclaré, pas de wizard (M1), SQLite/doc plafonne M8+, pas d'API versionnée pour MuleSoft, DPIA M9 hors scope.

---

## Slide 12 — Qualité & observabilité (transverse)

| Couche | Outil (open-source) |
|---|---|
| APM / erreurs | **Sentry** (self-host ou cloud EU) |
| Métriques techniques | **Prometheus + Grafana** |
| Analytics produit | **Matomo** ou **PostHog OSS** (self-host) |
| Audit log métier | **Postgres dédiée** (table append-only) |
| Tests | **Vitest** + **Playwright** + **axe-core** |
| Sécurité | **OWASP ZAP** + **Dependabot** + pen-test annuel externe |

---

## Slide 13 — Risques principaux

| # | Risque | Mitigation |
|---|---|---|
| R1 | Contrat MuleSoft tardif | Mock dès P1 |
| R2 | ProConnect non disponible | Plan B email + whitelist |
| R3 | Quota Sirene INSEE | Cache + fallback Annuaire Entreprises |
| R4 | Régressions RGAA AA en P3 | axe-core en CI dès P1 |
| R6 | Dette Payload (sur S5) | Critères de bascule revus trimestriellement |
| R7 | Équipe à 1 dev | Pair-programming + docs à jour |

---

## Slide 14 — Hors-périmètre à intégrer en option

- Performance budget + Lighthouse CI : 2-3 j/h
- Feature flags (Unleash OSS) : 5-8 j/h
- Disaster recovery (RTO/RPO documenté) : 3-5 j/h
- Documentation utilisateur opérateurs : 8-12 j/h
- Chefferie projet (suivi, points clients) : +15-20 % sur tout l'effort

---

## Slide 15 — Prochaines étapes

1. **Arbitrer** la trajectoire (S4 sortie Payload P3 ou S5 reste Payload)
2. **Confirmer** la volumétrie cible avec le SGPE
3. **Cadrer** le contrat MuleSoft (mock initial P1, contrat final fin P1)
4. **Définir** les KPIs Pilotage avec le SGPE
5. **Lancer le sprint 0** : choix outillage (Drizzle vs Prisma, BullMQ vs pg-boss, Recharts vs Tremor)

---

## Annexes (questions fréquentes anticipées)

**« Pourquoi pas un CMS open-source existant (Strapi, Directus, Sanity) ? »**
- Aucun n'est natif DSFR, aucun n'a de provider ProConnect natif. Le coût de customisation pour les exigences État est équivalent.

**« Pourquoi pas Grist (Suite numérique de l'État) à la place de Payload pour tout ? »**
- Grist est excellent pour la **Veille** (cas d'usage natif) et c'est ce que propose le scénario S6 composite. Mais Grist **ne couvre pas** : le wizard multi-étapes (M1, UI grille incompatible), le Pilotage avancé (SQLite/doc, pas de read-models à la cible 10k entreprises/mois), le Démarchage (DPIA + workers async hors scope), l'API publique versionnée OpenAPI pour MuleSoft. Et il est **déclaré non conforme RGAA AA** — bloquant pour produit État. D'où l'usage ciblé sur le bloc 2.

**« Pourquoi pas un seul outil de la Suite numérique partout ? »**
- La Suite numérique cible le travail collaboratif inter-administrations, pas une plateforme de référence avec API publique consommée par MuleSoft et un site Drupal grand public. Mix recommandé : Grist sur la Veille (S6), Custom Next.js sur le reste.

**« Pourquoi pas l'admin Drupal du site TEE actuel ? »**
- Drupal est outillé pour la consultation publique, pas pour la gestion éditoriale opérateur (workflow 9 états, imports, pilotage). Et le site TEE consomme déjà le RÉCAP via MuleSoft.

**« Pourquoi Next.js plutôt que Remix/SvelteKit/Astro ? »**
- Cohérence avec l'écosystème BetaGouv (la plupart des produits État sont en Next.js), DSFR officiellement supporté, écosystème React mature pour DSFR.

**« Comment garantir l'indépendance technologique en cas de départ de l'équipe ? »**
- C-mix → contrats ports/adapters → tests unitaires sans DB → reprise possible par une nouvelle équipe en ~4 semaines de prise en main.

**« Pourquoi ne pas tout faire en serverless ? »**
- Hébergement souverain Scalingo/Clever Cloud = stack containers. Serverless n'apporte pas de bénéfice à cette volumétrie.

---

*Voir [`note-detaillee.md`](./note-detaillee.md) et [`synthese.md`](./synthese.md) pour le détail.*
