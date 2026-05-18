# Note détaillée d'estimation — RÉCAP (TEE Backoffice)

**Statut** : draft de chiffrage — 2026-05-18
**Auteur** : Yohann Valentin
**Périmètre** : extension du POC actuel vers une plateforme nationale de gestion des aides à la transition écologique des entreprises.

---

## 1. Contexte & cadre stratégique

Le RÉCAP (Référentiel Commun des Aides aux Professionnels) prolonge le POC TEE Backoffice actuel. Il vise à fournir aux opérateurs (CMA, CCI, ADEME, BPI…) un outil unifié de gestion éditoriale et d'analyse, et aux pilotes nationaux (SGPE, ADEME) une vision consolidée pour orienter la politique publique.

### 1.1. Phasage en 3 paliers

| Palier | Horizon | Cible | Caractéristiques |
|---|---|---|---|
| **P1 — POC enrichi** | 3-4 mois | Démonstrable en interne | Modules essentiels, 1 opérateur fictif, pas de SLA |
| **P2 — MVP pilote** | 6-9 mois | 1 opérateur pilote (ex: CMA Grand Est) | Mise en service réelle, trafic maîtrisé, données réelles |
| **P3 — Plateforme nationale** | 12-18 mois | ≤ 50 opérateurs, ~500 aides, ~10k entreprises trackées/mois | Multi-opérateurs, SLA, RGAA AA, RGPD, intégration MuleSoft → Drupal |

Les chiffrages cumulent : P1 puis P2 puis P3 (incrémental, pas indépendant).

### 1.2. Utilisateurs cibles

- **Porteurs d'aides** (creators, admins par opérateur) — déjà modélisés dans le POC
- **Pilotes nationaux** (SGPE, ADEME, super-admins) — vision consolidée inter-opérateurs
- **Conseillers de terrain** — utilisateurs du module Démarchage pour contacter les entreprises identifiées
- **Entreprises** : *non concernées* — elles restent sur le site TEE public (consultation anonyme), le RÉCAP est exclusivement back-office

### 1.3. Intégration avec l'écosystème TEE

```
RÉCAP (source de vérité)
   │
   │ API publique versionnée (OpenAPI)
   ▼
MuleSoft (intermédiation, transformation)
   │
   ▼
Site TEE public (Drupal, consultation entreprises)
```

Le couplage est **lâche** : MuleSoft prend en charge la transformation et l'adaptation. Côté RÉCAP, l'enjeu est d'exposer une API stable, versionnée, et un flux d'événements (tracking des consultations entreprises).

### 1.4. Contraintes structurantes

- **DSFR obligatoire** (`@codegouvfr/react-dsfr`) — produit État, accessibilité RGAA AA
- **ProConnect (ex-AgentConnect)** — SSO agents publics, OIDC
- **Hébergement souverain** (Scalingo / Clever Cloud / SecNumCloud)
- **Open-source obligatoire** — pas de SaaS US (Datadog, Vercel, PostHog Cloud → PostHog OSS self-host)
- **2-3 développeurs** seniors full-stack TS/React/Node

---

## 2. Modules fonctionnels

### 2.1. Cartographie des modules

| # | Module | Priorité business | Palier d'introduction |
|---|---|---|---|
| M1 | **Wizard de création d'aide** (remplace formulaire actuel) | Très haute | P1 |
| M2 | **Tableau de bord opérateur** | Haute | P1 |
| M3 | **Import CSV manuel** | Haute | P1 |
| M4 | **Import API REST** (push opérateur) | Moyenne | P2 |
| M5 | **Import scraping RSS / aides-territoires** | Moyenne | P2 |
| M6 | **Workflow validation post-import** | Moyenne | P2 |
| M7 | **Outil de veille** (catalogue consolidé éditable) | Moyenne | P2 |
| M8 | **Pilotage** (analytics sectoriels) | Haute (SGPE) | P2 → P3 |
| M9 | **Démarchage** (leads enrichis) | Moyenne | P3 |

### 2.2. Modules transverses (non-fonctionnels)

| # | Transverse | Description |
|---|---|---|
| T1 | **Auth ProConnect** | OIDC, sessions, RBAC trois rôles |
| T2 | **API publique versionnée** | OpenAPI, contrat MuleSoft, rate limit |
| T3 | **Observabilité** | Sentry (APM) + Prometheus/Grafana + Matomo/PostHog OSS + audit log métier |
| T4 | **DSFR theming** | Composants DSFR sur les parcours utilisateurs |
| T5 | **RGAA AA** | Audit + corrections + tests axe |
| T6 | **Sécurité OWASP / RGPD** | Pen-test annuel, DPIA Démarchage |
| T7 | **Tests** | Unit + Integ + E2E Playwright |

### 2.3. Détail des modules fonctionnels

#### M1 — Wizard de création d'aide

Parcours en 5 étapes : `Identification → Conditions → Montants → Contact → Publication`, avec sauvegarde brouillon à chaque étape, récapitulatif des étapes précédentes visibles, retour arrière, validation par étape.

**Implications techniques** :
- État du wizard côté client (URL persistante, sauvegarde locale + serveur)
- Validation incrémentale (zod + résumés)
- Champs conditionnels selon `aidType` (cf. ADR 0006)
- *Remplace* le formulaire Payload natif — non rétrocompatible avec l'admin Payload

#### M2 — Tableau de bord opérateur

KPIs (aides en ligne, en attente, dates de fin proches), filtres persistants, liste paginée avec aperçus visuels (cards), navigation rapide vers édition.

**Implications techniques** :
- Agrégations côté serveur (count par statut, dates pivotantes)
- Stockage des préférences utilisateur (filtres persistants par session/utilisateur)

#### M3 — Import CSV manuel

