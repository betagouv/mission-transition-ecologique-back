export interface UserFixture {
  email: string
  role: 'super-admin' | 'administrateur-aide' | 'contributeur' | 'observateur'
  team?: string
  region?: string
  operatorSlug?: string
}
