import { describe, it, expect } from 'vitest'
import { WorkflowTransitionPolicy, type WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

describe('WorkflowTransitionPolicy', () => {
  describe('collections', () => {
    it('knows the collections that follow a workflow', () => {
      expect(WorkflowTransitionPolicy.isWorkflowCollection('programs')).toBe(true)
      expect(WorkflowTransitionPolicy.isWorkflowCollection('projects')).toBe(true)
      expect(WorkflowTransitionPolicy.isWorkflowCollection('operators')).toBe(false)
      expect(WorkflowTransitionPolicy.isWorkflowCollection(undefined)).toBe(false)
    })

    it('gives the projects a subset of the program statuses, with the same names', () => {
      const programs = WorkflowTransitionPolicy.statusesOf('programs')
      const projects = WorkflowTransitionPolicy.statusesOf('projects')
      expect(projects).toEqual(['en-creation', 'publie', 'en-cours-modification', 'annule', 'remplace'])
      expect(projects.every((status) => programs.includes(status))).toBe(true)
    })
  })

  describe('programs (default)', () => {
    it('keeps the review step: an admin cannot publish from creation', () => {
      expect(WorkflowTransitionPolicy.canTransition('en-creation', 'publie', UserRole.ADMIN)).toBe(false)
      expect(WorkflowTransitionPolicy.canTransition('en-creation', 'en-relecture', UserRole.ADMIN)).toBe(true)
    })
  })

  describe('projects', () => {
    const can = (from: WorkflowStatus, to: WorkflowStatus, role: UserRoleValue = UserRole.ADMIN) =>
      WorkflowTransitionPolicy.canTransition(from, to, role, 'projects')

    it('lets an admin publish without review', () => {
      expect(can('en-creation', 'publie')).toBe(true)
      expect(can('en-cours-modification', 'publie')).toBe(true)
    })

    it('lets an admin rewrite, replace or delete a published project', () => {
      expect(can('publie', 'en-cours-modification')).toBe(true)
      expect(can('publie', 'remplace')).toBe(true)
      expect(can('publie', 'annule')).toBe(true)
    })

    it('has no way out of a final status for an admin', () => {
      expect(WorkflowTransitionPolicy.getAllowedTransitions('annule', UserRole.ADMIN, 'projects')).toEqual([])
      expect(WorkflowTransitionPolicy.getAllowedTransitions('remplace', UserRole.ADMIN, 'projects')).toEqual([])
    })

    it('refuses every transition to a creator', () => {
      expect(can('en-creation', 'publie', UserRole.CREATOR)).toBe(false)
    })

    it('refuses a status the projects do not have, even to a super-admin', () => {
      expect(can('publie', 'archive', UserRole.SUPER_ADMIN)).toBe(false)
      expect(can('annule', 'publie', UserRole.SUPER_ADMIN)).toBe(true)
    })
  })
})
