import type { CollectionAfterChangeHook } from 'payload'
import { ProgramProjectLinks } from '@/services/programs/ProgramProjectLinks'
import type { Program } from '../../../payload-types'

/**
 * Writes the `linkedProjects` picked on a program to `Projects.programs`, the
 * only stored side of the link. Applied on every save, draft included: the
 * field is virtual, no program version holds it until publication.
 */
export const syncLinkedProjects: CollectionAfterChangeHook<Program> = async ({ data, doc, req }) => {
  // Absent from a write that does not carry the field: the upstream sync, a partial update.
  if (!Array.isArray(data.linkedProjects)) return doc

  const projectIds = ProgramProjectLinks.ids(data.linkedProjects)
  await new ProgramProjectLinks(req).replace(doc.id, projectIds)
  // `doc` was read before the projects were written.
  return { ...doc, linkedProjects: projectIds }
}
