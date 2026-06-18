import type { TextFieldSingleValidation } from 'payload'

/**
 * Reusable validator for optional URL text fields.
 *
 * Empty values are accepted (the field stays optional); when a value is
 * provided it must be a well-formed absolute http(s) URL.
 */
export class UrlValidator {
  static readonly ALLOWED_PROTOCOLS = ['http:', 'https:'] as const

  static readonly validate: TextFieldSingleValidation = (value) => {
    if (value == null || value === '') return true

    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      return 'URL invalide. Exemple attendu : https://...'
    }

    if (!UrlValidator.ALLOWED_PROTOCOLS.includes(parsed.protocol as (typeof UrlValidator.ALLOWED_PROTOCOLS)[number])) {
      return 'L’URL doit commencer par http:// ou https://.'
    }

    return true
  }
}
