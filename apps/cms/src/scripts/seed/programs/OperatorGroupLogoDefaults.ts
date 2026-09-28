/**
 * Upstream has no group logos, but some groups have a "generic" operator whose
 * logo stands for the whole group (e.g. the CCI logo for the regional CCIs).
 * Other groups stay without a logo, editable in the admin.
 */
export class OperatorGroupLogoDefaults {
  private static readonly PATHS: ReadonlyMap<string, string> = new Map([
    ["Agence de l'eau", '/images/logos/operateur/agence-de-l-eau.webp'],
    ['CCI', '/images/logos/operateur/cci.webp'],
    ['CMA', '/images/logos/operateur/cma.webp'],
    ['ADEME', '/images/logos/operateur/ademe.webp'],
    ['Bpifrance', '/images/logos/operateur/bpi.webp'],
  ])

  static pathFor(groupName: string): string | undefined {
    return OperatorGroupLogoDefaults.PATHS.get(groupName)
  }
}
