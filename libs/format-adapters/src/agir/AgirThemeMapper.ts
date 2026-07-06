import type { Theme } from '@tee-backoffice/canonical'

/** AGIR theme vocabulary (the 7 wire values). */
export type AgirTheme = 'batiment' | 'mobilite' | 'dechets' | 'eau' | 'energie' | 'rh' | 'environnement'

/**
 * Maps the canonical `themes` to the AGIR theme vocabulary. The three
 * environment-family canonical themes (`environnemental`, `ecoconception`,
 * `biodiversite`) collapse to a single `environnement` value; the result is
 * de-duplicated.
 */
export class AgirThemeMapper {
  private static readonly THEME: Record<Theme, AgirTheme> = {
    batiment: 'batiment',
    mobilite: 'mobilite',
    dechets: 'dechets',
    eau: 'eau',
    energie: 'energie',
    rh: 'rh',
    environnemental: 'environnement',
    ecoconception: 'environnement',
    biodiversite: 'environnement',
  }

  static toAgir(themes: readonly Theme[]): AgirTheme[] {
    return [...new Set(themes.map((theme) => AgirThemeMapper.THEME[theme]))]
  }
}
