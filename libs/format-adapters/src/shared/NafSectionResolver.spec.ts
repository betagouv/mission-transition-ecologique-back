import { NafSectionResolver } from './NafSectionResolver'

describe('NafSectionResolver', () => {
  it('renvoie la lettre telle quelle pour une section', () => {
    expect(NafSectionResolver.sectionOf('C')).toBe('C')
    expect(NafSectionResolver.sectionOf('U')).toBe('U')
  })

  it('réduit divisions, groupes, classes à leur section', () => {
    expect(NafSectionResolver.sectionOf('01')).toBe('A')
    expect(NafSectionResolver.sectionOf('01.11Z')).toBe('A')
    expect(NafSectionResolver.sectionOf('33.20')).toBe('C')
    expect(NafSectionResolver.sectionOf('99')).toBe('U')
    expect(NafSectionResolver.sectionOf('68')).toBe('L')
  })

  it('renvoie undefined pour une division inconnue', () => {
    expect(NafSectionResolver.sectionOf('04')).toBeUndefined()
  })

  it('déduplique et trie les sections', () => {
    expect(NafSectionResolver.sectionsOf(['33.20', 'C', '01', '01.11Z'])).toEqual(['A', 'C'])
  })
})
