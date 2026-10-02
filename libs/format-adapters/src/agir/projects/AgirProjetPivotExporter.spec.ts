import { CanonicalProgramValidator, CanonicalProjectValidator } from '@tee-backoffice/canonical'
import type { CanonicalProject } from '@tee-backoffice/canonical'
import { AgirProjetPivotExporter } from './AgirProjetPivotExporter'
import { AgirProjetReferences } from './AgirProjetReferences'
import { fullProgram, minimalProgram } from '../../__fixtures__/canonical-programs'
import { fullProject, minimalProject, replacedProject } from '../../__fixtures__/canonical-projects'

const BASE_URL = 'https://tee.example.gouv.fr/'

const projectWith = (over: Record<string, unknown>): CanonicalProject =>
  new CanonicalProjectValidator().parse({ ...fullProject.toJSON(), ...over })

// Same content as a published program, but still being written: absent from the AGIR programs API.
const draftProgram = new CanonicalProgramValidator().parse({
  ...minimalProgram.toJSON(),
  id: 'd1b2c3d4e5f6g7h8i9j0klmn',
  slug: 'aide-en-creation',
  statut_edition: 'en_creation',
})

describe('AgirProjetPivotExporter', () => {
  const references = new AgirProjetReferences({
    projects: [minimalProject, fullProject, replacedProject],
    programs: [minimalProgram, fullProgram, draftProgram],
  })
  const exporter = new AgirProjetPivotExporter(references, { baseUrl: BASE_URL })

  describe('projet complet', () => {
    const out = exporter.export(fullProject)

    it('remplace id par le slug (jamais le cuid2)', () => {
      expect(out.id).toBe('plan-action-eco-energie')
      expect(JSON.stringify(out)).not.toContain('q1b2c3d4e5f6g7h8i9j0klmn')
    })

    it('mappe source et statut, supprime statut_projet', () => {
      expect(out.source).toBe('tee')
      expect(out.statut).toBe('en_prod')
      expect(out).not.toHaveProperty('statut_projet')
      expect(out).not.toHaveProperty('remplace_par')
    })

    it('replie les thèmes sur le vocabulaire AGIR, sans doublon', () => {
      expect(out.theme_principal).toBe('energie')
      expect(out.themes).toEqual(['energie', 'environnement'])
    })

    it('résout dispositifs et projets liés en slugs, dans l’ordre du pivot', () => {
      expect(out.dispositifs).toEqual(['diagnostic-energie-pme', 'aide-decarbonation-industrie'])
      expect(out.projets_lies).toEqual({
        titre: 'Projets complémentaires',
        description: 'Ces projets prolongent votre démarche.',
        projets: ['isolation-thermique'],
      })
    })

    it('garde l’URL absolue de l’image et n’expose pas son chemin source', () => {
      expect(out.image).toEqual({ url: 'https://cdn.example.org/media/plan-eco-energie.webp' })
      expect(JSON.stringify(out)).not.toContain('chemin_source')
    })

    it('garde le reste tel quel', () => {
      const d = fullProject.data
      expect(out.titre).toBe(d.titre)
      expect(out.nom_court).toBe(d.nom_court)
      expect(out.description_courte).toBe(d.description_courte)
      expect(out.description_longue).toEqual(d.description_longue)
      expect(out.description_complementaire).toEqual(d.description_complementaire)
      expect(out.secteurs).toEqual(['C', 'I'])
      expect(out.priorite).toEqual(d.priorite)
      expect(out.faq).toEqual(d.faq)
      expect(out.seo).toEqual(d.seo)
      expect(out.date_mise_a_jour).toBe('2026-03-19T17:00:00+01:00')
    })

    it('n’expose aucun champ hors liste blanche', () => {
      const allowed = new Set([
        'id',
        'source',
        'date_mise_a_jour',
        'statut',
        'remplace_par',
        'titre',
        'nom_court',
        'description_courte',
        'image',
        'description_longue',
        'description_complementaire',
        'theme_principal',
        'themes',
        'secteurs',
        'priorite',
        'dispositifs',
        'projets_lies',
        'faq',
        'seo',
      ])
      expect(Object.keys(out).every((key) => allowed.has(key))).toBe(true)
    })
  })

  describe('projet minimal', () => {
    const out = exporter.export(minimalProject)

    it('omet les champs optionnels absents', () => {
      expect(Object.keys(out).sort()).toEqual(
        [
          'date_mise_a_jour',
          'description_courte',
          'description_longue',
          'id',
          'nom_court',
          'source',
          'statut',
          'theme_principal',
          'titre',
        ],
      )
    })
  })

  describe('références', () => {
    it('écarte un dispositif non exportable vers AGIR ou inconnu', () => {
      const out = exporter.export(
        projectWith({
          dispositifs: ['d1b2c3d4e5f6g7h8i9j0klmn', 'a1b2c3d4e5f6g7h8i9j0klmn', 'z1b2c3d4e5f6g7h8i9j0klmn'],
        }),
      )
      expect(out.dispositifs).toEqual(['diagnostic-energie-pme'])
    })

    it('écarte un projet lié remplacé ou inconnu', () => {
      const out = exporter.export(
        projectWith({
          projets_lies: {
            titre: 'Projets complémentaires',
            projets: ['r1b2c3d4e5f6g7h8i9j0klmn', 'p1b2c3d4e5f6g7h8i9j0klmn', 'z1b2c3d4e5f6g7h8i9j0klmn'],
          },
        }),
      )
      expect(out.projets_lies).toEqual({ titre: 'Projets complémentaires', projets: ['isolation-thermique'] })
    })

    it('garde une liste vide quand plus aucune référence n’est servie', () => {
      const out = exporter.export(
        projectWith({ dispositifs: ['d1b2c3d4e5f6g7h8i9j0klmn'], projets_lies: { projets: ['r1b2c3d4e5f6g7h8i9j0klmn'] } }),
      )
      expect(out.dispositifs).toEqual([])
      expect(out.projets_lies).toEqual({ projets: [] })
    })
  })

  describe('image', () => {
    const imageOf = (url: string) => exporter.export(projectWith({ image: { url } })).image

    it('rend absolue une URL enracinée avec la base injectée, sans double slash', () => {
      expect(imageOf('/api/media/file/plan.webp')).toEqual({
        url: 'https://tee.example.gouv.fr/api/media/file/plan.webp',
      })
    })

    it('omet une URL relative au protocole ou mailto, acceptées par le pivot interne', () => {
      expect(imageOf('//cdn.example.org/plan.webp')).toBeUndefined()
      expect(imageOf('mailto:contact@example.org')).toBeUndefined()
      expect(exporter.export(projectWith({ image: { url: 'mailto:contact@example.org' } }))).not.toHaveProperty('image')
    })

    it('omet l’image plutôt que d’échouer quand la base injectée ne donne pas une URL valide', () => {
      const broken = new AgirProjetPivotExporter(references, { baseUrl: 'cms:3000' })
      expect(broken.export(projectWith({ image: { url: '/api/media/file/plan.webp' } }))).not.toHaveProperty('image')
    })
  })

  describe('projet remplacé', () => {
    it('émet statut remplace et remplace_par (slug du projet courant), sous l’ancien slug', () => {
      const out = exporter.export(replacedProject)
      expect(out.id).toBe('isolation-thermique-renforcée')
      expect(out.statut).toBe('remplace')
      expect(out.remplace_par).toBe('isolation-thermique')
    })

    it('omet remplace_par quand le projet courant est introuvable', () => {
      const orphan = new AgirProjetPivotExporter(
        new AgirProjetReferences({ projects: [replacedProject], programs: [] }),
        { baseUrl: BASE_URL },
      )
      const out = orphan.export(replacedProject)
      expect(out.statut).toBe('remplace')
      expect(out).not.toHaveProperty('remplace_par')
    })
  })
})
