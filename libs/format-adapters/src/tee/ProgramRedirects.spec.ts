import { ProgramRedirects } from './ProgramRedirects'

describe('ProgramRedirects', () => {
  it('lit la table program_redirects et ignore les autres clés', () => {
    const redirects = new ProgramRedirects({
      program_redirects: { 'ancien-a': 'nouveau-a', 'ancien-b': 'nouveau-b' },
      project_redirects: { x: 'y' },
      program_rowid_to_url_mapping: { '1': 'z' },
    })
    expect(redirects.size).toBe(2)
    expect(redirects.entries()).toEqual([
      ['ancien-a', 'nouveau-a'],
      ['ancien-b', 'nouveau-b'],
    ])
  })

  it('est vide si program_redirects absent, non-objet ou entrée non-string', () => {
    expect(new ProgramRedirects(undefined).size).toBe(0)
    expect(new ProgramRedirects({}).size).toBe(0)
    expect(new ProgramRedirects({ program_redirects: null }).size).toBe(0)
    expect(new ProgramRedirects({ program_redirects: { a: 123 } }).size).toBe(0)
  })
})
