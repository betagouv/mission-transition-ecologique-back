import { describe, it, expect } from 'vitest'
import { WorkflowActionPresenter } from '@/services/workflow/WorkflowActionPresenter'
import { UserRole } from '@/utils/user/UserRole'

const labels = (status: Parameters<typeof WorkflowActionPresenter.getActions>[0], role: Parameters<typeof WorkflowActionPresenter.getActions>[1]) =>
  WorkflowActionPresenter.getActions(status, role).map((a) => a.label)

describe('WorkflowActionPresenter', () => {
  describe('en-creation (point 13)', () => {
    it('offers the three explicit creator buttons', () => {
      expect(labels('en-creation', UserRole.CREATOR)).toEqual([
        'Enregistrer le brouillon',
        'Demander la relecture',
        'Supprimer',
      ])
    })

    it('keeps "Supprimer" (annule) last as the destructive action, routed to the overflow menu', () => {
      const actions = WorkflowActionPresenter.getActions('en-creation', UserRole.CREATOR)
      const last = actions[actions.length - 1]
      expect(last).toMatchObject({
        to: 'annule',
        label: 'Supprimer',
        variant: 'danger',
        placement: 'menu',
      })
    })

    it('keeps every action except "Supprimer" on the controls bar', () => {
      const actions = WorkflowActionPresenter.getActions('en-creation', UserRole.CREATOR)
      const bar = actions.filter((a) => a.placement === 'bar').map((a) => a.label)
      expect(bar).toEqual(['Enregistrer le brouillon', 'Demander la relecture'])
    })
  })

  describe('en-relecture', () => {
    it('labels the creator return-to-edit as "Annuler la demande de relecture" (point 14)', () => {
      const actions = WorkflowActionPresenter.getActions('en-relecture', UserRole.CREATOR)
      expect(actions).toEqual([
        expect.objectContaining({ to: 'en-cours-modification', label: 'Annuler la demande de relecture' }),
      ])
    })

    it('labels the admin return-to-edit as "Demander des corrections" (point 17)', () => {
      expect(labels('en-relecture', UserRole.ADMIN)).toEqual([
        'Publier',
        'Demander des corrections',
        'Supprimer',
      ])
    })
  })

  describe('final states (point 9)', () => {
    it('returns no actions, leaving only the informative badge', () => {
      expect(WorkflowActionPresenter.getActions('annule', UserRole.ADMIN)).toEqual([])
      expect(WorkflowActionPresenter.getActions('archive', UserRole.ADMIN)).toEqual([])
      expect(WorkflowActionPresenter.getActions('remplace', UserRole.ADMIN)).toEqual([])
    })
  })

  describe('publie', () => {
    it('flags the "Remplacer" action as requiring a replacement', () => {
      const replace = WorkflowActionPresenter.getActions('publie', UserRole.ADMIN).find(
        (a) => a.kind === 'transition' && a.to === 'remplace',
      )
      expect(replace).toMatchObject({ label: 'Remplacer', requiresReplacement: true })
    })
  })
})
