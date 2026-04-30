# Gestion des droits

## Fonctionnalités du Back-Office

### A. Module "Gestion du Catalogue"

- **Création/édition des aides :** ajout, duplication, brouillon, modification, suppression, commentaires.
- **Consultation / recherche des aides** (filtres : périmètre géographique, opérateur, secteurs d’activité, thématique, projet)
- **Workflow de validation :** Statut “en attente de validation”, "À relire",”en ligne”, "derniers jours’, "Expiré".
- **Relations :** Lien Aide <-> Projet, Lien Aide <-> Aide (parente/enfant = dispositif conditionnel).
- **Imports/Exports :** Import CSV/API massif, Export pour rapports.
- **Relecture auto :** données manquantes, vérificateur de doublons, alerte échance aide…
- **Relecture expert édito** : rédaction UX friendly

### B. Module "Écosystème”

- **Création/édition de contacts :** Accès à la cartographie des conseillers par thématique (nom, prénom du référent, poste, organisation, contact mail, dispositifs liés, projets liés)
- **Consultation / recherche des référents** (filtres : périmètre géographique, opérateur, secteurs d’activité, thématique, projet)

### C. Module "Pilotage & Data"

- **Dashboard Personnalisé :** Vision des indicateurs selon le périmètre de l’utilisateur.
- **Suivi de Performance :**  passage à l’action en autonomie, via Conseillers-entreprises, répartition géographique, secteur d’activité et taille des entreprises… (+ enveloppes consommées ?)
- **Observatoire (Tutelle) :** Cartographie des "zones blanches" (projets sans aides).
- **Annuaire des Contacts :** Cartographie des conseillers par thématique/territoire.

### D. Module "Diffusion"

- **Widget Center : “Vous souhaitez intégrer une aide directement sur votre site ?”** Générateur de code pour intégrer les aides sur les sites tiers.

---

## Personas et Matrice de Droits d’accès

- Chaque utilisateur est associé obligatoirement :
    - **à un rôle** (super-admin, administrateur d’une aide, contributeur, observateur)
    - **à un périmètre d’action** (ex : opérateur = CCI + région = Grand Est)
    - **à une “équipe”** (équipe de la CCI Grand Est).
- Chaque aide est liée à un profil administrateur, référent de l’aide, en charge de :
    - éditer, mettre à jour l’aide
    - valider les modifications des contributeurs

| **Persona** | **Description** | **A.Module Catalogue**  | **B.Module Écosystème**  | **C.Module Pilotage**  | **D. Module "Diffusion”**  |  |
| --- | --- | --- | --- | --- | --- | --- |
| **Super-Admin** | Notre équipe interne  | Full (Import masse, suppression, validation finale) + journal d’audit | Full | Full | Full + Suivi des appels API par les partenaires. |  |
| **Administrateur d’une aide** | Responsable d'un organisme (ex: Bpifrance, ADEME). | Édition de ses aides uniquement, assignation d’aides | Consultation + édition des contacts de son organisme | Stats  | accès aux widgets |  |
| **Contributeur**  | Expert thématique ou conseiller terrain. | Édition des fiches assignées uniquement (sous validation d’un admin) + commentaires  | Consultation + édition d’un contact ( avec validation d’un admin) | Stats de ses fiches | accès aux widgets |  |
| **Observateur** | Ministères, directions nationales (ex: DGE). | Lecture seule + Commentaires (Suggestions) | Consultation seule | Vision consolidée (Enveloppes nationales) | accès aux widgets |  |

---

## Workflow de Modération

**Questions structurantes :** 

> Comment garantir la qualité de donnée publiée ? (user friendly)
> 

> Comment sécuriser le workflow ? (fiabilité des données)
> 

> Est-ce que chaque opérateur peut publier en autonomie, ou le passage par une "Modération Centrale" est obligatoire pour garantir la qualité de la BDD ?
> 

> La relecture humaine fiche par fiche est-elle non-négociable ? Le responsable édito dispose t-il des droits finaux de réécriture ? (comme aujourd’hui)
> 

**Quels statuts pour une aide ?**  

🙋‍♂️ "En attente de validation" : Une aide éditée par un contributeur qui nécessite la validation de l’administrateur de l’aide. Une aide éditée directement par un admin passe directement au statut 2 “à relire”

