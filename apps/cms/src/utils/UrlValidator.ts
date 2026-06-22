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

  private static readonly INVALID_MESSAGE =
    'URL invalide. Exemple attendu : https://...'
  private static readonly PROTOCOL_MESSAGE =
    'L’URL doit commencer par http://, https:// ou mailto:.'

  private static readonly schema = z.string().superRefine((value, ctx) => {
    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: UrlValidator.INVALID_MESSAGE })
      return
    }

    if (
      !UrlValidator.ALLOWED_PROTOCOLS.includes(
        parsed.protocol as (typeof UrlValidator.ALLOWED_PROTOCOLS)[number],
      )
    ) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: UrlValidator.PROTOCOL_MESSAGE })
      return
    }

    // Reject http(s) links whose host is not a real domain, e.g. a file:///
    // path pasted behind https:// parses with hostname "file" (no dot).
    if (parsed.protocol !== 'mailto:') {
      const host = parsed.hostname
      if (host !== 'localhost' && !host.includes('.')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: UrlValidator.INVALID_MESSAGE })
      }
    }
  })

  static readonly validate: TextFieldSingleValidation = (value) => {
    const trimmed = value?.trim()
    if (trimmed == null || trimmed === '') return true

    const result = UrlValidator.schema.safeParse(trimmed)
    return result.success
      ? true
      : (result.error.issues[0]?.message ?? UrlValidator.INVALID_MESSAGE)
  }
}
