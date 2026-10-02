import type { Payload } from 'payload'
import type { CanonicalProjectInput } from '@tee-backoffice/canonical'
import type { CanonicalProjectToPayloadMapper } from '@/services/canonical/to-payload/CanonicalProjectToPayloadMapper'
import { SystemWorkflowContext } from '@/services/workflow/SystemWorkflowContext'
import { SeedErrorFormatter } from '../SeedErrorFormatter'
import { ProjectImporter } from './ProjectImporter'

export interface LinkedProjectsUpdate {
  updated: number
  errors: number
  warnings: string[]
}

/**
 * Second pass of the projects seed: a project can only point at its linked
 * projects once they all exist. Each update republishes the project, which
 * rewrites its canonical row with the links the first pass could not carry.
 */
export class LinkedProjectsUpdater {
  constructor(
    private readonly payload: Payload,
    private readonly mapper: CanonicalProjectToPayloadMapper,
  ) {}

  async update(
    projects: CanonicalProjectInput[],
    payloadIdByCanonicalId: ReadonlyMap<string, number>,
  ): Promise<LinkedProjectsUpdate> {
    const result: LinkedProjectsUpdate = { updated: 0, errors: 0, warnings: [] }

    // Sequential on purpose: concurrent updates deadlock on Postgres (each one
    // rewrites `projects_rels` rows that lock projects other updates are writing).
    for (const project of projects) {
      if (!ProjectImporter.hasLinkedProjects(project)) continue
      // A project the first pass failed to write was already counted as an error.
      const payloadId = payloadIdByCanonicalId.get(project.id)
      if (payloadId === undefined) continue

      const { linkedProjects, warnings } = this.mapper.mapLinkedProjects(project)
      result.warnings.push(...warnings.map((warning) => `${project.slug} : ${warning}`))

      try {
        await this.payload.update({
          collection: 'projects',
          id: payloadId,
          data: { linkedProjects, _status: 'published' },
          context: SystemWorkflowContext.create(),
        })
        result.updated++
      } catch (err) {
        process.stderr.write(
          `LinkedProjectsUpdater: error updating project "${project.slug}": ${SeedErrorFormatter.format(err)}\n`,
        )
        result.errors++
      }
    }

    return result
  }
}