👀 "À relire" : Toute nouvelle aide ajoutée nécessite une relecture pour s’assurer d’une rédaction user-friendly

✅ "En ligne" : Après validation(s), l’aide est ajoutée sur la BDD

⚠️ “Derniers jours” : 1 mois avant la date de fin de l’aide, l’aide passe au statut “derniers jours” 

❌ "Expiré" :  L’aide n’est plus disponible

```
CYCLE DE VIE D'UNE AIDE
─────────────────────────────────────────────────────────────

  [Contributeur]        [Administrateur]       [Équipe TEE]
       │                      │                       │
       ▼                      │                       │
  ✏️ BROUILLON                │                       │
  (édition locale)            │                       │
       │                      │                       │
       ▼                      │                       │
  🙋 EN ATTENTE         ──►  👀 À RELIRE       ──►   ✅ EN LIGNE
  DE VALIDATION              (contrôle qualité       (publiée)
  (soumis par le              par l'équipe TEE)       │
   contributeur)              │                       │
       │                      │ ◄── Refus avec        │
       │ ◄── Refus avec       │     commentaire       │
       │     commentaire      │                       │
                                                      │
                                                 ⚠️ DERNIERS JOURS
                                                 (J-30 avant fin)
                                                     │
                                                 ❌ EXPIRÉE
                                                 (archivée)

─────────────────────────────────────────────────────────────
💡 Un admin peut passer directement de BROUILLON → À RELIRE
   Un super-admin peut forcer le passage à EN LIGNE
```

**Quels rôles de modération ?** 

1. **Modération “super-admin” :** accès au journal d’audit
2. **Modération "Édito" :** relecture humaine fiche par fiche : validation de l’écriture “user friendly” de l’aide pour permettre sa bonne compréhension par l’entreprise . L'aide reste en "attente de validation" tant que ce flag n'est pas levé. 
3. **Modération “Métier” (Côté opérateur) :** Seul un référent peut publier/modifier une aide en autonomie. Les contributeurs doivent attendre une validation d’un référent avant tout ajout ou modification.
4. **Modération automatique :** 
    1. obsolescence : à J-30 de la fin de l'aide. Si pas de mise à jour, l'aide passe en "Expirée" pour ne pas tromper les entreprises. (archives)
    2. vérification automatique des champs incomplets, mal complétés

---

## La personnalisation du back-office

- **Le Profiling à la connexion :** Dès que l'utilisateur se connecte, le système reconnaît son affectation et propose des filtres par défaut.
    
    > [CMA france](https://www.artisanat.fr/) "opérateur : CMA"
    > 
    
    > [Pour la Fédération régionale d’hôtellerie Grand est](https://assoce.fr/waldec/W881009780/FEDERATION-R-GIONALE-D-H-TELLERIE-DE-PLEIN-AIR-GRAND-EST)  **:** “localisation : Grand Est” “secteur : hotellerie-restauration”.
    > 
    - L'utilisateur peut, d'un clic, supprimer ces filtres pour explorer les aides des autres régions  ou adapter plus finement ses intérêts.
    - “sauvegarder les filtres ”  Si un utilisateur affine ses filtres, le système s'en souvient pour sa prochaine session
    
- **La fonctionnalité de selection** : l’utilisateur peut choisir d’ajouter en favoris certaines aides et projets , pour les voir en priorité sur son tableau de bord.
    - Fonctionnalité binaire d’ajout / suppression dans la liste des items suivis, à la main de chaque utilisateur.
    - Quid des aides assignées versus les aides suivies ?

![Back-office TEE.png](Gestion%20des%20droits/Back-office_TEE.png)

---

## **Questions structurantes**

- Qui est "propriétaire" de la donnée quand une aide est co-financée par deux opérateurs ? Ex : Si une aide est financée à 50% par l’ADEME et 50% par bpifrance, qui a le bouton "Modifier" ? Doit-on créer une fiche commune ou deux fiches liées ? Doit-on identifier un unique référent ?
- Un opérateur national peut-il autoriser un acteur régional à modifier le champ "Contact local" sur une fiche nationale sans lui donner accès au reste de la fiche
- Quand une aide est renouvellée (ex: passage de 2025 à 2026), garde-t-on l'ancienne version en lecture seule pour les statistiques historiques ?
- Comment remonte-t-on à l'auteur d’une modification ?

---