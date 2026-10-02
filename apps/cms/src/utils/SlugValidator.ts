import type { TextFieldSingleValidation } from 'payload'
import { slugSchema } from '@tee-backoffice/canonical'

/**
 * Validation for a slug text field: the kebab-case rule of the canonical
 * format (`slugSchema`), so a slug accepted here is never refused by the pivot.
 * A custom `validate` replaces Payload's built-in `required` check, hence the
 * explicit handling of the flag.
 */
export class SlugValidator {
  private static readonly INVALID_MESSAGE =
    'Identifiant invalide : minuscules sans accent, chiffres et tirets uniquement (ex : plan-action-energie).'
  private static readonly REQUIRED_MESSAGE = 'Ce champ est requis.'

  static readonly validate: TextFieldSingleValidation = (value, options) => {
    if (value == null || value === '') {
      return options?.required ? SlugValidator.REQUIRED_MESSAGE : true
    }

    return slugSchema.safeParse(value).success ? true : SlugValidator.INVALID_MESSAGE
  }
}
