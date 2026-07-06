import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import { GeoCoverageMapper } from './GeoCoverageMapper'

type Eligibilite = CanonicalProgramData['eligibilite']

const eligibilite = (value: unknown): Eligibilite => value as Eligibilite

describe('GeoCoverageMapper', () => {
  it('défaut national (PAYS-99100) sans éligibilité géographique', () => {
    expect(GeoCoverageMapper.toCoverage(undefined)).toBe('PAYS-99100')
    expect(GeoCoverageMapper.toCoverage(eligibilite({ secteur_geographique: { structure: { inclusions: [] } } }))).toBe(
      'PAYS-99100',
    )
  })

  it('joint les inclusions COG par des pipes', () => {
    expect(
      GeoCoverageMapper.toCoverage(eligibilite({ secteur_geographique: { structure: { inclusions: ['REG-53', 'REG-52'] } } })),
    ).toBe('REG-53|REG-52')
  })

  it('expose les exclusions, ou undefined si absentes', () => {
    expect(
      GeoCoverageMapper.toExclusions(
        eligibilite({ secteur_geographique: { structure: { inclusions: ['PAYS-99100'], exclusions: ['REG-94'] } } }),
      ),
    ).toBe('REG-94')
    expect(GeoCoverageMapper.toExclusions(undefined)).toBeUndefined()
  })
})
