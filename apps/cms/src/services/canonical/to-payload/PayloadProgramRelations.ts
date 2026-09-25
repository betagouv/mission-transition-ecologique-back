import type { Payload } from 'payload'
import { COVERAGE_TYPE_TO_COG_PREFIX } from '../canonicalMappings'
import { GeographicAreaResolver, type ResolvedGeographic } from './GeographicAreaResolver'
import type { ProgramRelations } from './ProgramRelations'

/** `ProgramRelations` backed by the operators and geographic areas stored in Payload. */
export class PayloadProgramRelations implements ProgramRelations {
  private constructor(
    private readonly operatorIdByName: Map<string, number>,
    private readonly areaIdByCode: Map<string, number>,
    private readonly geography: GeographicAreaResolver,
  ) {}

  /** `operatorIdByName` comes from `OperatorImporter`, which creates the missing operators first. */
  static async fromPayload(
    payload: Payload,
    operatorIdByName: Map<string, number>,
  ): Promise<PayloadProgramRelations> {
    const areas = await payload.find({ collection: 'geographic-areas', limit: 0, depth: 0 })
    const areaIdByCode = new Map<string, number>()
    for (const area of areas.docs) {
      const prefix = COVERAGE_TYPE_TO_COG_PREFIX[area.coverageType]
      if (prefix && area.inseeCode) areaIdByCode.set(`${prefix}-${area.inseeCode}`, area.id)
    }
    return new PayloadProgramRelations(
      operatorIdByName,
      areaIdByCode,
      await GeographicAreaResolver.fromPayload(payload),
    )
  }

  operatorId(name: string): number | undefined {
    return this.operatorIdByName.get(name)
  }

  areaIdByCogCode(code: string): number | undefined {
    return this.areaIdByCode.get(code)
  }

  resolveGeography(names: string[]): ResolvedGeographic {
    return this.geography.resolve(names)
  }
}