Upload CSV → parsing → prévisualisation diff (créations, mises à jour, conflits) → mapping de colonnes → validation → commit.

**Implications techniques** :
- Stream parsing (Papa Parse, csv-parse) pour fichiers volumineux
- Diff engine (jsondiffpatch ou propriétaire)
- Stockage intermédiaire (table `import_jobs` avec statut)
- Workflow validation → réutilise le workflow 9 états (ADR 0005)

#### M4 — Import API REST

Endpoint public versionné `POST /api/v1/imports` permettant aux opérateurs de pousser leurs aides depuis leur SI.

**Implications techniques** :
- Auth par clé API (séparée de ProConnect, scope opérateur)
- Rate limiting (Express rate-limit ou équivalent)
- Validation stricte (zod + règles métier)
- Audit log de chaque import
- Idempotence (clés de déduplication)

#### M5 — Import scraping RSS

Worker périodique (cron) qui scanne des sources externes (aides-territoires, ADEME, etc.), détecte les nouveautés/modifications, propose en validation humaine.

**Implications techniques** :
- Job runner (BullMQ + Redis OU pg-boss sur Postgres pour simplicité)
- Détection de changements (hash des contenus)
- Workflow validation humain (état `imported`)

#### M6 — Workflow validation post-import

Extension du workflow existant : les aides importées passent en `pending_review` ; un creator/admin doit valider avant publication.

**Implications techniques** :
- Extension `WorkflowTransitionPolicy` (ADR 0005) — ajout de la transition `imported → pending_review → draft/published`
- Vue dédiée des aides à valider (filtre + bulk actions)

#### M7 — Outil de veille

Permet à un opérateur (ou un pilote SGPE) de consulter **l'ensemble du catalogue** (au-delà de son propre périmètre), de filtrer, de commenter, et — pour les rôles habilités — d'éditer.

**Implications techniques** :
- Vue consolidée avec ACL fin (lecture globale, écriture scopée)
- Historique des modifications visible (commentaires + historique workflow)
- Liaison avec les fonctionnalités du site TEE public (consultation → édition dans un même outil)

#### M8 — Pilotage

Statistiques par secteur d'activité : entreprises identifiées, thèmes explorés, top projets/aides/liens, profils par taille d'effectif. Comparaisons avec moyennes nationales (ex : `vs 25 232`).

**Implications techniques** :
- **Read-models** dédiés (projections) alimentés par les événements TEE via MuleSoft
- Agrégations pré-calculées (snapshots quotidiens) pour éviter les calculs à la volée
- Stockage analytique : *au choix selon volumétrie* — pour la volumétrie cible (~10k entreprises/mois), Postgres avec index/MV suffit ; ClickHouse devient pertinent au-delà de ~1M événements/mois
- Métriques temporelles (vs 3 mois, 6 mois, 1 an) — `tstzrange` ou `time_bucket` (TimescaleDB)

#### M9 — Démarchage

Liste des entreprises (leads) ayant exploré la plateforme TEE, enrichies par SIRET (secteur NAF, taille, région), avec données de contact pour faciliter le démarchage opérateur.

**Implications techniques** :
- Enrichissement asynchrone (jobs) :
  - API Sirene INSEE (priorité, cache + quota)
  - Annuaire des Entreprises (entreprise.data.gouv.fr) en fallback
  - Données analytiques (PostHog OSS, ou pixel TEE)
- DPIA RGPD obligatoire (données contact entreprises)
- Filtres : NAF, région, taille, période d'activité
- Export CSV avec audit log (qui a exporté, quand, pourquoi)

---

## 3. Stratégie architecture : 4 approches (3 Payload + 1 externe)

### 3.1. Vue d'ensemble

| Axe | A1 — Payload custom | A2 — Hybride | A3 — Custom Next.js | A4 — Grist (externe) |
|---|---|---|---|---|
| **CRUD admin** | Payload `/admin` étendu lourdement | Payload `/admin` pour super-admins uniquement | Pages custom Next.js + DSFR | UI Grist native (no-code) |
| **Parcours utilisateurs** | Composants custom dans Payload `/admin` | App Next.js DSFR séparée | App Next.js DSFR | UI Grist (grille/forme/widget) |
| **Persistence** | Payload + Postgres | Payload + Postgres | Postgres direct (Drizzle / Prisma) | SQLite par document Grist |
| **Auth** | Payload auth + provider OIDC custom | next-auth + bridge Payload | next-auth (OIDC ProConnect direct) | ProConnect natif (Suite num.) |
| **DSFR** | Pénible (Payload UI overridée) | DSFR natif côté app utilisateur | DSFR natif partout | ❌ UI Grist propriétaire |
| **Types** | `payload-types.ts` auto-généré | Idem + types partagés via lib NX | Schemas Drizzle/Prisma comme source de vérité | Schéma déclaratif Grist |
| **Risque dette** | Élevé (Payload sous tension) | Maîtrisé | Faible mais surcoût initial | Faible (outil SaaS souverain) |
| **Périmètre couvert** | Tous blocs | Tous blocs | Tous blocs | ❌ Bloc 2 (Veille) uniquement |

### 3.2. A1 — Payload custom

On reste intégralement dans Payload, en customisant lourdement l'admin (champs custom, composants overridés, hooks). C'est l'approche du POC actuel.

**Avantages** : minimise le code, réutilise `payload-types.ts`, hooks `beforeChange` puissants.

