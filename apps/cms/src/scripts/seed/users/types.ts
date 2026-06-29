import type { UserRoleValue } from '@/utils/user/UserRole'

export interface UserFixture {
  email: string
  name?: string
  role: UserRoleValue
  team?: string
  region?: string
  operatorSlug?: string
}
