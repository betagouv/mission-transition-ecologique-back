import upstreamPrograms from '../../static/upstream/programs.json'
import { TerritoryNameResolver } from './TerritoryNameResolver'

describe('TerritoryNameResolver', () => {
  it('traduit régions, collectivités d’outre-mer et départements en codes COG', () => {
    expect(TerritoryNameResolver.codesOf(['Bretagne', 'Nouvelle-Calédonie', 'Landes', 'Corse-du-Sud'])).toEqual([
      'REG-53',
      'OM-988',
      'DEP-40',
      'DEP-2A',
    ])
  })

  it('préfère la région pour un département d’outre-mer du même nom', () => {
    expect(TerritoryNameResolver.codesOf(['Guadeloupe'])).toEqual(['REG-01'])
  })

  it('traduit la mention nationale en PAYS-99100', () => {
    expect(TerritoryNameResolver.codesOf(["France et territoires d'outre-mer"])).toEqual(['PAYS-99100'])
  })

  it('écarte et signale les noms inconnus', () => {
    expect(TerritoryNameResolver.codesOf(['Bretagne', 'Atlantide'])).toEqual(['REG-53'])
    expect(TerritoryNameResolver.unknownNames(['Bretagne', 'Atlantide'])).toEqual(['Atlantide'])
  })

  it('redonne les noms des codes, sans nom pour le code national', () => {
    expect(TerritoryNameResolver.namesOf(['DEP-40', 'REG-75', 'PAYS-99100', 'DEP-971'])).toEqual([
      'Landes',
      'Nouvelle-Aquitaine',
      'Guadeloupe',
    ])
  })

  it('reconnaît tous les territoires cités par la copie amont', () => {
    const names = (upstreamPrograms as Record<string, unknown>[]).flatMap((program) => {
      const company = (program['eligibilityData'] as { company?: { allowedRegion?: string[] } } | undefined)?.company
      return company?.allowedRegion ?? []
    })
    expect(names.length).toBeGreaterThan(0)
    expect(TerritoryNameResolver.unknownNames(names)).toEqual([])
  })
})
