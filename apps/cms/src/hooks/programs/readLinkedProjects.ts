import type { FieldHook } from 'payload'
import { ProgramProjectLinks } from '@/services/programs/ProgramProjectLinks'
import type { Program } from '../../../payload-types'

/**
 * Fills the virtual `linkedProjects` of a program with the projects that list
 * it. Left out of lists: it costs one query per program.
 */
export const readLinkedProjects: FieldHook<Program> = async ({ data, findMany, req, value }) => {
  if (findMany || data?.id === undefined) return value
  return new ProgramProjectLinks(req).projectIdsOf(data.id)
}
