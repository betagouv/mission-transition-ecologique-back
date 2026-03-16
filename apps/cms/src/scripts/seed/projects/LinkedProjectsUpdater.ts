import type { Payload } from 'payload'
import type { SourceProject } from './types'

export class LinkedProjectsUpdater {
  constructor(private readonly payload: Payload) {}

  async update(
    projects: SourceProject[],
    jsonIdToPayloadId: Map<number, number>,
  ): Promise<{ updated: number; errors: number }> {
    let updated = 0
    let errors = 0

    const projectsWithLinks = projects.filter(
      (p) => p.linkedProjects !== undefined && p.linkedProjects.length > 0,
    )

    await Promise.all(
      projectsWithLinks.map(async (project) => {
        const payloadId = jsonIdToPayloadId.get(project.id)
        if (payloadId === undefined) {
          process.stderr.write(
            `LinkedProjectsUpdater: no payload ID for project JSON id=${project.id.toString()} — skipping.\n`,
          )
          errors++
          return
        }

        const resolvedIds = (project.linkedProjects ?? [])
          .map((id) => {
            const resolved = jsonIdToPayloadId.get(id)
            if (resolved === undefined) {
              process.stderr.write(
                `LinkedProjectsUpdater: linked project JSON id=${id.toString()} not found — skipping link.\n`,
              )
            }
            return resolved
          })
          .filter((id): id is number => id !== undefined)

        try {
          await this.payload.update({
            collection: 'projects',
            id: payloadId,
            data: { linkedProjects: resolvedIds },
          })
          updated++
        } catch (err) {
          process.stderr.write(
            `LinkedProjectsUpdater: error updating project id=${payloadId.toString()}: ${String(err)}\n`,
          )
          errors++
        }
      }),
    )

    return { updated, errors }
  }
}
