import type { UserRoleValue } from '@/utils/user/UserRole'

export interface UserFixture {
  email: string
  role: UserRoleValue
  team?: string
  region?: string
  operatorSlug?: string
}
