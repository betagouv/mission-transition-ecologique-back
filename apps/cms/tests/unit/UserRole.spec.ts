import { describe, it, expect } from 'vitest'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

const u = (role: UserRoleValue) => ({ role })

describe('UserRole', () => {
  describe('constants', () => {
    it('defines the four role values', () => {
      expect(UserRole.SUPER_ADMIN).toBe('super-admin')
      expect(UserRole.ADMIN_AIDE).toBe('administrateur-aide')
      expect(UserRole.CONTRIBUTEUR).toBe('contributeur')
      expect(UserRole.OBSERVATEUR).toBe('observateur')
    })
  })

  describe('isSuperAdmin', () => {
    it('returns true for super-admin', () => {
      expect(UserRole.isSuperAdmin(u(UserRole.SUPER_ADMIN))).toBe(true)
    })

    it('returns false for roles below super-admin', () => {
      expect(UserRole.isSuperAdmin(u(UserRole.ADMIN_AIDE))).toBe(false)
      expect(UserRole.isSuperAdmin(u(UserRole.CONTRIBUTEUR))).toBe(false)
      expect(UserRole.isSuperAdmin(u(UserRole.OBSERVATEUR))).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isSuperAdmin(null)).toBe(false)
      expect(UserRole.isSuperAdmin(undefined)).toBe(false)
    })
  })

  describe('isAdminAide', () => {
    it('returns true for super-admin and administrateur-aide', () => {
      expect(UserRole.isAdminAide(u(UserRole.SUPER_ADMIN))).toBe(true)
      expect(UserRole.isAdminAide(u(UserRole.ADMIN_AIDE))).toBe(true)
    })

    it('returns false for roles below administrateur-aide', () => {
      expect(UserRole.isAdminAide(u(UserRole.CONTRIBUTEUR))).toBe(false)
      expect(UserRole.isAdminAide(u(UserRole.OBSERVATEUR))).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isAdminAide(null)).toBe(false)
      expect(UserRole.isAdminAide(undefined)).toBe(false)
    })
  })

  describe('isContributeur', () => {
    it('returns true for super-admin, administrateur-aide and contributeur', () => {
      expect(UserRole.isContributeur(u(UserRole.SUPER_ADMIN))).toBe(true)
      expect(UserRole.isContributeur(u(UserRole.ADMIN_AIDE))).toBe(true)
      expect(UserRole.isContributeur(u(UserRole.CONTRIBUTEUR))).toBe(true)
    })

    it('returns false for observateur', () => {
      expect(UserRole.isContributeur(u(UserRole.OBSERVATEUR))).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isContributeur(null)).toBe(false)
      expect(UserRole.isContributeur(undefined)).toBe(false)
    })
  })

  describe('isObservateur', () => {
    it('returns true for all roles', () => {
      expect(UserRole.isObservateur(u(UserRole.SUPER_ADMIN))).toBe(true)
      expect(UserRole.isObservateur(u(UserRole.ADMIN_AIDE))).toBe(true)
      expect(UserRole.isObservateur(u(UserRole.CONTRIBUTEUR))).toBe(true)
      expect(UserRole.isObservateur(u(UserRole.OBSERVATEUR))).toBe(true)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isObservateur(null)).toBe(false)
      expect(UserRole.isObservateur(undefined)).toBe(false)
    })
  })

  describe('isAtLeast', () => {
    it('respects the hierarchy: observateur < contributeur < administrateur-aide < super-admin', () => {
      expect(UserRole.isAtLeast(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true)
      expect(UserRole.isAtLeast(UserRole.SUPER_ADMIN, UserRole.OBSERVATEUR)).toBe(true)
      expect(UserRole.isAtLeast(UserRole.OBSERVATEUR, UserRole.SUPER_ADMIN)).toBe(false)
      expect(UserRole.isAtLeast(UserRole.CONTRIBUTEUR, UserRole.ADMIN_AIDE)).toBe(false)
      expect(UserRole.isAtLeast(UserRole.ADMIN_AIDE, UserRole.CONTRIBUTEUR)).toBe(true)
    })

    it('returns true for equal roles', () => {
      expect(UserRole.isAtLeast(UserRole.CONTRIBUTEUR, UserRole.CONTRIBUTEUR)).toBe(true)
      expect(UserRole.isAtLeast(UserRole.OBSERVATEUR, UserRole.OBSERVATEUR)).toBe(true)
    })
  })
})
