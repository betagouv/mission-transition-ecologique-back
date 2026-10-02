# ADR 0014 : Format pivot, persistance et API des projets

**Date :** 2026-10-01
**Statut :** Accepté, mis en œuvre le 2026-10-01 (voir « Révisions » en fin de document). **§6 et §7 révisés le 2026-10-02** : le CMS est le seul écrivain du store, les redirections et les retraits y sont suivis
**Décideurs :** Yohann
**Plan de mise en œuvre :** [Feature 008 : Format pivot et API des projets](../features/008-canonical-projects.md)
**Complète :** [ADR 0003](0003-projects-collection.md) (collection `Projects`), [ADR 0007](0007-canonical-pivot-format.md) (format pivot), [ADR 0008](0008-canonical-persistence-ddd.md) (persistance du canonical, DDD), [ADR 0012](0012-production-persistence-postgres.md) (schéma `canonical`, pipeline quotidien)

---

## Contexte

Les dispositifs disposent d'une chaîne complète : format pivot (`libs/canonical`), store PostgreSQL indépendant de Payload (`libs/canonical-store`, schéma `canonical`), synchronisation depuis le CMS à la publication, import quotidien depuis le dépôt amont, et API publique pour AGIR. Les projets, eux, ne vivent que dans la collection Payload `Projects` : aucune donnée durable hors du CMS, aucune API.

AGIR (ADEME) doit pouvoir lire les projets comme il lit les dispositifs. L'ADR 0008 avait anticipé ce besoin en nommant les briques par entité (`CanonicalProgramService`, « pour préparer un futur `CanonicalProjectService` »).

Constats (2026-10-01) :

- `Projects` n'a ni workflow, ni brouillon, ni identité stable (`canonicalId`) ;
- l'amont (`projects.json`, 91 projets) porte des données absentes de Payload : une FAQ (`titleFaq`, `faqs`, 11 projets) et une priorité par secteur (`priority`, 91 projets, clés `default`, sections NAF et codes NAF) ;
- l'amont publie 6 redirections de projets (`project_redirects`), dont un ancien slug non kebab-case ;
- `linkedProjects` amont référence les projets par un `id` numérique propre au fichier ;
- aucune spécification AGIR n'existe pour les projets ; le format « détail R2DA » est propre aux dispositifs.

## Décision

### 1. Un pivot par entité, dans le même domaine

Le projet reçoit son propre modèle dans `libs/canonical/src/canonical-project/`, calqué sur `canonical-program/` : schéma zod racine (source de vérité), types inférés, value object immuable `CanonicalProject`, `CanonicalProjectValidator`, port `CanonicalProjectRepository`, service `CanonicalProjectService`. Clés en français `snake_case`, comme le reste du pivot (ADR 0007).

Champs : `id`, `slug`, `source`, `date_mise_a_jour`, `statut_projet`, `remplace_par`, `titre`, `nom_court`, `description_courte`, `image`, `description_longue`, `description_complementaire`, `theme_principal`, `themes`, `secteurs`, `priorite`, `dispositifs`, `projets_lies`, `faq`, `seo`. Référence complète : `docs/context/canonical-project-format.md`.

Ce qui est réellement commun aux deux entités est partagé, pas dupliqué :

- le diff et le garde-fou d'alignement sur un snapshot amont (`CanonicalSnapshotPlan`, `CanonicalSnapshotGuard`), rendus génériques et déplacés dans `libs/canonical/src/snapshot/` (le garde-fou reçoit un libellé d'entité, pour que le rejet d'un snapshot de projets parle de « projet ») ;
- la taxonomie des thèmes (`themeSchema`), déplacée dans `src/shared/schema/`.

Le schéma est une garde de forme. Il accepte un objet optionnel vide (`priorite: {}`, `projets_lies: { projets: [] }`), ne rogne pas le Markdown et retire en silence les clés inconnues : c'est aux mappers de ne pas écrire un bloc vide. Ses sous-schémas (`projetImageSchema`, `projetDescriptionSchema`, `projetPrioriteSchema`, `projetsLiesSchema`, `projetFaqSchema`, `projetSeoSchema`) sont exportés, et réutilisés par le garde-fou de l'export AGIR (§10).

Options écartées :

- **Un service et un repository génériques (`CanonicalEntityService<T>`)** : les validateurs, les événements d'observabilité et les règles propres (statuts, redirections) diffèrent ; deux services courts et lisibles valent mieux qu'une abstraction paramétrée par cinq types.
- **Un champ `projets` dans le pivot des dispositifs** : la liaison appartient aux projets (feature 005), et un projet a un cycle de vie propre.

### 2. Persistance : une table dédiée, une seule connexion

Nouvelle table `canonical.canonical_projects` (`canonical_id`, `slug` unique, `data` en texte JSON, `updated_at`), créée par `ensureCanonicalSchema` à côté de `canonical_programs`. `DrizzleCanonicalProjectRepository` implémente le port ; `createCanonicalProjectRepository()` résout l'URL comme pour les dispositifs.

La connexion est **mémoïsée par URL** (`createCanonicalDb`) : les deux repositories partagent un seul pool (`max: 3`). Sans cela, le store ouvrirait deux pools à côté de celui de Payload, sur un addon qui plafonne les connexions (ADR 0012). Une connexion qui échoue n'est pas gardée en cache : son pool est fermé et l'appel suivant réessaie. La même règle vaut côté CMS pour les quatre singletons qui exposent repositories et services (`RetryableMemo`) : une promesse rejetée est oubliée, sans quoi un seul échec au démarrage bloquerait la synchronisation et les endpoints AGIR jusqu'au redémarrage du process.

**Un slug, une ligne.** `slug` est unique dans la table, et les deux écrivains (§7) n'adressent pas toujours la même ligne : un projet créé dans l'admin porte un identifiant aléatoire, l'import amont un identifiant dérivé du slug. À l'écriture, le repository retire donc d'abord, dans la même transaction, la ligne qui détient le slug sous un autre identifiant, et émet `project_removed` pour elle. Une écriture ne bute jamais sur l'unicité du slug. `delete` renvoie un booléen, et le service n'émet `project_removed` que si une ligne a réellement été retirée. Les dispositifs suivent la même règle.

