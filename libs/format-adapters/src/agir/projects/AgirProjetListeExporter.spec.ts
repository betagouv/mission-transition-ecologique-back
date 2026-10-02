import { AgirProjetListeExporter } from './AgirProjetListeExporter'
import { fullProject, minimalProject, replacedProject } from '../../__fixtures__/canonical-projects'

describe('AgirProjetListeExporter', () => {
  const exporter = new AgirProjetListeExporter({ baseUrl: 'https://tee.example.gouv.fr/' })

  it('mappe identité, source, état et date', () => {
    expect(exporter.export(fullProject)).toEqual({
      // idProjet = slug, never the cuid2.
      idProjet: 'plan-action-eco-energie',
      titre: 'Mettre en place un plan d’action éco-énergie',
      source: 'tee',
      etatProjet: 'en_prod',
      dateDerniereModification: '2026-03-19T17:00:00+01:00',
      urlPivot: 'https://tee.example.gouv.fr/api/agir/projects/plan-action-eco-energie/pivot',
    })
  })

  it('construit le lien depuis la base injectée, sans double slash', () => {
    const withoutSlash = new AgirProjetListeExporter({ baseUrl: 'https://tee.example.gouv.fr' })
    expect(withoutSlash.export(minimalProject).urlPivot).toBe(exporter.export(minimalProject).urlPivot)
    expect(exporter.export(minimalProject).urlPivot).toBe(
      'https://tee.example.gouv.fr/api/agir/projects/isolation-thermique/pivot',
    )
  })

  it('encode dans l’URL l’ancien slug non kebab-case d’un tombstone', () => {
    const out = exporter.export(replacedProject)
    expect(out.idProjet).toBe('isolation-thermique-renforcée')
    expect(out.etatProjet).toBe('remplace')
    expect(out.urlPivot).toBe('https://tee.example.gouv.fr/api/agir/projects/isolation-thermique-renforc%C3%A9e/pivot')
  })

  it('transmet tous les projets stockés, tombstones compris, dans l’ordre reçu', () => {
    const liste = exporter.exportMany([minimalProject, fullProject, replacedProject])
    expect(liste.map((entry) => entry.idProjet)).toEqual([
      'isolation-thermique',
      'plan-action-eco-energie',
      'isolation-thermique-renforcée',
    ])
  })

  it('n’expose aucun champ interne', () => {
    const out = exporter.export(fullProject)
    expect(Object.keys(out).sort()).toEqual(
      ['dateDerniereModification', 'etatProjet', 'idProjet', 'source', 'titre', 'urlPivot'],
    )
    expect(JSON.stringify(out)).not.toContain('q1b2c3d4e5f6g7h8i9j0klmn')
  })
})
