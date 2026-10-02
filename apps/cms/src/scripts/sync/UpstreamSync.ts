import type { Payload, Where } from 'payload'
import { ProgramRedirects, ProjectRedirects } from '@tee-backoffice/format-adapters'
import { getCanonicalProjectRepository } from '@/services/canonical/canonicalProjectRepository'
import { getCanonicalProgramRepository } from '@/services/canonical/canonicalRepository'
import { UpstreamRemovalGuard } from '@/services/upstream-sync/UpstreamRemovalGuard'
import { UpstreamMediaImporter } from './media/UpstreamMediaImporter'
import { ProgramsSync } from './programs/ProgramsSync'
import { ProjectsSync } from './projects/ProjectsSync'
import { CanonicalReconciler, type EntityReconciliation } from './CanonicalReconciler'
import type { GoneDocumentsReport } from './GoneDocumentsReport'
import { GoneDocumentsCanceller } from './GoneDocumentsCanceller'
import type { UpstreamSnapshot } from './UpstreamSnapshot'

export interface UpstreamSyncOptions {
  /** Lifts the ceiling on what one run may cancel or withdraw, for a mass removal decided on purpose. */
  allowMassRemoval?: boolean
  /** Restricts the documents that may be cancelled (the integration tests share one database). */
  scope?: { programs?: Where; projects?: Where }
  /** False skips the final CMS ↔ canonical check (same reason). */
  reconcile?: boolean
}

export interface UpstreamSyncReport {
  errors: number
  programs: { created: number; updated: number; unchanged: number; cancelled: string[] }
  projects: { created: number; updated: number; unchanged: number; cancelled: string[] }
}

/**
 * Aligns the CMS on upstream, the command shared by the seed and the daily job:
 * programs, then projects (redirects included), then the documents upstream no
 * longer accounts for, then the CMS ↔ canonical check. The canonical stores are
 * only written by the collection hooks, as for an editor. Every step runs even
 * when a previous one reported errors; the caller fails the job on `errors`.
 */
export class UpstreamSync {
  constructor(
    private readonly payload: Payload,
    private readonly snapshot: UpstreamSnapshot,
    private readonly options: UpstreamSyncOptions = {},
  ) {}

  async run(): Promise<UpstreamSyncReport> {
    const { payload, snapshot } = this
    const guard = this.options.allowMassRemoval ? UpstreamRemovalGuard.unlimited() : new UpstreamRemovalGuard()
    const media = snapshot.assets ? new UpstreamMediaImporter(payload, snapshot.assets) : undefined
    const stored = await this.storedCanonicalIds()

    const programs = await new ProgramsSync(
      payload,
      snapshot.programs,
      snapshot.operators && media ? { operators: snapshot.operators, media } : undefined,
      { redirects: new ProgramRedirects(snapshot.redirects), storedCanonicalIds: stored.programs },
    ).run()
    const projects = await new ProjectsSync(payload, snapshot.projects, media, {
      redirects: new ProjectRedirects(snapshot.redirects),
      storedCanonicalIds: stored.projects,
    }).run()
    if (media) this.reportMedia(media)

    const gonePrograms = await GoneDocumentsCanceller.forPrograms(payload, guard, this.options.scope?.programs).cancel(
      programs.snapshotSlugs,
    )
    this.reportGone('Dispositifs', gonePrograms)

    // A record set aside for its shape is still upstream: its project is kept as it is.
    const projectSlugs = new Set(projects.snapshotSlugs)
    for (const rejected of snapshot.rejectedProjects) {
      if (rejected.slug !== undefined) projectSlugs.add(rejected.slug)
    }
    const goneProjects = await GoneDocumentsCanceller.forProjects(payload, guard, this.options.scope?.projects).cancel(
      projectSlugs,
    )
    this.reportGone('Projets', goneProjects)

    const rejected = snapshot.describeRejectedProjects()
    if (rejected.length > 0) {
      process.stderr.write(`Projets amont écartés (${rejected.length.toString()}) :\n`)
      for (const line of rejected) process.stderr.write(`  ✗ ${line}\n`)
    }

    const reconciliationErrors = this.options.reconcile === false ? 0 : await this.reconcile(guard)

    return {
      errors:
        programs.errors +
        projects.errors +
        gonePrograms.errors +
        goneProjects.errors +
        rejected.length +
        reconciliationErrors,
      programs: {
        created: programs.created,
        updated: programs.updated,
        unchanged: programs.unchanged,
        cancelled: gonePrograms.cancelled,
      },
      projects: {
        created: projects.created,
        updated: projects.updated,
        unchanged: projects.unchanged,
        cancelled: goneProjects.cancelled,
      },
    }
  }

  private async storedCanonicalIds(): Promise<{ programs: Set<string>; projects: Set<string> }> {
    const [programs, projects] = await Promise.all([
      getCanonicalProgramRepository(this.payload.logger).then((repository) => repository.listKeys()),
      getCanonicalProjectRepository(this.payload.logger).then((repository) => repository.listKeys()),
    ])
    return {
      programs: new Set(programs.map((key) => key.canonicalId)),
      projects: new Set(projects.map((key) => key.canonicalId)),
    }
  }

  private async reconcile(guard: UpstreamRemovalGuard): Promise<number> {
    const report = await new CanonicalReconciler(this.payload, guard).reconcile()
    this.reportReconciliation('dispositifs', report.programs)
    this.reportReconciliation('projets', report.projects)
    if (report.errors === 0) process.stdout.write('Rapprochement CMS ↔ canonical : aucun écart restant.\n')
    return report.errors
  }

  private reportMedia(media: UpstreamMediaImporter): void {
    const { created, reused, recategorized, failed } = media.stats
    process.stdout.write(
      `Médias : ${created.toString()} créés, ${reused.toString()} réutilisés (dont ${recategorized.toString()} recatégorisés), ${failed.toString()} en échec.\n`,
    )
    // A missing file is reported, not fatal: the document is kept without its image.
    for (const [warning, count] of media.warnings) {
      process.stdout.write(`  ⚠ ${count.toString()} × ${warning}\n`)
    }
  }

  private reportGone(label: string, report: GoneDocumentsReport): void {
    if (report.refused) {
      process.stderr.write(`${label} disparus de l'amont : annulation refusée (${report.refused}).\n`)
      return
    }
    if (report.cancelled.length === 0) return
    process.stdout.write(`${label} disparus de l'amont, annulés : ${report.cancelled.length.toString()}\n`)
    for (const slug of report.cancelled) process.stdout.write(`  - ${slug}\n`)
  }

  private reportReconciliation(label: string, entity: EntityReconciliation): void {
    if (entity.refused) process.stderr.write(`Rapprochement des ${label} : retrait refusé (${entity.refused}).\n`)
    if (entity.removed.length > 0) {
      process.stdout.write(`Rapprochement des ${label} : ${entity.removed.length.toString()} ligne(s) retirée(s) du canonical\n`)
      for (const key of entity.removed) process.stdout.write(`  - ${key.slug}\n`)
    }
    if (entity.missing.length > 0) {
      process.stderr.write(`Rapprochement des ${label} : ${entity.missing.length.toString()} absent(s) du canonical\n`)
      for (const key of entity.missing) process.stderr.write(`  ✗ ${key.slug}\n`)
    }
  }
}
