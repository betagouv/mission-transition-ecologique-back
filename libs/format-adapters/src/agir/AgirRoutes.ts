/**
 * Single owner of the AGIR URL shapes: the CMS endpoints declare their `path`
 * from the patterns below, and the index exporters build their absolute links
 * from the same patterns, so a renamed route cannot leave stale links behind.
 */
export class AgirRoutes {
  static readonly PROGRAMS = '/agir/programs'
  static readonly PROGRAM_DETAIL = '/agir/programs/:slug/detail'
  static readonly PROGRAM_PIVOT = '/agir/programs/:slug/pivot'
  static readonly PROJECTS = '/agir/projects'
  static readonly PROJECT_PIVOT = '/agir/projects/:slug/pivot'

  // Payload mounts custom endpoints under its API route.
  private static readonly API_PREFIX = '/api'

  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
  }

  programDetailUrl(slug: string): string {
    return this.url(AgirRoutes.PROGRAM_DETAIL, slug)
  }

  programPivotUrl(slug: string): string {
    return this.url(AgirRoutes.PROGRAM_PIVOT, slug)
  }

  projectPivotUrl(slug: string): string {
    return this.url(AgirRoutes.PROJECT_PIVOT, slug)
  }

  private url(pattern: string, slug: string): string {
    // Replacer function: a slug containing `$&` must not be read as a replacement pattern.
    return `${this.baseUrl}${AgirRoutes.API_PREFIX}${pattern.replace(':slug', () => encodeURIComponent(slug))}`
  }
}
