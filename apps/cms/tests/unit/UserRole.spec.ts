import { describe, it, expect } from 'vitest'
import { UserRole, type UserRoleValue } from '@/utils/user/UserRole'

const u = (role: UserRoleValue) => ({ role })

describe('UserRole', () => {
  describe('constants', () => {
    it('defines the three role values', () => {
      expect(UserRole.SUPER_ADMIN).toBe('super-admin')
      expect(UserRole.ADMIN).toBe('admin')
      expect(UserRole.CREATOR).toBe('creator')
    })
  })

  describe('isSuperAdmin', () => {
    it('returns true for super-admin', () => {
      expect(UserRole.isSuperAdmin(u(UserRole.SUPER_ADMIN))).toBe(true)
    })

    it('returns false for roles below super-admin', () => {
      expect(UserRole.isSuperAdmin(u(UserRole.ADMIN))).toBe(false)
      expect(UserRole.isSuperAdmin(u(UserRole.CREATOR))).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isSuperAdmin(null)).toBe(false)
      expect(UserRole.isSuperAdmin(undefined)).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('returns true for super-admin and admin', () => {
      expect(UserRole.isAdmin(u(UserRole.SUPER_ADMIN))).toBe(true)
      expect(UserRole.isAdmin(u(UserRole.ADMIN))).toBe(true)
    })

    it('returns false for roles below admin', () => {
      expect(UserRole.isAdmin(u(UserRole.CREATOR))).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isAdmin(null)).toBe(false)
      expect(UserRole.isAdmin(undefined)).toBe(false)
    })
  })

  describe('isCreator', () => {
    it('returns true for all roles', () => {
      expect(UserRole.isCreator(u(UserRole.SUPER_ADMIN))).toBe(true)
      expect(UserRole.isCreator(u(UserRole.ADMIN))).toBe(true)
      expect(UserRole.isCreator(u(UserRole.CREATOR))).toBe(true)
    })

    it('returns false for null or undefined', () => {
      expect(UserRole.isCreator(null)).toBe(false)
      expect(UserRole.isCreator(undefined)).toBe(false)
    })
  })

  describe('isAtLeast', () => {
    it('respects the hierarchy: creator < admin < super-admin', () => {
      expect(UserRole.isAtLeast(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true)
      expect(UserRole.isAtLeast(UserRole.SUPER_ADMIN, UserRole.CREATOR)).toBe(true)
      expect(UserRole.isAtLeast(UserRole.CREATOR, UserRole.SUPER_ADMIN)).toBe(false)
      expect(UserRole.isAtLeast(UserRole.CREATOR, UserRole.ADMIN)).toBe(false)
      expect(UserRole.isAtLeast(UserRole.ADMIN, UserRole.CREATOR)).toBe(true)
    })

    it('returns true for equal roles', () => {
      expect(UserRole.isAtLeast(UserRole.CREATOR, UserRole.CREATOR)).toBe(true)
      expect(UserRole.isAtLeast(UserRole.ADMIN, UserRole.ADMIN)).toBe(true)
    })
  })
})
