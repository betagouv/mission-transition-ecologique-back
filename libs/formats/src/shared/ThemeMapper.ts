import type { Theme } from '@tee-backoffice/canonical'

/**
 * Taxonomie thématique : le pivot est en **français** (`energie`, `batiment`…).
 *
 * - AGIR garde le français (les clés AGIR sont françaises) → pas de mapping.
 * - programs.json historise les `priorityObjectives` en **anglais** : pour
 *   rester iso, `TeeExporter` traduit FR → EN via cette table.
 * - Le schéma interministériel n'a pas de champ thème.
 */
export class ThemeMapper {
  private static readonly FR_TO_EN: Record<Theme, string> = {
    batiment: 'building',
    mobilite: 'mobility',
    dechets: 'waste',
    eau: 'water',
    energie: 'energy',
    rh: 'rh',
    environnemental: 'environmental',
    ecoconception: 'eco-design',
    biodiversite: 'biodiversite',
  }

  /** Inverse table (programs.json → pivot), derived from {@link FR_TO_EN}. */
  private static readonly EN_TO_FR: Record<string, Theme> = Object.fromEntries(
    Object.entries(ThemeMapper.FR_TO_EN).map(([fr, en]) => [en, fr as Theme]),
  )

  static toEnglish(theme: Theme): string {
    return ThemeMapper.FR_TO_EN[theme]
  }

  static toEnglishList(themes: readonly Theme[]): string[] {
    return themes.map((theme) => ThemeMapper.toEnglish(theme))
  }

  /** programs.json `priorityObjectives` (EN) → pivot theme, or `undefined` if unknown. */
  static toFrench(english: string): Theme | undefined {
    return ThemeMapper.EN_TO_FR[english]
  }

  /** Pivot themes for a list of EN labels (unknown labels dropped). */
  static toFrenchList(english: readonly string[]): Theme[] {
    return english
      .map((label) => ThemeMapper.toFrench(label))
      .filter((theme): theme is Theme => theme !== undefined)
  }
}
