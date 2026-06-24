import { z } from 'zod'
import { ExportValidation } from './ExportValidation'

describe('ExportValidation', () => {
  const schema = z.object({ id: z.string().min(1) })

  it('ne renvoie aucune non-conformité quand tout est valide', () => {
    expect(ExportValidation.collect(schema, [{ id: 'a' }, { id: 'b' }], (_item, i) => `#${i}`)).toEqual([])
  })

  it('collecte les non-conformités avec leur libellé', () => {
    const findings = ExportValidation.collect(schema, [{ id: 'ok' }, { id: '' }], (_item, i) => `item-${i}`)
    expect(findings).toHaveLength(1)
    expect(findings[0]?.label).toBe('item-1')
    expect(findings[0]?.issues[0]).toContain('id')
  })

  it('warn() journalise sans lever', () => {
    const messages: string[] = []
    ExportValidation.warn('test', [{ label: 'x', issues: ['boum'] }], { warn: (message) => messages.push(message) })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toContain('x')
    expect(messages[0]).toContain('boum')
  })
})
