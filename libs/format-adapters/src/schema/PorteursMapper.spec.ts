import type { CanonicalProgramData } from '@tee-backoffice/canonical'
import type { ExportLogger } from '../shared/ExportLogger'
import { PorteursMapper } from './PorteursMapper'

type Operateurs = CanonicalProgramData['operateurs']

class StubLogger implements ExportLogger {
  readonly warnings: string[] = []
  warn(message: string): void {
    this.warnings.push(message)
  }
}

const operateurs = (value: unknown): Operateurs => value as Operateurs

describe('PorteursMapper', () => {
  it('attribue les rôles par position (contact instruit+diffuse, autres diffusent)', () => {
    const porteurs = new PorteursMapper(new StubLogger()).toPorteurs(
      operateurs({
        contact: { nom: 'Bpifrance', nom_normalise: 'BPIFRANCE', siren: '320252489' },
        autres: [{ nom: 'Région Bretagne', siren: '233500016' }],
      }),
    )

    expect(porteurs).toEqual([
      { nom: 'BPIFRANCE', siren: '320252489', roles: ['instructeur', 'diffuseur'] },
      { nom: 'Région Bretagne', siren: '233500016', roles: ['diffuseur'] },
    ])
  })

  it('avertit sur SIREN et nom normalisé manquants sans bloquer', () => {
    const logger = new StubLogger()
    const porteurs = new PorteursMapper(logger).toPorteurs(operateurs({ contact: { nom: 'ADEME' } }))

    expect(porteurs).toEqual([{ nom: 'ADEME', roles: ['instructeur', 'diffuseur'] }])
    expect(logger.warnings).toContain('Porteur sans SIREN : ADEME')
    expect(logger.warnings).toContain('Porteur sans nom normalisé : ADEME')
  })

  it('éclate « CCI ou CMA » en CCI FRANCE + CMA FRANCE', () => {
    const porteurs = new PorteursMapper(new StubLogger()).toPorteurs(
      operateurs({ contact: { nom: 'CCI ou CMA' } }),
    )

    expect(porteurs).toEqual([
      { nom: 'CCI FRANCE', siren: '187500020', roles: ['instructeur', 'diffuseur'] },
      { nom: 'CMA FRANCE (APCM)', siren: '187500046', roles: ['instructeur', 'diffuseur'] },
    ])
  })

  it('dédoublonne sur le SIREN (contact prioritaire)', () => {
    const porteurs = new PorteursMapper(new StubLogger()).toPorteurs(
      operateurs({
        contact: { nom: 'ADEME', siren: '385290309' },
        autres: [{ nom: 'ADEME bis', siren: '385290309' }],
      }),
    )

    expect(porteurs).toHaveLength(1)
    expect(porteurs[0]?.roles).toEqual(['instructeur', 'diffuseur'])
  })
})
