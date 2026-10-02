import type { Payload } from 'payload'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import type { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { UpstreamFingerprint } from '@/services/upstream-sync/UpstreamFingerprint'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { SyncErrorFormatter } from '../SyncErrorFormatter'
import { ProjectImporter, type ProjectImport } from './ProjectImporter'

export interface LinkedProjectsUpdate {
  updated: number
  errors: number
  warnings: string[]
}

/**
 * Second pass of the projects seed: a project can only point at its linked
 * projects once they all exist. Each update republishes the project, which
 * rewrites its canonical row with the links the first pass could not carry,
 * and stamps the fingerprint the first pass held back. A project the first
 * pass left alone is not touched.
 */
export class LinkedProjectsUpdater {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: CanonicalProjectToPayloadMapper,
  ) {}

  async update(
    projects: CanonicalProjectInput[],
    { payloadIdByCanonicalId, fingerprintBases }: Pick<ProjectImport, 'payloadIdByCanonicalId' | 'fingerprintBases'>,
  ): Promise<LinkedProjectsUpdate> {
    const result: LinkedProjectsUpdate = { updated: 0, errors: 0, warnings: [] }

    // Sequential on purpose: concurrent updates deadlock on Postgres (each one
    // rewrites `projects_rels` rows that lock projects other updates are writing).
    for (const project of projects) {
      if (!ProjectImporter.hasLinkedProjects(project)) continue
      // A project the first pass failed to write was already counted as an error,
      // one it left unchanged has no id here either.
      const payloadId = payloadIdByCanonicalId.get(project.id)
      if (payloadId === undefined) continue

      const { linkedProjects, warnings } = this.mapper.mapLinkedProjects(project)
      result.warnings.push(...warnings.map((warning) => `${project.slug} : ${warning}`))

      try {
        const upstreamFingerprint = UpstreamFingerprint.of({ ...fingerprintBases.get(project.id), linkedProjects })
        const context = SystemWorkflowContext.create()
        if (project.statut_projet === 'remplace') {
          // A replaced project lives in a draft version, like its first write.
          const data = { linkedProjects, upstreamFingerprint }
          await this.payload.update({ collection: 'projects', id: payloadId, data, draft: true, context })
        } else {
          const data = { linkedProjects, _status: 'published' as const, upstreamFingerprint }
          await this.payload.update({ collection: 'projects', id: payloadId, data, context })
        }
        result.updated++
      } catch (err) {
        process.stderr.write(
          `LinkedProjectsUpdater: error updating project "${project.slug}": ${SyncErrorFormatter.format(err)}\n`,
        )
        result.errors++
      }
    }

    return result
  }
}