Les deux repositories sont deux classes distinctes, sans classe de base commune : le typage Drizzle d'une table passée en paramètre alourdissait le code plus que la duplication (une centaine de lignes).

Option écartée : **une table unique `canonical_entities` avec une colonne de type**. Elle mélangerait deux contrats de validation, compliquerait l'unicité du slug et rendrait le retrait d'une entité plus risqué.

### 3. Publication : brouillons Payload, seuls les projets publiés sont dans le pivot

> **Révisé le 2026-10-02** : les projets suivent le workflow des dispositifs. `workflowStatus` pilote `_status`, `ProjectCanonicalSyncPolicy` est supprimée au profit de `CanonicalSyncPolicy`, et il n'y a plus de « dépublication » : un projet sort du pivot en passant à `annule`. Voir la révision en fin de document.

Les brouillons natifs de Payload sont activés sur `Projects` (`versions: { drafts: true }`). La règle de synchronisation est portée par `ProjectCanonicalSyncPolicy` :

| Situation | Action sur le pivot |
|---|---|
| Projet publié | écrit |
| Brouillon enregistré par-dessus une version publiée | inchangé : la version publiée reste servie |
| Projet dépublié, ou jamais publié | retiré |
| Projet supprimé | retiré |

Le pivot ne porte donc pas de statut éditorial (`statut_edition`) : tout projet stocké est publié. Il porte un statut de cycle de vie, `statut_projet` (`valide` ou `remplace`), pour les redirections (§6).

La migration passe les projets existants en `published` : rien ne disparaît de l'API au déploiement. Elle leur crée aussi une version publiée dans `_projects_v` : la liste de l'admin lit la dernière version de chaque document, et un projet sans version n'y apparaîtrait plus.

Le hook calcule l'action **avant** tout retrait. Pour un brouillon, il relit le document principal (`draft: false`) : s'il est encore `published`, l'action est « inchangé » et rien n'est touché, pas même la ligne d'un ancien `canonicalId`.

Chaque enregistrement d'un brouillon jamais publié passe par cette relecture et par un `DELETE` qui ne retire rien. Ce coût (une lecture par clé primaire, une suppression à vide) est laissé tel quel : `previousDoc._status` n'est pas un discriminant fiable sur une mise à jour, et le seul garde sûr, limité à la création, n'épargnerait que le premier enregistrement. Aucun événement n'est émis dans ce cas.

Options écartées :

- **Tous les projets dans le pivot, sans statut** : conforme à l'amont, mais un projet en cours de rédaction dans le CMS serait exposé à AGIR dès son premier enregistrement.
- **Le workflow à neuf états des dispositifs** (ADR 0005) : disproportionné pour des fiches éditoriales sans relecture ni rôles dédiés.
- **Un champ `select` maison (`brouillon`/`publié`)** : il faudrait reconstruire ce que Payload fournit (version publiée conservée pendant une réécriture, historique).

### 4. Identité : `canonicalId` et identifiant dérivé du slug

`Projects` reçoit un champ `canonicalId` (cuid2, masqué dans l'admin, verrouillé par l'API), posé par le hook `assignCanonicalId` déjà utilisé par les dispositifs, déplacé dans `hooks/shared/`.

Les écritures de confiance (seed, import amont) posent `SlugCanonicalId.forProject(slug)`, dérivé de la chaîne `project:<slug>`. Les deux écrivains adressent ainsi la même ligne du store, et un projet ne partage jamais l'identifiant d'un dispositif de même slug.

Le champ `canonicalId` porte `disableDuplicate: true`, sur `Projects` comme sur `Programs`. Sans cette option, l'action « Dupliquer » de l'admin donne à la copie l'identifiant `<id> - Copy` (comportement par défaut de Payload pour un champ texte unique) : invalide pour le pivot, masqué et immuable, donc un document jamais synchronisé. La copie reçoit un cuid2 neuf.

Une copie ne reprend ni l'identité ni l'état de publication de l'original. Elle est toujours créée en brouillon (hook `duplicateAsDraft`, qui force `draft: true` sur toute duplication, par l'admin, l'API REST ou la Local API) et reçoit un slug kebab-case libre, `<slug>-copy` puis `<slug>-copy-2`... (hook `assignCopySlug`), au lieu du `<slug> - Copy` de Payload que le pivot refuse. Pour un dispositif, les champs de workflow (`workflowStatus`, `workflowHistory`, `replacedBy`, `lastModifiedBy`, `assignedContributors`) portent `disableDuplicate: true` : la copie repart en `en-creation`. Elle n'entre dans le pivot qu'à sa publication, sous son propre identifiant.

Les références entre entités (`dispositifs`, `projets_lies.projets`, `remplace_par`) sont des **identifiants pivot**, pas des slugs : elles survivent à un renommage. L'export les résout en slugs.

### 5. FAQ et priorité par secteur entrent dans Payload

Le pivot étant alimenté par le CMS, une donnée absente de Payload serait perdue à chaque enregistrement. `Projects` reçoit donc :

- `titleFaq` et `faqs` (array : `question` texte, `answer` rich text) ;
- `defaultPriority` et `sectorPriorities` (array : `nafCode` texte validé, `priority` nombre).

Dans le pivot : `faq { titre?, questions[{ question, reponse }] }` et `priorite { defaut?, mise_en_avant?, par_secteur[{ code_naf, priorite }] }` (`mise_en_avant` porte `highlightPriority`).

**Ce que l'admin accepte, le pivot l'accepte.** Un projet que le pivot refuse est seulement journalisé (`project_dropped`) : l'éditeur voit un succès, et l'ancienne version reste servie. Les règles du pivot qu'une saisie peut enfreindre sont donc portées par la collection, avec un message sur le champ :

