# Tableau de synthèse — Estimations RÉCAP

**Calibrage** : dev senior full-stack TS/React/Node, 7h/j, +25 % aléas inclus. Équipe 2 devs, parallélisation 1,7×. Baseline DDD = **C-mix**. Voir [`note-detaillee.md`](./note-detaillee.md) pour le contexte complet.

---

## 0. Descriptifs S4 et S5

### S4 — Sortie de Payload en P3

**Stack** : Hybride (Payload + Next.js DSFR) en P1-P2, puis migration vers Next.js + Postgres direct (Drizzle/Prisma) en P3.

**Idée** : capitaliser sur Payload pour accélérer le POC/MVP, puis s'en émanciper quand les exigences plateforme État (RGAA AA certifié, pen-test, souveraineté) deviennent contraignantes.

**Effort** : 300-445 j/h · ~25-37 semaines (2 devs) · 210k-312k € (TJM 700€)

**Pour** : plateforme pérenne (> 3 ans), RGAA AA certifié obligatoire, autonomie technologique long terme, équipe capable de maintenir une stack custom.

**Contre** : surcoût initial de migration (61-90 j/h en P3), perte de l'admin Payload natif à reconstruire.

### S5 — Reste sur Payload jusqu'au bout

**Stack** : Hybride (Payload headless + Next.js DSFR) sur les 3 paliers, sans bascule.

**Idée** : Payload couvre les besoins de la plateforme avec un effort moindre, au prix d'une dette technique latente à surveiller.

**Effort** : 249-370 j/h · ~21-31 semaines (2 devs) · 174k-259k € (TJM 700€)

**Pour** : budget plafonné, durée de vie 2-3 ans, équipe stable à 2 devs, RGAA AA "best-effort" acceptable, admin super-admin Payload jugée suffisante.

**Contre** : dette technique latente (+80-120 j/h de surcoût rétroactif si une exigence force la bascule), surface d'attaque Payload exposée au pen-test, DSFR partiel côté admin.

> **En une phrase** : S4 paye ~6-9 semaines de plus pour solder la dette Payload et livrer une plateforme État pérenne ; S5 économise cette somme en acceptant la dette.

---

## 1. Vue d'ensemble — 6 scénarios

| Scénario | Stack | Périmètre | Cible | **j/h équipe** | **Durée 2 devs** |
|---|---|---|---|---|---|
| **S1** POC Payload-custom Lite | A1 Payload custom | Lite | P1 | 80-118 | 7-10 sem. |
| **S2** POC Hybride Lite ⭐ *(recommandé P1)* | A2 Payload + Next.js DSFR | Lite | P1 | 81-119 | 7-10 sem. |
| **S3** MVP Hybride Standard ⭐ *(recommandé P2)* | A2 Payload + Next.js DSFR | Standard | P1+P2 | 166-247 | 14-21 sem. |
| **S4** Plateforme Sortie Payload Full ⭐ *(recommandé P3)* | A3 Custom Next.js + Postgres | Full | P1+P2+P3 | 300-445 | 25-37 sem. |
| **S5** Plateforme Payload Hybride Full *(variante défendue)* | A2 Payload + Next.js DSFR | Full | P1+P2+P3 | 249-370 | 21-31 sem. |
| **S6** Composite Custom + Grist Veille *(variante allégée)* | A3 Custom + Grist M7 | Full | P1+P2+P3 | 285-420 | 24-35 sem. |

