import type { TextFieldSingleValidation } from 'payload'
import { z } from 'zod'

/**
 * Reusable validator for optional URL text fields.
 *
 * Empty values are accepted (the field stays optional); when a value is
 * provided it must be a well-formed http(s) URL or a mailto: link. Other
 * schemes (ftp:, javascript:, ...) are rejected.
 */
export class UrlValidator {
  static readonly ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'] as const

  private static readonly schema = z
    .string()
    .url({ message: 'URL invalide. Exemple attendu : https://...' })
    .refine(
      (value) => {
        try {
          return UrlValidator.ALLOWED_PROTOCOLS.includes(
            new URL(value).protocol as (typeof UrlValidator.ALLOWED_PROTOCOLS)[number],
          )
        } catch {
          // new URL only throws when .url() already failed; that issue stands.
          return true
        }
      },
      { message: 'L’URL doit commencer par http://, https:// ou mailto:.' },
    )

  static readonly validate: TextFieldSingleValidation = (value) => {
    const trimmed = value?.trim()
    if (trimmed == null || trimmed === '') return true

    const result = UrlValidator.schema.safeParse(trimmed)
    return result.success
      ? true
      : (result.error.issues[0]?.message ??
          'URL invalide. Exemple attendu : https://...')
  }
}
