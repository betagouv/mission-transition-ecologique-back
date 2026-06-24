import type { ZodTypeAny } from 'zod'

/** Une non-conformité : un libellé d'élément + ses messages d'erreur zod. */
export interface ValidationFinding {
  label: string
  issues: string[]
}

/** Cible de journalisation (injectable pour les tests). */
export interface WarnLogger {
  warn: (message: string) => void
}

/**
 * Validation **non bloquante** des sorties d'export contre un schéma zod.
 *
 * Les exports ne lèvent jamais : on collecte les non-conformités et on les
 * **avertit** (`console.warn`). La décision de *quoi* valider (ex. seulement les
 * fiches publiées) appartient à l'appelant — voir les scripts d'export.
 */
export class ExportValidation {
  /** Valide chaque élément ; renvoie les non-conformités (vide = tout est conforme). */
  static collect(
    schema: ZodTypeAny,
    items: readonly unknown[],
    labelOf: (item: unknown, index: number) => string,
  ): ValidationFinding[] {
    const findings: ValidationFinding[] = []
    items.forEach((item, index) => {
      const result = schema.safeParse(item)
      if (!result.success) {
        findings.push({
          label: labelOf(item, index),
          issues: result.error.issues.map((issue) => `${issue.path.join('.') || '(racine)'} : ${issue.message}`),
        })
      }
    })
    return findings
  }

  /** Journalise les non-conformités en avertissement (ne lève pas). */
  static warn(context: string, findings: readonly ValidationFinding[], logger: WarnLogger = console): void {
    for (const finding of findings) {
      logger.warn(`⚠️ [${context}] ${finding.label} non conforme :\n  - ${finding.issues.join('\n  - ')}`)
    }
  }
}
