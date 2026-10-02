import {
  TeeProjectRecords,
  UpstreamAssetSource,
  UpstreamJsonSource,
  type RejectedTeeProject,
  type TeeOperator,
  type TeeProject,
  type TeeRecord,
} from '@tee-backoffice/format-adapters'
import { Config } from '@/config/Config'

/**
 * Everything one sync run reads upstream, fetched once before Payload starts:
 * an unreachable upstream fails the job before anything is written.
 */
export class UpstreamSnapshot {
  constructor(
    readonly programs: TeeRecord[],
    readonly projects: TeeProject[],
    /** Projects set aside for a broken shape: reported, never treated as gone upstream. */
    readonly rejectedProjects: readonly RejectedTeeProject[],
    /** Raw `redirects.json`, or null when upstream has none. */
    readonly redirects: unknown,
    readonly operators?: TeeOperator[],
    /** Source of the logos and project images; without it, no media is imported. */
    readonly assets?: UpstreamAssetSource,
  ) {}

  /**
   * Upstream GitHub files are the source of truth; the versioned local copy is
   * an opt-in development fallback, refused on Scalingo.
   */
  static async fetch(): Promise<UpstreamSnapshot> {
    const source = UpstreamJsonSource.fromSettings(Config.upstreamFallback())
    // Logos and project images are never versioned locally: with the local
    // fallback, their downloads fail and are reported as warnings.
    const assets = new UpstreamAssetSource()
    process.stdout.write(`Source : ${source.describe()}\n`)
    process.stdout.write(`Fichiers : ${assets.describe()}\n`)
    const [programs, projects, operators, redirects] = await Promise.all([
      source.programs<TeeRecord[]>(),
      source.projects(),
      source.operators(),
      source.redirects<unknown>(),
    ])
    if (redirects === null) process.stdout.write('Redirections : fichier amont absent, étape ignorée.\n')
    return new UpstreamSnapshot(programs, projects, source.rejectedProjects, redirects, operators, assets)
  }

  describeRejectedProjects(): string[] {
    return this.rejectedProjects.map((rejected) => TeeProjectRecords.describe(rejected))
  }
}