**Limites bloquantes pour le RÉCAP** :
- **Wizard multi-étapes** : Payload est conçu pour des formulaires en colonnes, pas pour un parcours guidé. Le rendre conforme au parcours cible (`Identification → Conditions → Montants → Contact → Publication`) demande de réécrire complètement l'éditeur (composant racine custom + state management custom + override du save). C'est faisable mais on lutte contre le framework.
- **DSFR** : Payload admin a son propre design system (panel layout, typographie). Le DSFR-iser impose de réécrire la majorité des composants — l'admin Payload n'est *pas* conçu pour ça.
- **ProConnect OIDC** : Payload auth est REST simple (email/password, JWT). Pas de provider OIDC natif. Demande une `auth strategy` custom + reprise de la session OIDC vers le cookie Payload. Faisable mais bricolage.
- **RGAA AA** : Payload n'est pas auditeé RGAA AA, certains composants (sélecteurs, menus) ne passent pas. Pour un produit État, c'est un point dur.
- **Pilotage / Démarchage** : très loin du modèle Payload (read-models, projections, exports). Faisable en parallèle dans des collections Payload mais peu naturel.

**Verdict** : viable pour P1 (POC) en mode dégradé, **non viable pour P3** sans refonte.

### 3.3. A2 — Hybride (recommandé)

- **App `apps/cms`** (Payload) : reste comme aujourd'hui, sert d'API headless + admin pour super-admins (curation, debug, gestion utilisateurs)
- **App `apps/recap`** (Next.js DSFR) : nouvelle app dédiée aux parcours utilisateurs (wizard, dashboard, pilotage, leads)
- **Lib partagée `libs/domain`** : entités métier, types, contrats (DDD)
- **Lib partagée `libs/payload-client`** : client typé vers l'API Payload (généré via `payload-types.ts`)
- **Auth** : next-auth dans `apps/recap`, ProConnect OIDC, session bridge vers Payload (cookie partagé OU session API)

**Avantages** :
- DSFR natif sur les parcours utilisateurs (RGAA AA cadré)
- Wizard conçu librement en React + react-hook-form + zod
- ProConnect via next-auth (provider OIDC standard)
- Payload conserve sa valeur (admin riche pour super-admins, hooks workflow, génération de types)

**Limites** :
- Synchronisation des deux apps (deux processus, deux dépôts NX, mais bien gérable avec NX)
- Auth bridge à concevoir (cookie OIDC partagé entre next-auth et Payload)

**Verdict** : **scénario par défaut recommandé pour P1 et P2**.

### 3.4. A3 — Custom Next.js (sortie de Payload)

Remplacement complet par une stack Next.js + Drizzle/Prisma + tRPC/REST + next-auth.