**Stacks** :
- **A1 Payload custom** : tout dans Payload `/admin`, customisations lourdes (POC actuel)
- **A2 Hybride Payload + Next.js DSFR** : Payload headless + app Next.js DSFR pour les parcours utilisateurs
- **A3 Custom Next.js + Postgres** : Next.js + Drizzle/Prisma + next-auth ProConnect, sans Payload
- **S6 Composite** : A3 Custom pour blocs 1/3/4, + Grist (Suite numérique de l'État) pour le bloc 2 Veille

**Delta C2-strict partout** : +12 à +18 % sur chacun des totaux (non recommandé pour modules CRUD triviaux).

---

## 2. Matrice modules × scénarios (j/h)

### Modules fonctionnels

| Module | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| **M1** Wizard création | 25-35 | 18-25 | (inclus S2) | (inclus S3) | (inclus S3) |
| **M2** Tableau de bord | 10-15 | 8-12 | (inclus S2) | (inclus S3) | (inclus S3) |
| **M3** Import CSV | 12-18 | 12-18 | (inclus S2) | (inclus S3) | (inclus S3) |
| **M4** Import API REST | — | — | 8-12 | 8-12 | 8-12 |
| **M5** Import scraping RSS | — | — | 10-15 | 10-15 | 10-15 |
| **M6** Workflow validation post-import | — | — | 3-5 | 3-5 | 3-5 |
| **M7** Outil de veille | — | — | 12-18 | 12-18 | 12-18 |
| **M8** Pilotage basique | — | — | 18-25 | 18-25 | 18-25 |
| **M8+** Pilotage avancé | — | — | — | 10-15 | 10-15 |
| **M9** Démarchage | — | — | — | 18-25 | 18-25 |

### Modules transverses

| Module | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| Setup foundation | 3-5 | 10-15 | (inclus S2) | + sortie : 18-28 | (inclus S2) |
| **T1** ProConnect (auth) | 8-12 | 6-8 | (inclus S2) | (inclus S2) | (inclus S2) |
| **T2** API publique versionnée | — | 3-5 | 7-10 | 5-8 | 5-8 |
| **T3** Observabilité | 2-3 | 4-6 | 8-12 | 10-15 | 10-15 |
| **T4** DSFR theming | 12-18 | 8-12 | (inclus S2) | (inclus S3) | (inclus S3) |
| **T5** RGAA AA | (T4) | (T4) | 5-10 | 8-12 | 8-12 |
| **T6** Sécurité OWASP/RGPD | — | — | 4-6 | 10-15 | 10-15 |
| **T7** Tests | 8-12 | 12-18 | 10-15 | 12-18 | 12-18 |
| Maintien Payload (dette) | — | — | — | — | 10-15 |
| **Sortie Payload (S4 only)** | — | — | — | 61-90 | — |

### T-shirt sizing par module (indicatif)

**Convention** : S = 1-5 j/h · M = 5-15 j/h · L = 15-30 j/h · XL = 30+ j/h.
La colonne « j/h » donne la fourchette de référence tous scénarios confondus (la borne basse correspond généralement à l'approche A2/A3 sur DSFR natif, la borne haute à A1 ou aux variantes les plus exigeantes).

| Module | Sizing | **j/h** | Notes |
|---|---|---|---|
| M1 Wizard | **L** | **18-35** | A2 : 18-25 · A1 : 25-35 (lutte contre Payload) |
| M2 Tableau de bord | **M** | **8-15** | A2 : 8-12 · A1 : 10-15 |
| M3 Import CSV | **M** | **12-18** | Parsing + diff + workflow, indépendant du scénario |
| M4 Import API REST | **M** | **8-12** | Endpoints versionnés, clés API, rate limit, audit |
| M5 Import scraping RSS | **M** | **10-15** | Worker pg-boss/BullMQ, dedup, détection diff |
| M6 Workflow validation | **S** | **3-5** | Extension `WorkflowTransitionPolicy` existante |
| M7 Outil de veille | **M** | **12-18** | Catalogue consolidé inter-opérateurs + commentaires |
| M8 Pilotage basique | **L** | **18-25** | Read-models + dashboards Recharts/Tremor |
| M8+ Pilotage avancé | **M** | **10-15** | Cohortes, comparaisons nationales |
| M9 Démarchage | **L** | **18-25** | Enrichissement async Sirene/Annuaire + DPIA |
| T1 ProConnect | **S-M** | **4-12** | A3 : 4-6 · A2 : 6-8 · A1 : 8-12 (strategy custom) |
| T2 API publique | **M** | **3-10** | Foundation 3-5 (P1) · consolidée 7-10 (P2) · durcie 5-8 (P3) |
| T3 Observabilité | **S-L** | **2-15** | Sentry seul 2-3 · pile complète Sentry+Prom+Matomo+audit 10-15 |
| T4 DSFR | **M** | **8-18** | A2/A3 (composants natifs) : 8-12 · A1 (Payload override) : 12-18 |
| T5 RGAA AA | **M** | **5-12** | P2 (audit interne) : 5-10 · P3 (audit externe cabinet) : 8-12 |
| T6 Sécurité | **M** | **4-15** | DPIA basique 4-6 · pen-test externe + DPIA Démarchage + corrections 10-15 |
| T7 Tests | **M-L** | **8-18** | Unit + integ : 8-12 · + E2E Playwright + axe-core : 12-18 |
| Setup foundation | **S-M** | **3-15** | A1 : 3-5 · A2 : 10-15 (deux apps NX, lib partagées, auth bridge) |
| Maintien Payload (dette) | **M** | **10-15** | Spécifique S5 : upgrades, hooks, ajustements continus |
| Sortie Payload | **XL** | **61-90** | Migration schéma 12-18 · données 6-10 · repositories 15-22 · admin custom 25-35 · décommissionnement 3-5 |

---

## 3. Trajectoire recommandée (S2 → S3 → S4)

| Palier | Scénario | Effort additionnel (j/h) | Effort cumulé (j/h) | Durée 2 devs | Cumul calendaire |
|---|---|---|---|---|---|
| **P1** (POC enrichi, 3-4 mois) | S2 | 81-119 | 81-119 | 7-10 sem. | 7-10 sem. |
| **P2** (MVP pilote, 6-9 mois) | S2 → S3 | 85-128 | 166-247 | 7-11 sem. | 14-21 sem. |
| **P3** (Plateforme nationale, 12-18 mois) | S3 → S4 | 135-198 | 300-445 | 11-17 sem. | 25-37 sem. |

---

## 4. Trajectoire variante (S2 → S3 → S5)

| Palier | Scénario | Effort additionnel (j/h) | Effort cumulé (j/h) | Durée 2 devs |
|---|---|---|---|---|
| **P1** | S2 | 81-119 | 81-119 | 7-10 sem. |
| **P2** | S3 | 85-128 | 166-247 | 14-21 sem. |
| **P3** | S5 | 83-123 | 249-370 | 21-31 sem. |

**Économie S5 vs S4** : ~50-75 j/h (~6-9 semaines de 2 devs).
**Risque** : dette technique latente — bascule rétroactive coûteuse en cas de besoin imprévu.

---

## 5. Comparaison rapide

| Critère | S1 | S2 | S3 | S4 | S5 | S6 |
|---|---|---|---|---|---|---|
| Coût initial | Bas | Bas | Moyen | Élevé | Moyen-élevé | Élevé |
| Qualité UX | ⚠️ Faible | ✅ Bonne | ✅ Bonne | ✅ Excellente | ✅ Excellente | ✅ Excellente (sauf Veille = UI Grist) |
| Conformité DSFR | ⚠️ Partielle | ✅ OK | ✅ OK | ✅ Native | ✅ Native | ✅ Native (sauf Veille) |
| Conformité RGAA AA | ⚠️ Très partielle | ✅ Acquis (P1) | ✅ AA (audit P2) | ✅ AA certifié | ✅ AA certifié | ✅ AA certifié (Veille exclue du périmètre AA) |
| ProConnect intégré | ⚠️ Custom | ✅ Standard | ✅ Standard | ✅ Standard | ✅ Standard | ✅ Standard + natif Grist |
| Dette technique | 🔴 Élevée | 🟢 Faible | 🟢 Faible | 🟢 Très faible | 🟠 Latente | 🟢 Très faible |
| Maintenance long terme | 🔴 Difficile | 🟢 OK | 🟢 OK | 🟢 Optimale | 🟠 Risquée | 🟢 Optimale |
| Souveraineté complète | 🟠 Payload dep | 🟠 Payload dep | 🟠 Payload dep | 🟢 Indépendant | 🟠 Payload dep | 🟢 Indépendant + SecNumCloud Grist |
| Audit pen-test friendly | 🟠 | 🟢 | 🟢 | 🟢 | 🟠 | 🟢 |

---

## 6. Hors-périmètre à intégrer en option

| Item | Effort estimé (j/h) | À envisager dès |
|---|---|---|
| Performance budget + Lighthouse CI | 2-3 | P1 |
| Feature flags (Unleash OSS) | 5-8 | P2 |
| Disaster recovery (RTO/RPO documenté) | 3-5 | P2 |
| Documentation utilisateur (guides opérateurs) | 8-12 | P2 |
| Effort management (chefferie projet, suivi) | +15-20 % | Tout palier |

---

## 7. Conversion € indicative

Voir §10 plus bas pour la table complète intégrant S6 (composite Grist).

---

## 8. Résumé par bloc fonctionnel — Payload / Custom Next.js / Grist

Les 4 blocs reprennent la structuration de la présentation source (1. Gestion autonome · 2. Veille · 3. Pilotage · 4. Démarchage).

**Lecture** :
- **A. Payload + Next.js DSFR** (A2 Hybride) = scénario S5 en P3 *ou* S4 en P1-P2 avant migration
- **B. Custom Next.js + Postgres** (A3) = scénario S4 après migration P3, ou S6 composite
- **C. Grist (Suite numérique)** = outil SaaS souverain hébergé en SecNumCloud, gratuit pour agents publics

Pour les modules **non viables en Grist**, la mention ❌ indique un blocage fonctionnel ou réglementaire (voir §9 pour la justification détaillée).

### 8.1. Bloc 1 — Gestion autonome des aides

*Tableau de bord + Wizard de création par étapes + Import CSV/API/RSS + Workflow validation*

| Module | Palier | A. Payload | B. Custom Next.js | C. Grist |
|---|---|---|---|---|
| M1 Wizard création (5 étapes DSFR) | P1 | 20-28 | 18-25 | ❌ N/A (UI grille, pas de wizard) |
| M2 Tableau de bord | P1 | 9-13 | 8-12 | 2-4 (vue native) |
| M3 Import CSV manuel | P1 | 12-18 | 13-19 | 1-3 (natif) |
| M4 Import API REST | P2 | 8-12 | 8-12 | 5-8 (API Grist + transformation) |
| M5 Import scraping RSS | P2 | 10-15 | 10-15 | 8-12 (cron externe → API Grist) |
| M6 Workflow validation post-import | P2 | 3-5 | 4-6 | 4-7 (colonnes + ACL, sans moteur) |
| **Sous-total bloc 1** | | **62-91** | **61-89** | **❌ 20-34** (sans M1) |

### 8.2. Bloc 2 — Veille pour les opérateurs

*Catalogue consolidé inter-opérateurs, vision SGPE, édition en ligne*

| Module | Palier | A. Payload | B. Custom Next.js | C. Grist |
|---|---|---|---|---|
| M7 Outil de veille | P2 | 12-18 | 13-19 | **3-6** ⭐ (cas d'usage natif) |
| **Sous-total bloc 2** | | **12-18** | **13-19** | **3-6** |

### 8.3. Bloc 3 — Pilotage des aides

*Statistiques sectorielles, read-models, comparaisons nationales*

| Module | Palier | A. Payload | B. Custom Next.js | C. Grist |
|---|---|---|---|---|
| M8 Pilotage basique | P2 | 20-28 | 18-25 | 18-30 (formules Python + widgets) |
| M8+ Pilotage avancé (cohortes, vs national) | P3 | 12-18 | 10-15 | ❌ N/A (SQLite/doc, pas de MV) |
| **Sous-total bloc 3** | | **32-46** | **28-40** | **❌ 18-30** (sans M8+) |

### 8.4. Bloc 4 — Aide au démarchage des entreprises

*Leads enrichis Sirene/Annuaire, données contact, DPIA RGPD*

| Module | Palier | A. Payload | B. Custom Next.js | C. Grist |
|---|---|---|---|---|
| M9 Démarchage (leads enrichis) | P3 | 20-28 | 18-25 | ❌ N/A (DPIA + workers async hors scope) |
| **Sous-total bloc 4** | | **20-28** | **18-25** | **❌** |

### 8.5. Synthèse fonctionnelle

| Bloc | A. Payload | B. Custom Next.js | C. Grist |
|---|---|---|---|
| 1 — Gestion autonome | 62-91 | 61-89 | ❌ 20-34 (M1 manquant) |
| 2 — Veille | 12-18 | 13-19 | **3-6** ⭐ |
| 3 — Pilotage | 32-46 | 28-40 | ❌ 18-30 (M8+ manquant) |
| 4 — Démarchage | 20-28 | 18-25 | ❌ N/A |
| **Total fonctionnel** | **126-183** | **120-173** | **❌ 41-70** (périmètre amputé) |

> **Note** : *Custom Next.js* est légèrement moins cher que Payload sur les modules custom (Pilotage, Démarchage, Wizard) car pas d'overhead de pont vers l'API Payload. *Payload* est marginalement moins cher sur les imports et le workflow (réutilisation des hooks/bulk APIs natives). Sur le total, l'écart Payload/Custom reste petit (~5 %) — la vraie différence se joue sur l'infrastructure (§8.6).
>
> *Grist* est **non viable comme stack complète** (bloque M1, M8+, M9 et n'est pas conforme RGAA), mais excelle sur M7 (Veille). D'où l'intérêt du scénario composite S6 (§9).

### 8.6. Là où S4 et S5 divergent (transverses + stack)

| Poste transverse | S4 (sortie Payload) | S5 (reste Payload) | Δ |
|---|---|---|---|
| Setup + T1 à T7 (auth, API, observabilité, DSFR, RGAA, sécurité, tests) | 122-185 | 122-185 | 0 |
| **Sortie Payload** (migration schéma + données + repositories + admin custom) | **61-90** | 0 | **+61-90** |
| **Maintien Payload** (dette, upgrades, hooks) | 0 | **10-15** | **-10-15** |
| **Total transverse + stack** | **183-275** | **132-200** | **+51-75** |

### 8.7. Bilan global cumulé (P1 + P2 + P3)

| | S4 | S5 |
|---|---|---|
| Fonctionnel (blocs 1-4) | 117-170 | 117-170 |
| Transverse + stack | 183-275 | 132-200 |
| **Total** | **300-445** | **249-370** |
| **Surcoût S4** | | **+51-75 j/h** |

### 8.8. Lecture stratégique

- **Les 4 blocs fonctionnels sont indépendants du choix Payload/Custom** — quel que soit le scénario, la valeur métier livrée est identique.
- L'arbitrage S4/S5 ne se joue **pas sur les fonctionnalités**, mais sur :
  - La **dette technique** (latente en S5, soldée en S4)
  - La **conformité État** (RGAA AA audité, pen-test, DPIA — équivalents fonctionnellement mais plus solides à défendre en S4)
  - L'**autonomie technologique** (S4 = indépendant de Payload)
- Le **surcoût S4** (+51-75 j/h ≈ 6-9 sem. à 2 devs) est un **investissement de dette** : il se rentabilise si la plateforme vit > 3 ans ou si une exigence force la bascule plus tard (auquel cas le surcoût rétroactif est ~80-120 j/h).

---

## 9. Évaluation Grist & scénario composite S6

### 9.1. Pourquoi évaluer Grist ?

[Grist](https://www.getgrist.com/) est un outil de feuille de calcul relationnelle open-source, **distribué via la Suite numérique de l'État** ([lasuite.numerique.gouv.fr/produits/grist](https://lasuite.numerique.gouv.fr/produits/grist)) : hébergement SecNumCloud, gratuit pour agents publics, ProConnect natif, adopté par 15 ministères (~15 000 agents).

### 9.2. Forces et limites pour le RÉCAP

**✅ Forces** :
- Hébergement souverain SecNumCloud + ProConnect natif (élimine ~6-12 j/h de T1)
- ACL granulaires natives (jusqu'à ligne et colonne) → couvre la matrice de droits sans code
- Setup quasi-immédiat (CRUD + imports CSV en quelques heures)
- Formules Python complètes, API REST + webhooks
- Adoption institutionnelle = légitimité forte côté SGPE / DINUM

**❌ Limites bloquantes** :
- **RGAA AA non conforme** (déclaré explicitement dans les mentions légales) — bloquant pour produit État en P3
- **Pas de wizard multi-étapes** — incompatible avec M1 (parcours `Identification → Conditions → Montants → Contact → Publication`)
- **SQLite par document** — plafonne la volumétrie analytique (M8+ Pilotage avancé inaccessible à la cible ~10k entreprises/mois)
- **Pas d'API publique versionnée OpenAPI** — l'API Grist est CRUD générique, pas adaptée au contrat MuleSoft
- **DPIA Démarchage** (M9) hors scope (workers d'enrichissement async, audit RGPD complet)
- **Pas de moteur de workflow** — le workflow 9 états (ADR 0005) est simulable mais non robuste

### 9.3. Le bon usage : composite S6

Plutôt qu'un remplaçant de Payload, **Grist est un excellent outil pour le bloc 2 Veille (M7)** : catalogue éditable + commentaires + ACL fines = exactement son cas d'usage natif.

**Scénario S6 — Composite Custom + Grist Veille** :

```
┌─────────────────────────────────────────────────────────┐
│  RÉCAP — Plateforme nationale (S6)                      │
├─────────────────────────────────────────────────────────┤
│  Bloc 1 - Gestion aides    →  Next.js DSFR + Postgres   │
│  Bloc 2 - Veille SGPE      →  Grist (Suite numérique)   │
│  Bloc 3 - Pilotage         →  Next.js + read-models PG  │
│  Bloc 4 - Démarchage       →  Next.js + workers Sirene  │
│                                                         │
│  Source de vérité unique : Postgres (Drizzle)           │
│  Sync vers Grist : webhooks (catalogue lecture + notes) │
└─────────────────────────────────────────────────────────┘
```

### 9.4. Chiffrage S6

S6 = S4 (Custom Next.js Full) – delta M7 (Custom → Grist) – delta T1 partiel (auth ProConnect partagée) + intégration Grist (sync webhooks + setup ACL).

| Poste | S4 (référence) | S6 (composite) | Delta |
|---|---|---|---|
| Blocs 1, 3, 4 (fonctionnel) | 107-154 | 107-154 | 0 |
| Bloc 2 — Veille | 13-19 (Custom) | 3-6 (Grist) + 5-8 (sync webhooks) = **8-14** | -5 à -5 |
| Setup Grist (ACL, workspaces, fixtures) | — | 3-5 | +3-5 |
| T1 ProConnect (factorisation partielle) | 6-8 | 4-6 | -2 |
| Transverses T2-T7 | 122-185 | 122-185 | 0 |
| Sortie Payload | 61-90 | 61-90 | 0 |
| **Total S6** | **300-445** | **285-420** | **-15 à -25 j/h** |

**Économie nette** : ~10-25 j/h (1-3 semaines de 2 devs), soit ~7k-17k € (TJM 700€).

### 9.5. Conditions de viabilité de S6

- Acceptation par les pilotes SGPE d'un outil Grist hébergé sur la Suite numérique (à valider en amont)
- Sync unidirectionnel Postgres → Grist (Grist en lecture + commentaires ; les éditions structurelles restent dans RÉCAP)
- Périmètre Veille stable (si la Veille évolue vers de l'édition forte ou de l'analytics complexe, on rebascule en Custom)
- Pas de PII dans Grist (le bloc 4 Démarchage reste exclusivement dans RÉCAP)

### 9.6. Hors S6 : Grist comme amorçage P1

Indépendamment du scénario cible, Grist peut servir d'**amorçage très rapide en pré-P1** (~10-20 j/h) pour :
- Valider l'appétence opérateurs (catalogue partagé, ACL, ProConnect)
- Cadrer les KPIs Pilotage avec le SGPE avant d'engager le développement
- Tester le mapping de données avec R2DA

C'est un **démonstrateur jetable** : la bascule vers S2 ou S4 reste à faire en totalité (pas de réutilisation du code Grist).

---

## 10. Conversion € — tous scénarios

Avec un TJM senior BetaGouv ≈ 600-800 €/j :

| Scénario | j/h | Coût (TJM 600 €) | Coût (TJM 800 €) |
|---|---|---|---|
| S2 (P1) | 81-119 | 49k-71k € | 65k-95k € |
| S3 (P1+P2) | 166-247 | 100k-148k € | 133k-198k € |
| **S4 (P1+P2+P3, sortie Payload)** | **300-445** | **180k-267k €** | **240k-356k €** |
| S5 (P1+P2+P3, reste Payload) | 249-370 | 149k-222k € | 199k-296k € |
| **S6 (Composite Custom + Grist Veille)** | **285-420** | **171k-252k €** | **228k-336k €** |

*Hors chefferie projet et infrastructure d'hébergement. Grist (Suite numérique) gratuit pour agents publics.*

---

*Voir [`note-detaillee.md`](./note-detaillee.md) pour les hypothèses, le détail par module et l'argumentation du point de bascule Payload, ainsi que l'analyse complète de Grist.*
