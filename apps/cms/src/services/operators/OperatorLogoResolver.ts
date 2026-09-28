import type { Media, Operator } from '../../../payload-types'

export type OperatorLogoOrigin = 'operateur' | 'groupe'

export interface EffectiveOperatorLogo {
  /** The media, or its id when the operator was read without populating its logo. */
  logo: Media | number
  origin: OperatorLogoOrigin
}

type LogoRef = Operator['logo']
type GroupRef = NonNullable<Operator['groups']>[number]

/**
 * Effective logo of an operator: its own logo, else the logo of the first of its
 * groups (in upstream order) that has one, else none. Expects an operator read
 * with `depth >= 2`: a group left as an id cannot be inspected and is skipped.
 */
export class OperatorLogoResolver {
  static resolve(operator: Pick<Operator, 'logo' | 'groups'>): EffectiveOperatorLogo | undefined {
    const own = OperatorLogoResolver.present(operator.logo)
    if (own !== undefined) return { logo: own, origin: 'operateur' }

    for (const group of operator.groups ?? []) {
      const groupLogo = OperatorLogoResolver.groupLogo(group)
      if (groupLogo !== undefined) return { logo: groupLogo, origin: 'groupe' }
    }
    return undefined
  }

  private static groupLogo(group: GroupRef): Media | number | undefined {
    return typeof group === 'object' ? OperatorLogoResolver.present(group.logo) : undefined
  }

  private static present(logo: LogoRef): Media | number | undefined {
    return logo ?? undefined
  }
}
