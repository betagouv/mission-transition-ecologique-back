import type { Payload } from 'payload'
import { cogCodeOf } from '../canonicalMappings'
import type { ProgramArea, ProgramRelations } from './ProgramRelations'

/** `ProgramRelations` backed by the operators and geographic areas stored in Payload. */
export class PayloadProgramRelations implements ProgramRelations {
  private constructor(
    private readonly operatorIdByName: Map<string, number>,
    private readonly areaByCode: Map<string, ProgramArea>,
  ) {}

  /** `operatorIdByName` comes from `OperatorImporter`, which creates the missing operators first. */
  static async fromPayload(
    payload: Payload,
    operatorIdByName: Map<string, number>,
  ): Promise<PayloadProgramRelations> {
    const areas = await payload.find({ collection: 'geographic-areas', limit: 0, depth: 0 })
    const areaByCode = new Map<string, ProgramArea>()
    for (const area of areas.docs) {
      const code = cogCodeOf(area)
      if (!code) continue
      const parent = area.parentArea
      const parentId = typeof parent === 'object' ? parent?.id : parent
      areaByCode.set(code, { id: area.id, name: area.name, ...(parentId != null ? { parentId } : {}) })
    }
    return new PayloadProgramRelations(operatorIdByName, areaByCode)
  }

  operatorId(name: string): number | undefined {
    return this.operatorIdByName.get(name)
  }

  areaByCogCode(code: string): ProgramArea | undefined {
    return this.areaByCode.get(code)
  }
}
