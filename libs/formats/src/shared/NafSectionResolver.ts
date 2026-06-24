import type { NafCode } from '@tee-backoffice/canonical'

/**
 * Réduit un code NAF (n'importe quel niveau) à sa **section** (lettre A–U).
 *
 * Sert à reconstruire `allowedNafSections` (programs.json) et à réduire le
 * secteur d'activité aux catégories principales (AGIR), à partir des codes
 * d'inclusion du pivot. Table des intervalles de divisions NAF rév. 2.
 */
export class NafSectionResolver {
  /** Intervalles de divisions (2 premiers chiffres) → section. NAF rév. 2. */
  private static readonly RANGES: ReadonlyArray<{ from: number; to: number; section: string }> = [
    { from: 1, to: 3, section: 'A' },
    { from: 5, to: 9, section: 'B' },
    { from: 10, to: 33, section: 'C' },
    { from: 35, to: 35, section: 'D' },
    { from: 36, to: 39, section: 'E' },
    { from: 41, to: 43, section: 'F' },
    { from: 45, to: 47, section: 'G' },
    { from: 49, to: 53, section: 'H' },
    { from: 55, to: 56, section: 'I' },
    { from: 58, to: 63, section: 'J' },
    { from: 64, to: 66, section: 'K' },
    { from: 68, to: 68, section: 'L' },
    { from: 69, to: 75, section: 'M' },
    { from: 77, to: 82, section: 'N' },
    { from: 84, to: 84, section: 'O' },
    { from: 85, to: 85, section: 'P' },
    { from: 86, to: 88, section: 'Q' },
    { from: 90, to: 93, section: 'R' },
    { from: 94, to: 96, section: 'S' },
    { from: 97, to: 98, section: 'T' },
    { from: 99, to: 99, section: 'U' },
  ]

  /** Section d'un code NAF, ou `undefined` si la division est inconnue. */
  static sectionOf(code: NafCode | string): string | undefined {
    const value = String(code)
    if (/^[A-U]$/.test(value)) {
      return value
    }
    const division = Number.parseInt(value.slice(0, 2), 10)
    if (Number.isNaN(division)) {
      return undefined
    }
    return NafSectionResolver.RANGES.find((range) => division >= range.from && division <= range.to)
      ?.section
  }

  /** Sections distinctes (triées) couvertes par une liste de codes NAF. */
  static sectionsOf(codes: readonly (NafCode | string)[]): string[] {
    const sections = new Set<string>()
    for (const code of codes) {
      const section = NafSectionResolver.sectionOf(code)
      if (section) {
        sections.add(section)
      }
    }
    return [...sections].sort()
  }
}
