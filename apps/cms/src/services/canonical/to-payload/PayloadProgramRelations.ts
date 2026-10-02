import type { Payload } from 'payload'
import { SlugCanonicalId } from '@tee-backoffice/format-adapters'
import { cogCodeOf } from '../canonicalMappings'
import type { ProgramArea, ProgramRelations } from './ProgramRelations'

/** `ProgramRelations` backed by the operators, geographic areas and programs stored in Payload. */
export class PayloadProgramRelations implements ProgramRelations {
  private constructor(
    private readonly payload: Payload,
    private readonly operatorIdByName: Map<string, number>,
    private readonly areaByCode: Map<string, ProgramArea>,
    private programIds: Map<string, number>,
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
    const programIds = await PayloadProgramRelations.loadProgramIds(payload)
    return new PayloadProgramRelations(payload, operatorIdByName, areaByCode, programIds)
  }

  /** Programs created since the relations were loaded become resolvable: replaced ones are imported after their target. */
  async refreshPrograms(): Promise<void> {
    this.programIds = await PayloadProgramRelations.loadProgramIds(this.payload)
  }

  operatorId(name: string): number | undefined {
    return this.operatorIdByName.get(name)
  }

  areaByCogCode(code: string): ProgramArea | undefined {
    return this.areaByCode.get(code)
  }

  programIdByCanonicalId(canonicalId: string): number | undefined {
    return this.programIds.get(canonicalId)
  }

  /** Same double key as `PayloadProjectRelations`: the stored id, then the one derived from the slug. */
  private static async loadProgramIds(payload: Payload): Promise<Map<string, number>> {
    const result = await payload.find({
      collection: 'programs',
      limit: 0,
      depth: 0,
      select: { canonicalId: true, slug: true },
    })
    const ids = new Map<string, number>()
    for (const doc of result.docs) {
      if (doc.canonicalId) ids.set(doc.canonicalId, doc.id)
    }
    for (const doc of result.docs) {
      if (doc.slug) ids.set(SlugCanonicalId.from(doc.slug), doc.id)
    }
    return ids
  }
}
