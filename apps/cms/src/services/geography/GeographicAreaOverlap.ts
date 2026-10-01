export interface OverlapArea {
  id: number | string
  name: string
  parentArea?: number | string | { id: number | string } | null
}

export interface CoveredArea {
  area: OverlapArea
  coveredBy: OverlapArea
}

/**
 * Finds the selected areas another selected area already covers (a department
 * picked together with its region). Regions win: the department is redundant.
 * Shared by the save validation and the live warning of the program form.
 */
export class GeographicAreaOverlap {
  static find(areas: readonly OverlapArea[]): CoveredArea[] {
    const byId = new Map(areas.map((area) => [String(area.id), area]))
    return areas.flatMap((area) => {
      const parent = area.parentArea
      const parentId = typeof parent === 'object' && parent !== null ? parent.id : parent
      const coveredBy = parentId == null ? undefined : byId.get(String(parentId))
      return coveredBy ? [{ area, coveredBy }] : []
    })
  }

  static describe(covered: CoveredArea): string {
    return `${covered.area.name} est déjà couvert par ${covered.coveredBy.name}`
  }
}
