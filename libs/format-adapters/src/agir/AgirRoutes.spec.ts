import { describe, expect, it } from 'vitest'
import { AgirRoutes } from './AgirRoutes'

const BASE = 'https://tee.example.gouv.fr'

describe('AgirRoutes', () => {
  // Literal on purpose: these routes are a contract with AGIR, a change must fail here.
  it('declares the endpoint patterns', () => {
    expect(AgirRoutes.PROGRAMS).toBe('/agir/programs')
    expect(AgirRoutes.PROGRAM_DETAIL).toBe('/agir/programs/:slug/detail')
    expect(AgirRoutes.PROGRAM_PIVOT).toBe('/agir/programs/:slug/pivot')
    expect(AgirRoutes.PROJECTS).toBe('/agir/projects')
    expect(AgirRoutes.PROJECT_PIVOT).toBe('/agir/projects/:slug/pivot')
  })

  it('builds absolute links under the API prefix', () => {
    const routes = new AgirRoutes(BASE)
    expect(routes.programDetailUrl('diagnostic-energie')).toBe(`${BASE}/api/agir/programs/diagnostic-energie/detail`)
    expect(routes.programPivotUrl('diagnostic-energie')).toBe(`${BASE}/api/agir/programs/diagnostic-energie/pivot`)
    expect(routes.projectPivotUrl('isolation-thermique')).toBe(`${BASE}/api/agir/projects/isolation-thermique/pivot`)
  })

  it('drops the trailing slashes of the base URL', () => {
    expect(new AgirRoutes(`${BASE}//`).projectPivotUrl('a')).toBe(`${BASE}/api/agir/projects/a/pivot`)
  })

  it('encodes the slug', () => {
    expect(new AgirRoutes(BASE).programPivotUrl('qualité/air $&')).toBe(
      `${BASE}/api/agir/programs/qualit%C3%A9%2Fair%20%24%26/pivot`,
    )
  })
})