**Avantages** :
- Maîtrise totale du modèle de données
- DDD/hexagonal natif (Payload n'est plus une dépendance)
- Performance (moins de couches)
- Pas de couplage à un CMS

**Coûts** :
- Réécriture de la couche CRUD (collections → entités + repositories)
- Réécriture de l'admin (pour super-admins) — soit on l'oublie (parcours utilisateurs suffisent), soit on construit une admin custom (KaibanJS, Refine, AdminJS…)
- Migration de données (peu coûteux si on capitalise le travail Payload via `payload-types.ts` comme schéma initial Drizzle)

**Verdict** : **bascule recommandée au palier P3** quand le ratio code Payload / code Next.js descend sous ~30 % et que les enjeux RGAA + RGPD + perf nécessitent un contrôle complet.

### 3.5. A4 — Grist (alternative externe SaaS souverain)

[Grist](https://www.getgrist.com/) (Suite numérique de l'État, [lasuite.numerique.gouv.fr/produits/grist](https://lasuite.numerique.gouv.fr/produits/grist)) est une feuille de calcul relationnelle open-source, hébergée en SecNumCloud, gratuite pour agents publics, ProConnect natif, adoptée par 15 ministères (~15 000 agents).

**Avantages** :
- Hébergement souverain SecNumCloud intégré + ProConnect natif
- ACL granulaires natives (jusqu'à ligne et colonne)
- Setup quasi-immédiat (CRUD + imports CSV + commentaires)
- Open-source, auto-hébergeable, format SQLite portable
- Adoption institutionnelle (légitimité côté SGPE / DINUM)

**Limites bloquantes pour le RÉCAP complet** :
- **RGAA AA non conforme** (déclaration explicite des mentions légales) — bloquant pour produit État en P3
- **Pas de wizard multi-étapes** — incompatible avec M1 (UI Grist = grille/formulaire, pas de parcours guidé)
- **SQLite par document** — plafond volumétrique inaccessible à la cible Pilotage avancé (~10k entreprises/mois)
- **Pas d'API publique versionnée OpenAPI** — incompatible avec le contrat MuleSoft (T2)
- **Pas de moteur de workflow** — le workflow 9 états (ADR 0005) est simulable mais non robuste
- **DPIA Démarchage** (M9) hors scope (workers d'enrichissement async, audit RGPD complet)

**Verdict** : **non viable comme remplaçant complet de Payload**, mais **excellent pour le bloc 2 Veille (M7)** où il devient le meilleur choix. Voir §11 pour l'analyse complète et le scénario composite S6.

---

## 4. Stratégie architecture interne : DDD

### 4.1. Le compromis C-mix (baseline)

Plutôt que d'imposer **C2 hexagonal strict partout** (coûteux pour les CRUD triviaux) ou **C1 DDD pragmatique partout** (laxiste sur les modules à enjeux), on adopte un **C-mix** par module, suivant la classification d'Eric Evans :

| Type de module | Approche | Justification |
|---|---|---|
| **Core Domain** : Wizard, Workflow, Tracking, Leads, Pilotage | **C2 hexagonal strict** | Ports/adapters, entités riches, agrégats, invariants ; tests unitaires sans DB ; swap Payload→Postgres = simple substitution d'adapter |
| **Supporting** : Catalogue, Veille, Import | **C2 allégé** | Entités riches + repositories abstraits, mais sans command/query bus systématique |
| **Generic** : Operators, Users, GeographicAreas | **C1 DDD léger** | Entités riches + accès direct au CMS/ORM ; pas de port intermédiaire |

### 4.2. Coût réel C2 vs C1

Le surcoût C2 vs C1 se décompose :

| Composant | Surcoût C2 vs C1 | Atténuation IA |
|---|---|---|
| Boilerplate (interfaces, adapters, mappers) | +20-30 % de LOC | Forte — l'IA génère bien ce code répétitif |
| Réflexion architecture | +10-15 % de temps en amont | Partielle — l'IA assiste mais ne décide pas |
| Tests (long terme) | **NÉGATIF** | — |

**Surcoût net global** : **+10 à +15 %** par module, ROI positif à partir de 12 mois (refactor, sortie Payload, tests).

### 4.3. Bounded contexts proposés

```
┌────────────────────────────────────────────────────┐
│                  RÉCAP (application)                │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  Catalogue   │  │   Workflow   │  │  Import  │  │
│  │  (Aides,     │◀▶│  (Statuts,   │◀▶│  (CSV,   │  │
│  │   Opérateurs)│  │   transitions│  │   API,   │  │
│  │              │  │   policy)    │  │   RSS)   │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │   Tracking   │  │   Pilotage   │  │  Leads   │  │
│  │  (Événements │─▶│  (Read-      │  │ (Enrich- │  │
│  │   TEE)       │  │   models,    │  │  ment    │  │
│  │              │  │   stats)     │  │  SIRET)  │  │
│  └──────────────┘  └──────────────┘  └──────────┘  │
│                                                    │
│  ┌──────────────┐  ┌──────────────┐                │
│  │   Identity   │  │   Audit      │                │
│  │ (ProConnect, │  │  (Log métier │                │
│  │   sessions)  │  │   RGPD)      │                │
│  └──────────────┘  └──────────────┘                │
└────────────────────────────────────────────────────┘
```

Chaque bounded context est un dossier dans `apps/recap/src/contexts/<context>/` avec sa structure interne :

```
contexts/catalogue/
  domain/
    entities/         # Aide, Operator (entités riches avec invariants)
    value-objects/    # AideId, Slug, Theme
    services/         # AideValidator, ProgramMerger
    events/           # AideCreated, AidePublished
  application/
    commands/         # CreateAideCommand + Handler
    queries/          # GetAideByIdQuery + Handler
    ports/            # AideRepository (interface)
  infrastructure/
    repositories/     # PayloadAideRepository (implements AideRepository)
                      # PostgresAideRepository (variante A3)
    mappers/          # Aide ↔ payload-types ↔ DB row
  ui/
    pages/            # Next.js routes
    components/       # Composants DSFR spécifiques
```

---

## 5. Scénarios chiffrés

### 5.1. Calibrage

- **Profil** : développeur senior full-stack TS/React/Node
- **Capacité** : 7h productives/jour, +25 % d'aléas inclus (revue, déploiement, ajustements)
- **Équipe** : 2 devs en parallèle, coefficient de parallélisation 1,7× (Amdahl, pas 2×)
- **Unité** : j/h équipe (à diviser par 1,7 pour obtenir durée calendaire à 2 devs)
- **Baseline DDD** : C-mix
- **Delta C2-strict** : indiqué par module quand pertinent

### 5.2. Vue d'ensemble

| Scénario | Stack | Périmètre | Archi | Cible | Total j/h | Durée calendaire (2 devs) |
|---|---|---|---|---|---|---|
| **S1** — POC Payload-custom Lite | A1 | Lite | C-mix | P1 | **80-110** | 7-10 semaines |
| **S2** — POC Hybride Lite (recommandé P1) | A2 | Lite | C-mix | P1 | **95-125** | 8-11 semaines |
| **S3** — MVP Hybride Standard | A2 | Standard | C-mix | P1+P2 | **220-280** | 18-24 semaines |
| **S4** — Plateforme Sortie Payload Full (recommandé P3) | A3 | Full | C-mix | P1+P2+P3 | **420-520** | 36-44 semaines |
| **S5** — Plateforme Payload Hybride Full (variante défendue) | A2 | Full | C-mix | P1+P2+P3 | **380-470** | 32-40 semaines |
| **S6** — Composite Custom + Grist Veille (variante allégée) | A3 + A4 | Full | C-mix | P1+P2+P3 | **400-500** | 34-42 semaines |

**Lecture** : les paliers sont cumulatifs. S3 = S2 + ajouts P2. S4/S5/S6 = S3 + ajouts P3.

**S6** = S4 avec le bloc 2 Veille externalisé en Grist (Suite numérique de l'État). Économie ~15-25 j/h vs S4 ; voir §5.8 pour le détail et §11 pour l'analyse Grist.

**Delta C2-strict partout** : **+12 à +18 %** sur chacun des totaux (pour appliquer hexagonal sur les contextes Generic, ce qui apporte peu de valeur — non recommandé).

### 5.3. Détail S1 — POC Payload-custom Lite

| Module | j/h | Notes |
|---|---|---|
| Setup foundation | 3-5 | Reprise du POC actuel |
| M1 Wizard (sur Payload) | 25-35 | ⚠️ Lutte contre Payload, qualité UX dégradée |
| M2 Tableau de bord (sur Payload) | 10-15 | Payload List View customisée |
| M3 Import CSV | 12-18 | Logique de parsing + workflow |
| T1 ProConnect (Payload custom strategy) | 8-12 | Strategy OIDC custom |
| T3 Observabilité (Sentry seul) | 2-3 | Minimum vital |
| T4 DSFR (sur Payload) | 12-18 | Approximatif, RGAA partiel |
| T7 Tests | 8-12 | Unit + integ |
| **Total S1** | **80-118** | |

**Risque** : dette technique forte (le wizard sur Payload n'est pas tenable à terme).

### 5.4. Détail S2 — POC Hybride Lite (recommandé P1)

| Module | j/h | Notes |
|---|---|---|
| Setup foundation Hybride | 10-15 | App `apps/recap` Next.js + libs partagées NX |
| M1 Wizard (Next.js + DSFR + react-hook-form + zod) | 18-25 | Parcours propre, DDD C2 |
| M2 Tableau de bord (Next.js + DSFR) | 8-12 | |
| M3 Import CSV (Next.js + workers) | 12-18 | |
| T1 ProConnect (next-auth + bridge Payload) | 6-8 | Standard OIDC |
| T2 API publique versionnée (foundation) | 3-5 | Squelette OpenAPI |
| T3 Observabilité (Sentry + audit log léger) | 4-6 | |
| T4 DSFR (composants natifs) | 8-12 | RGAA AA partiel acquis |
| T7 Tests (unit + integ + E2E parcours wizard) | 12-18 | |
| **Total S2** | **81-119** | |

**Bénéfice** : socle réutilisable, RGAA AA quasi-acquis, ProConnect propre.

### 5.5. Détail S3 — MVP Hybride Standard (S2 + ajouts P2)

| Module | j/h | Notes |
|---|---|---|
| *Total S2 (P1)* | *81-119* | |
| M4 Import API REST | 8-12 | Endpoints versionnés, clés API, rate limit |
| M5 Import scraping RSS | 10-15 | Worker pg-boss / BullMQ |
| M6 Workflow validation post-import | 3-5 | Extension `WorkflowTransitionPolicy` |
| M7 Outil de veille | 12-18 | Catalogue consolidé + commentaires |
| M8 Pilotage basique | 18-25 | Read-models, Postgres MV, dashboards Recharts |
| T2 API publique versionnée (consolidée pour MuleSoft) | 7-10 | Contrat versionné, doc OpenAPI |
| T3 Observabilité (Prom/Grafana + Matomo) | 8-12 | Ajout métriques techniques |
| T5 RGAA AA (audit + corrections) | 5-10 | Sur app DSFR |
| T6 Sécurité (DPIA basique, OWASP cheatsheet) | 4-6 | |
| T7 Tests (extension) | 10-15 | E2E import, workflow |
| **Total S3** | **166-247** | borne haute si rigueur audit |

**Bénéfice** : MVP déployable en pilote opérateur (CMA Grand Est), couvert observabilité + sécurité raisonnable.

### 5.6. Détail S4 — Plateforme Sortie Payload Full (S3 + ajouts P3 + sortie Payload)

| Module | j/h | Notes |
|---|---|---|
| *Total S3 (P1+P2 en Hybride)* | *166-247* | |
| **Sortie Payload** | | |
| Migration schéma (Drizzle/Prisma) | 12-18 | `payload-types.ts` → schéma Drizzle |
| Migration données | 6-10 | Script de migration unique, idempotent |
| Réécriture repositories (PayloadAideRepository → PostgresAideRepository) | 15-22 | Facilité par C-mix : substitution adapter |
| Réécriture admin super-admin (Refine ou pages custom) | 25-35 | Si conservé, sinon 0 |
| Décommissionnement Payload | 3-5 | |
| **Modules P3** | | |
| M9 Démarchage (leads enrichis Sirene + Annuaire) | 18-25 | Workers d'enrichissement async |
| M8 Pilotage avancé (cohortes, comparaisons nationales) | 10-15 | Extension read-models |
| T2 API publique (durcissement, SLA) | 5-8 | Cache HTTP, ETags, idempotency keys |
| T3 Observabilité (PostHog OSS + audit log RGPD complet) | 10-15 | |
| T5 RGAA AA (audit externe + corrections) | 8-12 | Audit cabinet externe + 2 itérations |
| T6 Sécurité (pen-test externe + DPIA Démarchage + corrections) | 10-15 | |
| T7 Tests (extension E2E + accessibilité automatisée) | 12-18 | axe-core dans CI |
| **Total S4** | **300-445** | |

**Bénéfice** : plateforme alignée aux exigences État (RGAA AA validé, pen-test, DPIA), souveraine, indépendante de Payload.

### 5.7. Détail S5 — Plateforme Payload Hybride Full (variante défendue)

Identique à S4 **sans** le bloc « Sortie Payload ».

| Module | j/h |
|---|---|
| *Total S3 (P1+P2 en Hybride)* | *166-247* |
| M9 Démarchage | 18-25 |
| M8 Pilotage avancé | 10-15 |
| T2 API publique (durcissement) | 5-8 |
| T3 Observabilité avancée | 10-15 |
| T5 RGAA AA (audit externe) | 8-12 |
| T6 Sécurité (pen-test + DPIA) | 10-15 |
| T7 Tests (extension) | 12-18 |
| Maintien Payload (dette accumulée, upgrades) | 10-15 |
| **Total S5** | **249-370** |

**Conditions de viabilité de S5** :
- L'équipe reste à 2 devs (l'overhead Payload reste gérable)
- Pas d'évolution majeure du wizard (le verrouillage A2 est stable)
- L'écosystème DSFR-Payload progresse (ou on accepte la dette UI)
- Pas de besoin d'admin super-admin riche (le module Veille couvre l'essentiel)

**Risque** : dette technique latente. Si l'un des modules de P3 force un refactor profond, on bascule en S4 avec un surcoût rétroactif (+30-40 % du delta S4-S5).

### 5.8. Détail S6 — Composite Custom + Grist Veille (variante allégée de S4)

S6 = S4 avec le module M7 (Veille) externalisé en Grist + sync webhooks. Le reste de la stack est identique à S4 (Custom Next.js + Postgres + DSFR + ProConnect).

| Module | j/h S4 | j/h S6 | Notes |
|---|---|---|---|
| *Total S3 (P1+P2 en Hybride)* | *166-247* | *166-247* | Identique |
| Sortie Payload (P3) | 61-90 | 61-90 | Identique |
| M9 Démarchage | 18-25 | 18-25 | Identique |
| M8+ Pilotage avancé | 10-15 | 10-15 | Identique |
| **M7 Veille** | **(inclus S3)** | **3-6 (Grist) + 5-8 (sync)** | Externalisation Grist |
| **Setup Grist** (workspaces, ACL, fixtures) | — | **3-5** | Coût ajouté |
| **T1 ProConnect** (factorisation) | 6-8 | 4-6 | Économie marginale (auth partagée) |
| T2-T7 transverses (P3) | 45-77 | 45-77 | Identique |
| **Total S6** | **300-445** | **285-420** | **-15 à -25 j/h** |

**Bénéfice** : économie nette ~10-25 j/h (1-3 semaines de 2 devs) + outil familier aux pilotes SGPE + hébergement SecNumCloud gratuit pour la Veille.

**Conditions de viabilité de S6** :
- Acceptation par les pilotes SGPE d'un outil Grist hébergé sur la Suite numérique (à valider en amont)
- Sync unidirectionnel Postgres → Grist (Grist en lecture + commentaires ; les éditions structurelles restent dans RÉCAP)
- Pas de PII dans Grist (le bloc 4 Démarchage reste exclusivement dans RÉCAP)
- Périmètre Veille stable (si la Veille évolue vers de l'édition forte ou de l'analytics complexe, on rebascule en Custom)

**Risque** : couplage à un outil tiers (Grist Suite numérique). Mitigation : la source de vérité reste Postgres, Grist est un consommateur ; le rapatriement dans Custom est ~3-6 j/h si nécessaire.

---

## 6. Le point de bascule Payload — analyse argumentée

### 6.1. Les 5 signaux

| # | Signal | Poids | Statut actuel |
|---|---|---|---|
| 1 | **UX wizard custom** (parcours non-formulaire) | Élevé | ⚠️ Déjà critique dès P1 |
| 2 | **DSFR obligatoire** | Élevé | ⚠️ Déjà critique dès P1 |
| 3 | **ProConnect OIDC** | Moyen | ⚠️ Déjà critique dès P1 |
| 4 | **Multi-tenant + visibilité hiérarchique** | Moyen | Acceptable jusqu'à P2 |
| 5 | **Tracking & analytics (read-models, projections)** | Moyen | Devient critique en P3 |

**Conclusion** : les signaux 1, 2, 3 sont **déjà déclenchés en P1**. C'est pourquoi le scénario S1 (Payload-custom) n'est pas recommandé même pour un POC sérieux. La bascule vers **A2 (Hybride)** est rationnelle dès le départ.

### 6.2. Quand basculer A2 → A3 ?

Critères concrets (à ré-évaluer trimestriellement) :

| Critère | Seuil de bascule |
|---|---|
| Ratio code Next.js / code Payload | < 30 % de code dans `apps/cms` |
| Nombre de modules nécessitant des hooks Payload custom | > 5 |
| Fréquence des conflits entre conventions Payload et besoins métier | > 1 par sprint |
| Pression réglementaire (audit RGAA, pen-test) | Audit externe planifié |
| Évolutions Payload (breaking changes) | Une montée de version majeure annuelle bloquante |

**Si ≥ 3 critères dépassent les seuils, la bascule A3 devient un investissement rentable.**

### 6.3. Trajectoire recommandée (S2 → S3 → S4)

```
P1 (3-4 mois)   S2: Hybride Lite               81-119 j/h
                ─────────────────────────────────────────
                ↓ P2 ajouts
P2 (3-5 mois)   S3: Hybride Standard           +85-128 j/h
                ─────────────────────────────────────────
                ↓ P3 ajouts + bascule
P3 (6-9 mois)   S4: Sortie Payload Full        +135-198 j/h
                ─────────────────────────────────────────
                                       Total : 300-445 j/h
```

### 6.4. Variante défendue (S2 → S3 → S5)

Reste en Hybride jusqu'au bout. **Recommandé si** :
- L'équipe reste à 2 devs sur la durée
- Les exigences RGAA AA sont jugées « best-effort » et non « audit certifié »
- Le pen-test ne révèle pas de problème lié à Payload

```
P3 (6-9 mois)   S5: Hybride Full Plateforme    +83-123 j/h
                ─────────────────────────────────────────
                                       Total : 249-370 j/h
```

**Économie S5 vs S4** : ~50-75 j/h (la sortie Payload coûte cher mais a un ROI long terme). **Risque S5** : dette latente, refactor coûteux si une exigence force la bascule plus tard.

---

## 7. Recommandation

### 7.1. Trajectoire principale recommandée : S2 → S3 → S4

**Justifications** :

1. **A2 dès P1** est imposé par 3 signaux déjà critiques (wizard, DSFR, ProConnect). S1 est un cul-de-sac.
2. **C-mix** offre le meilleur ratio rigueur/coût pour une équipe 2-3 devs sur 12-18 mois.
3. **Sortie Payload en P3** valorise les exigences plateforme État (RGAA AA audit, pen-test, DPIA, souveraineté complète).

### 7.2. Variante défendue : S5

S5 reste viable et défendable si :
- L'arbitrage budgétaire impose ≤ 350 j/h totaux
- L'équipe reste à 2 devs
- Le pen-test ne révèle pas de problème bloquant côté Payload
- Le module Veille satisfait les pilotes nationaux (pas besoin d'admin riche supplémentaire)

### 7.2 bis. Variante allégée : S6 (Composite Custom + Grist Veille)

S6 = S4 avec le bloc 2 Veille externalisé en Grist. Recommandé si :
- Les pilotes SGPE acceptent / privilégient un outil de la Suite numérique de l'État
- La Veille reste un outil de consultation + commentaires (pas d'édition structurelle complexe)
- On veut maximiser la souveraineté sur la couche outillage (Grist = SecNumCloud, code source ouvert)
- Économie nette ~15-25 j/h vs S4 (~10k-17k €) tout en conservant l'autonomie technologique sur les blocs critiques (1, 3, 4)

### 7.3. Hors-périmètre que je recommande d'ajouter

À discuter avant validation finale :

- **Performance budget** : objectifs LCP < 2.5s, INP < 200ms ; budget vérifié en CI (Lighthouse-CI)
- **Feature flags** (Unleash OSS ou flags maison) — utile dès P2 pour rolling deployment multi-opérateurs
- **Disaster recovery** : sauvegardes Postgres (PITR via Scalingo), RTO/RPO documentés
- **Documentation utilisateur** : guides opérateurs (Markdown + screenshots), helpdesk minimal

---

## 8. Risques & mitigations

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Contrat MuleSoft tardif ou changeant | Moyen | Élevé | Définir un contrat d'événements minimal dès P1, mock dans `libs/mulesoft-mock` |
| R2 | ProConnect non disponible pour usage non-régalien | Faible | Élevé | Plan B : email auth + RGPD whitelist d'agents |
| R3 | Quota Sirene INSEE dépassé sur enrichissement leads | Moyen | Moyen | Cache long + fallback Annuaire Entreprises |
| R4 | Audit RGAA AA en P3 révèle régressions | Moyen | Moyen | Tests axe-core dans CI dès P1, audit blanc en milieu P2 |
| R5 | Pen-test révèle vulnérabilité critique | Faible | Élevé | Threat-modeling en P2, formation OWASP équipe, dépendabot agressif |
| R6 | Dette technique Payload accumulée (sur S5) | Élevé sur S5 | Moyen | Ré-évaluer trimestriellement les critères de bascule (§6.2) |
| R7 | Équipe à 1 dev (départ, congé) | Moyen | Élevé | Pair-programming + revues croisées + documentation à jour |
| R8 | Volumétrie réelle dépasse cible (10x) | Faible | Moyen | Read-models déjà conçus = bascule ClickHouse possible sans refactor du domain |

---

## 9. Hypothèses & limites du chiffrage

- Chiffrages en **j/h équipe** ±15-20 %. Précision ne dépassera pas ±25 % tant que le détail des écrans n'est pas finalisé.
- Le calibrage senior full-stack n'est valide que pour une équipe à compétence homogène. Un mix senior/mid imposera un coefficient +20-30 % sur l'effort.
- L'effort « management » (chefferie de projet, suivi, points clients) n'est **pas inclus** — comptez +15-20 % pour cela.
- L'infrastructure (DevOps, déploiement, monitoring infra) est intégrée dans T3 mais pas l'effort SRE en cas d'incident répétitif.
- Pas d'effort de **migration de l'existant** chiffré au-delà du strict POC actuel.

---

## 10. Prochaines étapes

1. **Valider la trajectoire principale** (S2 → S3 → S4), la variante S5 ou la variante allégée S6 (composite Grist Veille)
2. **Confirmer les hypothèses de volumétrie** (≤ 50 opérateurs, ~500 aides) auprès du SGPE
3. **Cadrer le contrat MuleSoft** dès le démarrage P1 (mock initial, contrat final fin P1)
4. **Définir les KPIs Pilotage** avec le SGPE avant le démarrage P2 (lever l'ambiguïté sur les comparaisons « vs nationale »)
5. **Valider l'usage de Grist pour la Veille** auprès du SGPE (pré-requis S6 — §11)
6. **Lancer le sprint 0** : choix outillage (Drizzle vs Prisma, BullMQ vs pg-boss, Recharts vs Tremor)

---

## 11. Analyse Grist — viabilité par bloc fonctionnel

### 11.1. Contexte

[Grist](https://www.getgrist.com/) est un outil collaboratif de feuille de calcul relationnelle open-source, distribué via la [Suite numérique de l'État](https://lasuite.numerique.gouv.fr/produits/grist) :
- Hébergement SecNumCloud, gratuit pour agents publics de l'administration centrale et opérateurs d'État
- ProConnect natif
- Adopté par 15 ministères, ~15 000 agents (ANCT, CNIL, CNRS, MAE…)
- Homologué DINUM
- Open-source ([gristlabs/grist-core](https://github.com/gristlabs/grist-core))

La question : **Grist peut-il remplacer Payload dans le RÉCAP, en tout ou en partie ?**

### 11.2. Forces structurelles

| Atout | Pertinence RÉCAP |
|---|---|
| Hébergement SecNumCloud gratuit pour agents publics | Réponse directe à §1.4 (souveraineté) |
| ProConnect natif intégré | Élimine 6-12 j/h de T1 selon scénario |
| ACL granulaires (jusqu'à ligne et colonne) | Couvre nativement la matrice de droits 4 rôles ([Gestion des droits](../sources/Gestion%20des%20droits%203056523d57d780a8bce0c5aef392bac1.md)) |
| Formules Python + API REST + webhooks | Suffit pour M3, M4, M6 basique |
| Adoption institutionnelle | Légitimité forte côté SGPE / DINUM |
| Open-source + auto-hébergeable + SQLite portable | Pas de lock-in fournisseur |
| Setup quasi-immédiat | Bloc 2 Veille opérationnel en quelques heures |

### 11.3. Limites bloquantes (B = Bloquant)

| # | Limite | Bloc impacté | Source |
|---|---|---|---|
| B1 | **RGAA AA non conforme** déclaré | Tous blocs si Grist = stack complète | Mentions légales [lasuite.numerique.gouv.fr/produits/grist](https://lasuite.numerique.gouv.fr/produits/grist) |
| B2 | **Pas de wizard multi-étapes** — UI Grist = grille/formulaire | Bloc 1 (M1) | §2.3 M1 |
| B3 | **SQLite par document** — plafond volumétrique | Bloc 3 (M8+) | §2.3 M8, cible 10k entreprises/mois |
| B4 | **Pas d'API publique versionnée OpenAPI** | T2 (MuleSoft) | §2.2 T2 |
| B5 | **Pas de moteur de workflow** — simulable mais non robuste | M6, ADR 0005 | §2.3 M6 |
| B6 | **DPIA + workers d'enrichissement async hors scope** | Bloc 4 (M9) | §2.3 M9, RGPD |
| B7 | **Pas de richText/médias structurés** | Programs/Projects | ADR 0001, 0003 |
| B8 | **Pas de ports/adapters DDD natifs** | §4 architecture interne | §4.3 bounded contexts |

### 11.4. Analyse par bloc fonctionnel

#### Bloc 1 — Gestion autonome des aides

| Module | Grist | Verdict |
|---|---|---|
| M1 Wizard 5 étapes DSFR | ❌ N/A | Bloquant B2 |
| M2 Tableau de bord | ✅ 2-4 j/h (vue native) | Excellent |
| M3 Import CSV | ✅ 1-3 j/h (natif) | Excellent |
| M4 Import API REST | ⚠️ 5-8 j/h (transformation externe) | Limité (B4 sur l'API exposée) |
| M5 Import scraping RSS | ⚠️ 8-12 j/h (cron externe → API Grist) | Limité (orchestration externe) |
| M6 Workflow validation | ⚠️ 4-7 j/h (colonnes + ACL) | Dégradé (B5) |

**Verdict bloc 1** : Grist échoue sur M1 (wizard). **Non viable comme stack pour ce bloc.**

#### Bloc 2 — Veille pour les opérateurs

| Module | Grist | Verdict |
|---|---|---|
| M7 Outil de veille | ⭐ **3-6 j/h** | Excellent — cas d'usage natif |

**Verdict bloc 2** : Grist est **le meilleur outil** pour M7. Catalogue éditable + filtres + commentaires + ACL fines = exactement ce qu'il fait nativement. Économie ~10 j/h vs Custom Next.js.

#### Bloc 3 — Pilotage des aides

| Module | Grist | Verdict |
|---|---|---|
| M8 Pilotage basique | ⚠️ 18-30 j/h (formules Python + widgets) | Faisable mais plafond proche |
| M8+ Pilotage avancé | ❌ N/A | Bloquant B3 (SQLite/doc, pas de MV) |

**Verdict bloc 3** : Grist tient pour M8 basique sur faible volumétrie, mais **non viable pour M8+** à la cible (~10k entreprises trackées/mois).

#### Bloc 4 — Aide au démarchage des entreprises

| Module | Grist | Verdict |
|---|---|---|
| M9 Démarchage | ❌ N/A | Bloquant B6 (DPIA, workers, audit RGPD) |

**Verdict bloc 4** : Grist non viable. Le module exige DPIA RGPD complet, workers d'enrichissement async Sirene/Annuaire avec gestion de quota, exports CSV auditables.

### 11.5. Scénarios d'usage Grist recommandés

#### Usage 1 — Amorçage P1 (pré-S2 ou pré-S4)

**Objectif** : valider l'appétence opérateurs et cadrer les KPIs SGPE avant d'engager le développement.

- Effort : ~10-20 j/h
- Périmètre : catalogue d'aides en table Grist, ACL par opérateur, workflow simulé, ProConnect natif
- Résultat : démonstrateur jetable

**Limite** : pas de réutilisation du code Grist en S2/S4. C'est un test d'appétence, pas un socle.

#### Usage 2 — Bloc 2 Veille en production (scénario S6)

**Objectif** : externaliser M7 vers Grist, garder la stack Custom Next.js (S4) sur les blocs 1, 3, 4.

- Effort : économie nette ~15-25 j/h vs S4 (cf. §5.8)
- Sync unidirectionnel Postgres → Grist (webhooks)
- Pas de PII dans Grist

**Voir §5.8 pour le chiffrage complet de S6.**

#### Usage 3 — Curation super-admin en S4

**Objectif** : remplacer l'admin super-admin custom (Refine / pages custom) par Grist pour la curation interne ADEME/SGPE.

- Effort : économie ~15-25 j/h sur les 25-35 j/h prévus dans S4 pour la réécriture admin super-admin
- Curation ponctuelle, débogage, gestion d'opérateurs
- ACL Grist suffit pour le périmètre interne ADEME

### 11.6. Recommandation Grist

| Question | Réponse |
|---|---|
| Grist peut-il remplacer Payload comme stack complète ? | ❌ Non — bloque sur M1, M8+, M9, B1 (RGAA), B4 (API versionnée) |
| Grist est-il pertinent comme outil ciblé ? | ✅ Oui — excellent pour M7 (Veille) et curation super-admin |
| Faut-il introduire Grist dès maintenant ? | ✅ Oui en amorçage P1 (jetable) + intégrer dans S6 si SGPE valide |

**Recommandation** : retenir **S6 comme alternative à S4** sur la table de scénarios, à arbitrer avec le SGPE en fonction de leur préférence pour la Suite numérique de l'État sur la Veille.

---

*Document vivant — à ré-évaluer à chaque fin de palier.*
