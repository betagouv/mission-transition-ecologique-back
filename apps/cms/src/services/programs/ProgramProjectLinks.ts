import type { PayloadRequest } from 'payload'
import type { Program, Project } from '../../../payload-types'

type Relation = number | { id: number }
type CitingProject = Pick<Project, 'id' | 'programs' | '_status'>

/**
 * Projects of a program. The link is stored on one side only,
 * `Projects.programs`: the program side reads it from there and writes it back
 * there, so the two sides cannot drift apart.
 *
 * Everything is read on the latest version of a project, and written back the
 * way that version stands: a project whose latest version is a draft (being
 * edited, replaced, cancelled) gets a new draft, so pending content is never
 * published by a change of link.
 */
export class ProgramProjectLinks {
  constructor(private readonly req: PayloadRequest) {}

  async projectIdsOf(programId: Program['id']): Promise<number[]> {
    return (await this.citing(programId)).map((project) => project.id)
  }

  async replace(programId: Program['id'], projectIds: number[]): Promise<void> {
    const citing = await this.citing(programId)
    const selected = new Set(projectIds)
    const current = new Set(citing.map((project) => project.id))

    // Sequential: parallel writes deadlock on `projects_rels`.
    for (const project of citing) {
      if (selected.has(project.id)) continue
      await this.write(project, ProgramProjectLinks.ids(project.programs).filter((id) => id !== programId))
    }
    for (const projectId of selected) {
      if (current.has(projectId)) continue
      const project = await this.req.payload.findByID({
        collection: 'projects',
        id: projectId,
        draft: true,
        depth: 0,
        select: { programs: true, _status: true },
        req: this.req,
      })
      await this.write(project, [...ProgramProjectLinks.ids(project.programs), programId])
    }
  }

  static ids(relations: Relation[] | null | undefined): number[] {
    return (relations ?? []).map((relation) => (typeof relation === 'object' ? relation.id : relation))
  }

  private async citing(programId: Program['id']): Promise<CitingProject[]> {
    const result = await this.req.payload.find({
      collection: 'projects',
      where: { programs: { in: [programId] } },
      draft: true,
      depth: 0,
      pagination: false,
      sort: 'title',
      select: { programs: true, _status: true },
      req: this.req,
    })
    return result.docs
  }

  private async write(project: CitingProject, programs: number[]): Promise<void> {
    await this.req.payload.update({
      collection: 'projects',
      id: project.id,
      data: { programs },
      draft: project._status !== 'published',
      depth: 0,
      req: this.req,
    })
  }
}
