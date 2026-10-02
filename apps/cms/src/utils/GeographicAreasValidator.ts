import type { RelationshipFieldManyValidation } from 'payload'
import { validations } from 'payload'
import { GeographicAreaOverlap } from '@/services/geography/GeographicAreaOverlap'

/**
 * Validation of a program's `geographicAreas`: the built-in relationship checks,
 * then no area already covered by another selected one (a department with its
 * region). The live warning of the form says the same before saving.
 */
export class GeographicAreasValidator {
  static readonly validate: RelationshipFieldManyValidation = async (value, options) => {
    const builtIn = await (validations.relationship as RelationshipFieldManyValidation)(value, options)
    // The overlap needs a query: skipped on the per-keystroke form-state pass.
    if (builtIn !== true || options.event === 'onChange') return builtIn

    const ids = (value ?? []).map((item) => (typeof item === 'object' ? item.value : item))
    if (ids.length < 2) return true

    const areas = await options.req.payload.find({
      collection: 'geographic-areas',
      where: { id: { in: ids } },
      limit: 0,
      depth: 0,
      req: options.req,
    })
    const covered = GeographicAreaOverlap.find(areas.docs)
    if (covered.length === 0) return true
    return `${covered.map((item) => GeographicAreaOverlap.describe(item)).join(' ; ')}. Retirez le département ou sa région.`
  }
}