- `slug` : kebab-case, `SlugValidator`, qui délègue à `slugSchema` du pivot (posé aussi sur `Programs.slug`, les 276 slugs amont étant tous kebab-case) ;
- `highlightPriority`, `defaultPriority`, `sectorPriorities.priority` : entiers positifs ou nuls, `IntegerValidator.nonNegative` (qui respecte le caractère requis du champ) ;
- `nafCode` : `NafCodeValidator`, qui délègue à `nafCodeSchema` et contrôle la valeur **brute**, celle que Payload enregistre (un code suivi d'un espace est refusé) ;
- textes requis (`title`, `nameTag`, `shortDescription`, `faqs.question`) : `RequiredTextValidator`, qui refuse aussi une valeur faite seulement d'espaces. Le contrôle natif de Payload l'accepte, alors que le pivot rogne le texte puis refuse le projet ;
- rich texts requis (`longDescription`, `faqs.answer`) : `RequiredRichTextValidator`, qui refuse un contenu dont la conversion Markdown est vide (espaces, plusieurs paragraphes vides). Le contrôle natif ne repère qu'un paragraphe vide unique. « Vide » est décidé par le convertisseur du pivot lui-même, les deux ne peuvent donc pas diverger.

Les mêmes validateurs sont posés sur les champs requis de `Programs` (`title`, `promise`, `otherCriteria.value`, `description`, `steps.description`).

Comme toute validation Payload, ces contrôles sont relâchés à l'enregistrement d'un brouillon et s'appliquent à la publication. Les données existantes ne sont pas rognées : un texte entouré d'espaces reste enregistré tel quel.

Options écartées :

- **Champ `json` pour la priorité** : inéditable proprement dans l'admin, non validé.
- **Pivot seul, alimenté par l'import amont** : le hook CMS écraserait ces champs, ou devrait fusionner avec la ligne stockée, ce qui ferait du store une seconde source de saisie.

### 6. Redirections : tombstones, comme les dispositifs

`ProjectRedirects` lit `project_redirects` ; `ProjectTombstoneBuilder` produit, pour chaque ancien slug dont le projet courant existe, un projet `remplace` : marqué en place s'il existe encore, sinon synthétisé en clonant le projet courant sous l'ancien slug (`remplace_par` = identifiant du projet courant). Un ancien slug non kebab-case est gardé tel quel, autorisé seulement sur un projet remplacé. Une redirection dont la cible manque est ignorée et journalisée.

Les tombstones ne sont produits que par l'import amont direct : `Projects` n'a pas de champ « remplacé par ».

> **Révisé le 2026-10-02** : `Projects` porte `workflowStatus` et `replacedBy`, et les redirections deviennent des projets `remplace` du CMS, écrits par le seed et par la sync quotidienne. Voir la révision en fin de document.

Options écartées :

- **Liste `anciens_slugs` sur le projet courant** : plus légère, mais elle ne permet pas à un consommateur qui détient un ancien slug d'obtenir une réponse explicite « remplacé par ».
- **Ignorer les redirections** : un ancien slug répondrait 404 sans indication.

### 7. Deux écrivains, l'amont maître

> **Révisé le 2026-10-02** : il n'y a plus qu'un écrivain. La tâche quotidienne écrit dans le CMS, et le store ne reçoit plus que ce que les hooks lui envoient. `import:projects` sort du pipeline et reste un outil de secours. Les divergences listées ci-dessous disparaissent. Voir la révision en fin de document.

Comme pour les dispositifs (ADR 0012) :

- **hooks CMS** `syncProjectCanonicalOnChange` (afterChange) et `removeProjectCanonicalOnDelete` (afterDelete), qui ne bloquent jamais l'écriture CMS et émettent leurs résultats par le port `CanonicalEventSink` (`project_saved`, `project_removed`, `project_dropped`, `sync_failed`) ;
- **import quotidien direct** `import:projects --remote`, ajouté **en fin de pipeline**, après l'export Grist : lecture HTTP de l'amont, alignement du store par `CanonicalProjectService.applySnapshot`, garde-fou contre un snapshot vide ou trop destructeur. Le pipeline est un enchaînement `&&` : placé en dernier, un échec de l'import des projets ne fige pas l'open data Grist des dispositifs.

L'import écrase ce que le CMS a écrit. Divergences connues entre les deux écrivains : URL de l'image (dépôt amont ou bucket), Markdown repassé par Lexical, projet resté en brouillon dans le CMS mais présent en amont, projet créé seulement dans le CMS (retiré par l'import), identifiant d'un projet créé dans l'admin sous un slug que l'amont porte aussi (une publication CMS de `p` remplace la ligne amont `{Y, p}` par `{X, p}`, l'import quotidien remet `{Y, p}` ; entre les deux, les projets qui référencent `Y` perdent ce lien dans l'export). Elles disparaissent quand le flux devient amont → CMS → pivot (feature 005, lot 4).

### 8. Un seul lecteur du format amont

`TeeProjectImporter` (`libs/format-adapters`) est le seul code qui lit `projects.json`, validé par `teeProjectSchema` (garde de forme en `.passthrough()` ; une cellule facultative vide ou `null`, telle que Baserow l'exporte, est lue comme absente). La validation se fait **enregistrement par enregistrement** (`TeeProjectRecords`) : un projet dont la forme est cassée est écarté et signalé, les autres alimentent l'import ; seul un fichier qui n'est pas une liste échoue en bloc. Le seed compte un enregistrement écarté comme une erreur (code de sortie 1) ; l'import direct conserve sa ligne du store au lieu de la retirer. La copie versionnée `static/upstream/projects.json` est écrite à partir du fichier brut (`UpstreamJsonSource.raw`), pas de l'objet validé, qui réordonnerait les clés. Le lecteur sert à l'import direct **et** au seed, qui enchaîne avec `CanonicalProjectToPayloadMapper` (pivot → données Payload, relations résolues par le port `ProjectRelations`). L'ancien lecteur du seed (`ProjectMapper`, `types.ts`) est supprimé.

Ce que le lecteur ne peut pas porter est signalé, jamais perdu en silence (accesseur `warnings`) : thème inconnu, priorité de mise en avant non numérique, question de FAQ sans texte ou sans réponse, projet lié inconnu, chemin d'image invalide. Un thème principal inconnu laisse le champ absent : le projet est refusé par le validateur (import direct) ou compté en erreur (seed).

`CanonicalProjectToPayloadMapper` écrit **tous** les champs Payload, un champ absent du pivot en `null` ou `[]` : un `update` Payload part de la dernière version, brouillon en attente compris, et un champ laissé de côté publierait la valeur du brouillon. Pour la même raison, le seed vide les projets liés retirés en amont, et `ProjectImporter` écrit toujours les deux champs qu'il calcule lui-même : `image` (valeur de la ligne principale quand la politique média répond « inchangé ») et `linkedProjects` (valeur publiée en attendant la seconde passe).

Deux règles de rapprochement complètent le seed. Un chemin d'image amont dont on ne peut pas tirer d'URL (non enraciné, `..`) ne donne pas d'image dans le pivot, mais le seed le traite comme un téléchargement en échec (`TeeProjectImporter.unusableImagePaths`) : l'image en place est conservée, l'échec est compté. Et `PayloadProjectRelations` retrouve un dispositif ou un projet par son `canonicalId` stocké **ou** par l'identifiant dérivé de son slug : un dispositif que le seed n'a pu réécrire qu'en brouillon garde un ancien identifiant sur sa ligne principale, et resterait sinon hors de la relation `programs`.

C'est l'application aux projets de la décision prise pour les dispositifs (feature 005) : deux lecteurs divergent tôt ou tard.

### 9. Image

`image { url, chemin_source? }`. `url` accepte une URL absolue (bucket, dépôt amont) ou un chemin enraciné (`/api/media/file/...`, cas du développement local sans stockage objet). L'export rend l'URL absolue avec la base URL publique, déjà injectée pour les liens de l'index. Il **omet l'image** quand le résultat n'est pas une URL `http(s)` absolue (le pivot interne tolère aussi `mailto:` et `//hôte/...`, par le primitif `urlSchema` et la règle du chemin enraciné) : AGIR ne reçoit qu'un lien qu'il peut suivre. `chemin_source` n'est jamais exposé.

### 10. API AGIR des projets

Deux routes publiques en lecture seule, qui lisent le store et jamais Payload :

| Route | Réponse |
|---|---|
| `GET /api/agir/projects` | Index : `idProjet` (slug), `titre`, `source`, `etatProjet`, `dateDerniereModification`, `urlPivot` |
| `GET /api/agir/projects/:slug/pivot` | Pivot du projet avec ses deltas d'export |

Deltas du pivot exporté (`AgirProjetPivotExporter`, liste blanche revalidée par un schéma `.strict()`) : `id` = slug, statut unique (`en_prod` ou `remplace`), `remplace_par` résolu en slug, thèmes au vocabulaire AGIR, dispositifs et projets liés résolus en slugs, URL d'image absolue.

Seuls les dispositifs **exportables vers AGIR** sont listés dans un projet, et seuls les projets `valide` parmi les projets liés : l'API ne renvoie pas de lien mort. `remplace_par` et `dispositifs[]` acceptent un slug hérité (non kebab-case), puisqu'ils peuvent désigner un tombstone.

Il n'y a pas de politique d'export : tout projet stocké est publié, donc servi, tombstones compris. Un slug absent du store répond `404`.

Toute la logique de projection vit dans `libs/format-adapters/src/agir/projects/` ; les endpoints ne font que transporter.

Options écartées :

- **Détail R2DA pour les projets** : R2DA décrit un dispositif d'aide, il n'a pas de champ pour une FAQ ou des projets liés.
- **Une liste complète en un seul appel** : simple, mais elle rompt la symétrie avec les dispositifs et grossit à chaque FAQ ajoutée.
- **Exposer les collections Payload** (`/api/projects`) : l'API dépendrait du CMS, à l'opposé de l'ADR 0008.

## Conséquences

**Positif**

- Les projets ont une représentation durable, indépendante de Payload : un changement de CMS supprime `public` et garde `canonical.canonical_projects`.
- AGIR lit dispositifs et projets par la même mécanique, avec des liens croisés cohérents.
- Un projet peut être préparé ou réécrit dans le CMS sans être exposé.
- FAQ et priorités par secteur, jusqu'ici perdues à l'import, sont éditables dans l'admin.
- Le diff de snapshot et son garde-fou sont testés une fois et servent aux deux entités.

**Coûts / limites**

- Migration de `Projects` (`20261001_092812_canonical_projects`) : tables de versions, nouvelles colonnes, deux arrays ; remplissage manuel dans la migration générée (`_status`, `canonical_id`, une version publiée par projet existant).
- Chaque enregistrement d'un projet publié ajoute une écriture dans le store, et une version dans Payload.
- Le seed écrit deux fois le pivot d'un projet lié (passe 1 avec ses projets liés déjà publiés, aucun au premier seed ; passe 2 avec ceux de l'amont), et la passe 2 réécrit ces projets à chaque seed, même sans changement (74 projets au 2026-10-01 : une version Payload et une écriture pivot de plus chacun).
- ~~Les tombstones n'existent qu'après un passage du pipeline quotidien : absents juste après une réinitialisation de la préprod.~~ Levé le 2026-10-02 : le seed les produit.
- Le format exposé à AGIR est un placeholder : noms de clés et vocabulaire à confirmer avec eux.
- ~~Tant que le flux amont → CMS → pivot n'est pas en place, les deux écrivains divergent sur les points listés au §7.~~ Levé le 2026-10-02.
- **Identité par slug** (§2, §7, révision « identité stable par slug à l'import ») : l'identifiant d'une entité présente des deux côtés ne change plus à l'import. Restent deux cas. Un slug renommé dans le CMS rompt le rapprochement : l'amont recrée l'entité sous l'ancien slug et la ligne renommée est retirée comme absente de l'amont. Et quand le CMS publie pour la première fois, sous son identifiant, une entité que l'import avait créée sous l'identifiant dérivé, la ligne dérivée est évincée : les références amont vers elle ne sont réalignées qu'à l'import suivant.
- **Ordre du pipeline** : l'import des projets étant en dernier, un échec de l'import des dispositifs ou de l'export Grist (table absente, clé invalide, panne de l'instance Grist) bloque l'import des projets, dont le store garde l'état de la veille. Comportement cible, non implémenté (mis de côté le 2026-10-01) : l'échec d'une étape n'empêche pas les suivantes, la chaîne sortant quand même en code non nul ; à l'intérieur d'une étape, un enregistrement en erreur n'empêche pas les autres (déjà vrai pour les deux imports, à vérifier pour le push Grist).
- `beforeChangeWorkflow` accepte à la **création** le `workflowStatus` fourni par l'appelant, sans contrôle de rôle : un appel d'API qui crée (ou duplique) un dispositif en envoyant `workflowStatus: publie` le publie directement. Antérieur à cette feature et sans rapport avec l'action « Dupliquer » de l'admin, qui n'envoie pas ce champ ; à traiter avec le workflow (ADR 0005).
- `Projects.sectors` n'accepte que les sections NAF, alors que le pivot accepte tout code NAF : un code hors section venu de l'amont est écarté du CMS avec un avertissement (sans effet au 2026-10-01, l'amont ne publiant que des sections dans `sectors`).
- La mémoïsation de la connexion du store ne survit pas à un rechargement à chaud de Next en développement.

## Alternatives écartées

- **Générer l'API des projets à la volée depuis Payload**, sans store : pas de données durables hors du CMS, et une API qui tombe avec lui.
- **Attendre la sync quotidienne du CMS (feature 005, lot 4)** avant de créer le pivot des projets : l'API AGIR des projets serait bloquée par un chantier indépendant.
- **Référencer dispositifs et projets liés par slug dans le pivot** : plus simple à lire, mais fragile au renommage et incohérent avec `remplace_par` des dispositifs.

## Révisions

### 2026-10-01 : écarts constatés à la mise en œuvre (feature 008)

Les décisions de fond sont inchangées. Le texte ci-dessus a été mis à jour sur les points suivants ; le détail par lot est dans la [feature 008](../features/008-canonical-projects.md), section « Écarts constatés à l'implémentation ».

| § | Écart | Raison |
|---|---|---|
| 1 | Sous-schémas `projet*Schema` exportés ; le schéma accepte les objets optionnels vides, ne rogne pas `contenu` ni `reponse`, retire les clés inconnues sans les refuser | Réutilisation par le garde-fou de l'export AGIR ; l'omission des blocs vides est une règle de mapper, pas de format |
| 2 | Deux repositories distincts, sans classe de base | Typage Drizzle d'une table générique trop lourd pour le gain |
| 2 | Connexion en échec retirée du cache, pool fermé | Une promesse rejetée mémoïsée aurait bloqué le store jusqu'au redémarrage |
| 3 | La migration crée aussi une version publiée par projet existant (`_projects_v`) | La liste de l'admin lit les versions : sans elles, les projets en disparaissaient |
| 3 | Le hook calcule l'action avant de retirer la ligne d'un ancien `canonicalId`, et ne retire rien sur « inchangé » | Un brouillon qui réaligne l'identifiant ne doit pas faire disparaître la version publiée du pivot |
| 5 | `min: 0` sur `defaultPriority` et `sectorPriorities.priority` ; pas de contrôle d'entier côté Payload | Le pivot reste le garde-fou ; une valeur décimale est signalée, pas bloquée |
| 8 | `teeProjectSchema` en `.passthrough()`, sans transformation | La copie versionnée de l'amont doit rester fidèle |
| 8 | Avertissements du lecteur plus nombreux que prévu ; tableaux et blocs vides omis | Rien n'est perdu en silence ; le pivot ne porte pas de champ vide |
| 8 | Le mapper vers Payload écrit tous les champs (`null` ou `[]` pour un absent) ; le seed vide les projets liés retirés en amont | Un `update` Payload part de la dernière version, brouillon compris |
| 9 | Image omise de l'export sans URL `http(s)` absolue | Le pivot interne accepte des formes qu'AGIR ne peut pas suivre |
| 10 | `remplace_par` et `dispositifs[]` exportés acceptent un slug hérité | Ils peuvent désigner un tombstone |
| Conséquences | Limites ajoutées : sync après réalignement d'identifiant en brouillon, secteurs hors sections NAF, réécriture des projets liés à chaque seed, connexion du store et rechargement à chaud | Constatées pendant la mise en œuvre et les essais |

### 2026-10-01 : correctifs après revue de code

Une revue de code de la feature a relevé quinze constats. Aucune décision de fond ne change ; les correctifs resserrent ce qui laissait une donnée se perdre ou un échec passer en silence. Le texte ci-dessus est à jour ; le détail des fichiers est dans la [feature 008](../features/008-canonical-projects.md), section « Correctifs après revue de code ».

| § | Correctif | Raison |
|---|---|---|
| 2 | Le repository évince, avant l'upsert et dans la même transaction, la ligne de même slug stockée sous un autre identifiant, et émet `project_removed` / `program_removed` pour elle | Dès qu'un projet créé dans l'admin portait le slug d'un projet amont, chaque publication finissait en violation de l'unicité du slug et en `sync_failed`, jusqu'au seed suivant. Remplace la « limite du hook de sync » de la révision précédente |
| 2 | `delete` renvoie un booléen ; les services n'émettent l'événement de retrait que si une ligne a été retirée | Chaque enregistrement d'un brouillon jamais publié journalisait un retrait fictif |
| 2 | Singletons du CMS mémoïsés par `RetryableMemo` : une promesse rejetée est oubliée | Un seul échec d'ouverture du store bloquait la synchronisation et les endpoints AGIR jusqu'au redémarrage, ce qui annulait le réessai déjà prévu dans le store |
| 3 | Aucun garde ajouté au hook pour les brouillons jamais publiés | Le seul garde sûr (`operation === 'create'`) n'épargne qu'un enregistrement ; l'événement fictif, lui, est supprimé |
| 4 | `disableDuplicate: true` sur `canonicalId` (`Projects` et `Programs`) | « Dupliquer » donnait à la copie l'identifiant `<id> - Copy`, invalide et immuable : document jamais synchronisé, seconde duplication en erreur d'unicité |
| 5 | `SlugValidator` sur `slug` (`Projects` et `Programs`), `IntegerValidator.nonNegative` sur les trois priorités, `NafCodeValidator` sur la valeur brute via `nafCodeSchema` | L'admin acceptait des valeurs que le pivot refusait : projet publié absent d'AGIR, ou servi dans son ancienne version, sans retour à l'éditeur. Remplace la ligne « pas de contrôle d'entier côté Payload » de la révision précédente |
| 7 | `import:projects` passe en fin de `data:daily` et `data:daily:dev` | Placé au milieu de la chaîne, tout échec côté projets figeait l'open data Grist des dispositifs |
| 8 | `projects.json` validé enregistrement par enregistrement (`TeeProjectRecords`), cellules vides ou `null` lues comme absentes (`emptyAsAbsent`) | Une seule entrée amont hors forme faisait échouer le seed entier, le postdeploy de la préprod et le job quotidien |
| 8 | Copie versionnée écrite depuis le fichier brut (`UpstreamJsonSource.raw`) | La copie validée réordonnait les clés : 232 lignes réécrites sans changement amont |
| 8 | `ProjectImporter` écrit toujours `image` et `linkedProjects` | Un champ omis prenait la valeur d'un brouillon en attente et la publiait |
| 8 | Chemin d'image amont inexploitable traité comme un téléchargement en échec (`unusableImagePaths`) | Il était lu comme « pas d'image » : l'image importée du projet était détachée |
| 8 | `PayloadProjectRelations` indexe aussi par identifiant dérivé du slug | Un dispositif dont la ligne principale garde un ancien identifiant n'était plus lié à ses projets |
| 10 | `sync_failed` journalisé « canonical project sync failed » quand `entity` vaut `project` | Un échec de synchronisation de projet se lisait comme celui d'un dispositif |
| Hors ADR | `LinkedProjectsCounter` ne compte que les projets publiés | Depuis l'activation des brouillons, il comptait des projets qu'AGIR ne reçoit pas |
| Hors ADR | Job CI « Library tests » (`pnpm test:libs`) ; la suite `ProjectsSync` ne dépend plus de l'ordre des fichiers de test | Les tests des trois libs ne tournaient qu'à la main ; un ordre de fichiers inversé faisait échouer douze tests |

### 2026-10-01 : duplication en brouillon, textes faits d'espaces

Deux limites de la révision précédente sont levées. Le texte ci-dessus est à jour (§4, §5, « Coûts / limites ») ; le détail des fichiers est dans la [feature 008](../features/008-canonical-projects.md), section « Duplication et textes vides ».

| § | Correctif | Raison |
|---|---|---|
| 4 | `duplicateAsDraft` (beforeOperation de `Projects` et `Programs`) force `draft: true` sur toute duplication | Payload remplit la copie avec les valeurs de l'original, `_status` compris. L'admin envoie `draft`, la Local API non : sans le hook, la copie d'un projet publié était publiée, ou refusée à cause de son slug |
| 4 | `disableDuplicate: true` sur `workflowStatus`, `workflowHistory`, `replacedBy`, `lastModifiedBy` et `assignedContributors` de `Programs` | La copie d'un dispositif publié recevait `workflowStatus: publie` de l'original. À la création, `beforeChangeWorkflow` garde le statut reçu et en déduit `_status: published`, par-dessus le `_status: draft` posé par Payload : la copie était publiée, sans validation puisque l'appel était un brouillon. Sans la valeur de l'original, le champ reprend son défaut `en-creation` |
| 4 | `assignCopySlug` (`beforeDuplicate` du champ `slug`) : `<slug>-copy`, puis `<slug>-copy-2`... | Le `<slug> - Copy` de Payload n'est pas kebab-case (copie impubliable sans retouche) et une seconde duplication du même original butait sur l'unicité. Une requête sur dix slugs candidats suffit ; au-delà, suffixe aléatoire |
| 4 | `assignCopyTitle` (`beforeDuplicate` du champ `title`) : titre suffixé de « (copie) », une seule fois | L'original et sa copie portaient le même titre : seul le slug les distinguait dans la liste |
| 5 | `RequiredTextValidator` et `RequiredRichTextValidator` sur les champs requis de `Projects` et de `Programs` | Un texte requis fait d'espaces passait la validation de Payload, puis le pivot refusait le document sans retour à l'éditeur (`project_dropped`, `program_dropped`) |
| Hors ADR | `disableDuplicate: true` sur `Media.sourcePath` | Par la Local API (accès de champ contournés), la copie d'un média importé recevait le chemin `<chemin> - Copy` et passait pour un média importé |

Options écartées :

- **un hook `beforeDuplicate` sur `workflowStatus`** qui renvoie `en-creation` : équivalent à `disableDuplicate`, avec du code en plus ;
- **forcer le brouillon dans `beforeChangeWorkflow`** : un hook `beforeChange` ne sait pas qu'il traite une duplication, et `Projects` n'a pas ce hook ;
- **rogner les textes à l'enregistrement** : modifierait en silence des données existantes ;
- **détecter un rich text vide en parcourant l'arbre Lexical** : une seconde définition de « vide », qui pourrait diverger de la conversion Markdown du pivot.

### 2026-10-01 : identité stable par slug à l'import

La révision précédente laissait l'identifiant d'une entité alterner entre celui du CMS et celui de l'amont. Cette limite est levée, pour les projets et pour les dispositifs.

Deux écrivains alimentent le store : le CMS, qui écrit une entité sous le `canonicalId` de son document Payload (un cuid2 aléatoire pour un document créé à la main), et l'import amont, qui dérive l'identifiant du slug (`SlugCanonicalId`). Pour qu'une entité connue des deux ne change pas d'identifiant au gré des écritures, l'application d'un snapshot amont (`applySnapshot`) retrouve chaque entrée par son slug : si ce slug est déjà stocké sous un autre identifiant, l'entrée est écrite **sous l'identifiant stocké**, sans suppression ni réécriture sous l'identifiant dérivé. L'identifiant dérivé du slug ne nomme plus que les entités nouvelles pour le store.

Comme les entrées amont se référencent entre elles par identifiants dérivés, les références sont réécrites avant validation par `CanonicalIdentityMap` (domaine, `libs/canonical/src/snapshot/`) : `remplace_par` pour les dispositifs ; `remplace_par`, `projets_lies.projets` et `dispositifs` pour les projets, ce dernier à partir d'une correspondance que `import-projects.ts` construit en lisant les clés du store des dispositifs (option `programIdentities` de `CanonicalProjectService.applySnapshot`).

Conséquences :

- pour un slug donné, l'identifiant du store est le même quel que soit l'ordre des publications CMS et des imports ;
- l'import met à jour le contenu de la ligne du CMS sans émettre d'événement de retrait ;
- les tombstones pointent vers l'identifiant conservé de leur cible ;
- le garde-fou ne compte toujours que les vraies suppressions ;
- le rapport d'import liste ces entités sous « Conservés sous leur identifiant stocké » (`adopted`), à chaque import ;
- le cas « superseded » (ligne supprimée puis réécrite sous un autre identifiant) ne subsiste que comme filet de sécurité, quand l'identifiant stocké est déjà porté par une autre entrée du snapshot.

Vérifié sur une base jetable avec l'amont réel (290 dispositifs, 97 projets) : cinq lignes renommées sous un identifiant « CMS » gardent cet identifiant après deux imports, sans doublon ni référence pendante (21 projets liés, 61 références de dispositifs et deux tombstones réécrits), et le second import est identique au premier.

Limites : voir « Coûts / limites » (slug renommé dans le CMS, première publication CMS d'une entité créée par l'import). L'ordre compte aussi : la correspondance des dispositifs est lue dans le store au moment de l'import des projets, que le pipeline lance après celui des dispositifs. Seul `applySnapshot` réécrit identifiants et références : une écriture par `save()` n'en bénéficie pas.

Options écartées :

- **dériver l'identifiant du slug dès la création dans le CMS** : ne corrige pas les documents existants et lie l'identité au premier slug saisi, souvent provisoire ;
- **faire adopter par le CMS l'identifiant du store** : un hook devrait lire le store à chaque création, et l'identité d'un document Payload changerait après coup.

### 2026-10-02 : un seul écrivain, redirections et retraits suivis dans le CMS

Le §7 laissait deux écrivains au store des projets : les hooks du CMS et l'import quotidien direct. Le back-office ne voyait alors jamais les nouveautés amont entre deux seeds, alors que l'API AGIR les servait, et un projet remplacé ou retiré en amont n'avait aucune trace dans le CMS. Le lot 4 de la [feature 005](../features/005-cms-daily-sync.md), étendu aux projets, y met fin.

**Flux.** Amont → CMS → canonical → Grist (dispositifs seulement). La tâche quotidienne lance `UpstreamSync` (`apps/cms/src/scripts/sync/`), la même commande que le seed : elle écrit dispositifs et projets dans Payload, et les hooks `syncCanonicalOnPublish` et `syncProjectCanonicalOnChange` alimentent le store, comme pour une écriture d'éditeur. `import:tee` et `import:projects` ne sont plus dans le cron ; ils restent utilisables pour reconstruire le store sans Payload.

**Cycle de vie d'un projet dans le CMS : le workflow des dispositifs.** Une première version de cette révision posait un champ propre aux projets (`projectStatus`) à côté du `_status` natif. Deux champs indépendants autorisaient des états incohérents (un projet annulé mais publié) et dupliquaient ce que les dispositifs font déjà. Les projets suivent donc le même modèle :

- `workflowStatus` est le **statut unique** d'un projet et pilote `_status`, par le même hook que les dispositifs (`beforeChangeWorkflow('projects')`, `apps/cms/src/hooks/shared/`) ;
- même vocabulaire, restreint aux statuts qu'un projet traverse : `en-creation`, `publie`, `en-cours-modification`, `annule`, `remplace`. Pas de relecture ni d'archivage : les projets sont écrits par les admins, qui publient directement (`WorkflowTransitionPolicy`, table de transitions `projects`) ;
- `replacedBy` (relation vers `projects`) est exigé pour passer à `remplace` ;
- `workflowHistory` garde chaque transition, avec son auteur et sa date : c'est le suivi dans le CMS ;
- dans l'admin, les boutons natifs de publication cèdent la place à la barre d'actions des dispositifs (« Enregistrer le brouillon », « Publier », « Modifier », « Remplacer », « Supprimer » dans le menu).

La règle canonical est commune (`CanonicalSyncPolicy`) : `publie` et `remplace` sont écrits, `annule` est retiré, les états en cours ne touchent pas au pivot, si bien qu'un projet publié en cours de réécriture reste servi. `ProjectCanonicalSyncPolicy` est supprimée. Comme pour un dispositif, un passage à `remplace` ou `annule` est enregistré en version brouillon : la validation n'est pas rejouée, ce qui laisse à un projet remplacé son ancien slug tel quel.

**Redirections.** `ProjectsSync` et `ProgramsSync` reçoivent `redirects.json` et réutilisent `ProjectTombstoneBuilder` et `RedirectTombstoneBuilder` : un ancien slug encore présent en amont est marqué `remplace` en place, un ancien slug absent devient un document `remplace` cloné depuis sa cible. Ces documents sont importés **après** leurs cibles, pour que `replacedBy` soit résolu. Le contenu servi par AGIR pour un ancien slug est donc le même qu'avec l'import direct.

**Disparus de l'amont.** Un document importé (son `canonicalId` est celui que `SlugCanonicalId` dérive de son slug), absent du snapshot et sans redirection, passe en `annule` : une seule classe pour les deux collections, `GoneDocumentsCanceller`. Un document créé dans le CMS, à l'identifiant aléatoire, n'est jamais touché. Un enregistrement amont écarté pour sa forme n'est pas un disparu. `UpstreamRemovalGuard` refuse d'annuler plus de `max(5, 10 %)` des documents importés en une fois : le job sort alors en erreur sans rien annuler (`--allow-mass-removal` lève le plafond).

**Écriture sur différence.** Champ masqué `upstreamFingerprint` sur les deux collections : SHA-256 des données Payload calculées depuis l'amont, relations résolues comprises (`UpstreamFingerprint`). Empreinte identique et ligne présente dans le store : le document n'est pas réécrit, aucune version n'est créée. Toute écriture qui ne vient pas d'un script de confiance efface l'empreinte (`clearUpstreamFingerprint`), donc la sync suivante réécrit le document depuis l'amont : la règle « l'amont est maître » s'applique désormais au CMS lui-même.

**Rapprochement.** En fin de job, `CanonicalReconciler` compare ce que le CMS sert à ce que chaque store contient : une ligne attendue absente est une erreur (elle sera réécrite à la sync suivante, l'importeur vérifiant la présence dans le store) ; une ligne que le CMS n'attend pas est retirée, sous le même garde-fou.

Vérifié sur une base jetable avec l'amont réel du 2026-10-02 : 290 dispositifs (278 + 12 remplacés clonés, 1 marqué en place) et 97 projets (91 + 6 remplacés) écrits sans erreur, rapprochement sans écart, et une seconde sync qui n'écrit rien (0,6 s contre 17 s).

| § | Décision | Raison |
|---|---|---|
| 6 | Les redirections sont des documents du CMS | Le suivi d'un remplacement se lit dans le back-office, et le store n'a plus qu'une source |
| 7 | Un seul écrivain du store : les hooks | Le back-office voit les nouveautés amont le jour même ; plus de divergence d'URL d'image, de Markdown ou d'identifiant entre deux écrivains |
| 3, 7 | Les projets suivent le workflow des dispositifs (`workflowStatus`, `replacedBy`, `workflowHistory`), sans la relecture | Un seul modèle de statut à comprendre et à maintenir, une seule règle canonical, un seul code d'annulation ; l'historique des transitions donne le suivi dans le CMS |
| 7 | Un projet `remplace` reste dans le pivot, un projet `annule` en sort | Le premier est encore servi par AGIR (redirection suivable), le second ne doit plus l'être |
| 8 | Empreinte calculée sur les données Payload, pas sur l'enregistrement amont | Un changement de mapper réécrit les documents sans intervention ; l'identifiant aléatoire que le convertisseur Markdown pose sur les liens est exclu du calcul |

Limites :

- **Brouillon en attente.** Pour un projet comme pour un dispositif, un brouillon qu'un éditeur laisse en attente par-dessus la version publiée est écrasé à la sync suivante : l'empreinte est lue sur la dernière version.
- **Contenu d'un document remplacé.** Un document existant qui devient `remplace` par clonage reçoit le contenu de sa cible ; l'ancien contenu reste dans l'historique des versions.
- **Lien réparé le lendemain.** Un projet dont un projet lié était introuvable n'est réécrit qu'à la sync suivant l'arrivée de ce dernier, quand la résolution change son empreinte.
- **Dispositif refusé à la publication.** Un dispositif que Payload refuse de publier reste en création sans empreinte : il est retenté, et signalé, à chaque sync.
- **Ligne principale.** Comme pour l'action « Supprimer » de l'admin, un dispositif ou un projet annulé ou remplacé est enregistré en version brouillon : sa ligne principale garde l'ancien statut. Tout ce qui lit le statut doit lire la dernière version (`draft: true`). C'est une faiblesse du modèle des dispositifs, reproduite telle quelle sur les projets pour garder la symétrie ; la corriger est un chantier à part, pour les deux collections.
- **Création par l'API.** Le hook accepte à la création le `workflowStatus` fourni, sans contrôle de rôle (limite déjà notée pour les dispositifs) : elle vaut maintenant aussi pour les projets.
- **Tests des projets.** Publier ou modifier un projet par la Local API est une transition de workflow : il faut un utilisateur admin ou le contexte système.

Options écartées :

- **comparer l'enregistrement amont plutôt que les données Payload** : déterministe sans exclusion, mais un changement de mapper resterait sans effet tant que l'amont ne bouge pas, sauf à tenir un numéro de version à la main ;
- **garder les tombstones hors du CMS** (store écrit directement pour eux seuls) : deux écrivains à nouveau, et aucun suivi dans le back-office ;
- **supprimer les documents disparus** : perd la fiche et son historique, et un retour de l'entité en amont repartirait de zéro ;
- **un champ de statut propre aux projets à côté de `_status`** (`projectStatus`, première version de cette révision) : deux sources de vérité, un vocabulaire différent de celui des dispositifs, une politique de sync et un code d'annulation en double ;
- **porter tout le workflow éditorial sur les projets** (relecture, rôles, neuf états) : aucun circuit de relecture n'existe pour eux aujourd'hui. Le modèle reste extensible : il suffit d'ajouter des lignes à la table de transitions des projets.
