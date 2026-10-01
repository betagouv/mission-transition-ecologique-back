import type { TextFieldSingleValidation } from 'payload'
import { nafCodeSchema } from '@tee-backoffice/canonical'

/**
 * Validation for a NAF section or code text field (`C`, `55`, `55.3`, `01.11Z`).
 *
 * Delegates to `nafCodeSchema` of the canonical format, so a value accepted
 * here is never refused by the pivot. The raw value is checked, untrimmed:
 * Payload stores it as typed. A custom `validate` replaces Payload's built-in
 * `required` check, hence the explicit handling of the flag.
 */
export class NafCodeValidator {
  private static readonly INVALID_MESSAGE =
    'Code NAF invalide. Exemples attendus : C, 55, 55.3, 01.11Z.'
  private static readonly REQUIRED_MESSAGE = 'Ce champ est requis.'

  static readonly validate: TextFieldSingleValidation = (value, options) => {
    if (value == null || value === '') {
      return options?.required ? NafCodeValidator.REQUIRED_MESSAGE : true
    }

    return nafCodeSchema.safeParse(value).success ? true : NafCodeValidator.INVALID_MESSAGE
  }
}
