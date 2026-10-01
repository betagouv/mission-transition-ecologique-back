import redirectsFixture from '../../static/input/redirects-tests.json'
import { ProjectRedirects } from './ProjectRedirects'

describe('ProjectRedirects', () => {
  it('lit la table project_redirects et ignore les autres clés', () => {
    const redirects = new ProjectRedirects({
      project_redirects: { 'ancien-a': 'nouveau-a', 'maintenance-préventive': 'maintenance-preventive' },
      program_redirects: { x: 'y' },
      project_rowid_to_url_mapping: { '1': 'z' },
    })
    expect(redirects.size).toBe(2)
    expect(redirects.entries()).toEqual([
      ['ancien-a', 'nouveau-a'],
      ['maintenance-préventive', 'maintenance-preventive'],
    ])
  })

  it('est vide si project_redirects absent, non-objet ou entrée non-string', () => {
    expect(new ProjectRedirects(undefined).size).toBe(0)
    expect(new ProjectRedirects({}).size).toBe(0)
    expect(new ProjectRedirects({ project_redirects: null }).size).toBe(0)
    expect(new ProjectRedirects({ project_redirects: { a: 123 } }).size).toBe(0)
  })

  it('lit les redirections de la fixture figée, à côté de celles des dispositifs', () => {
    expect(new ProjectRedirects(redirectsFixture).entries()).toEqual([
      ['seche-linge', 'electromenager-basse-consommation'],
      ['maintenance-préventive', 'maintenance-preventive'],
    ])
  })
})
