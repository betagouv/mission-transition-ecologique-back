import type { NumberFieldValidation } from 'payload'

/**
 * Validation for non-negative integer number fields (e.g. headcount bounds,
 * project priorities).
 *
 * Empty is accepted unless the field is `required` (a custom `validate` replaces
 * Payload's built-in check, hence the explicit handling of the flag); when a
 * value is present it must be a whole number >= 0. Payload's number field has no
 * built-in "integer only" rule, hence this reusable check.
 */
export class IntegerValidator {
  private static readonly INTEGER_MESSAGE = 'Saisissez un nombre entier.'
  private static readonly NEGATIVE_MESSAGE = 'Saisissez un nombre positif ou nul.'
  private static readonly REQUIRED_MESSAGE = 'Ce champ est requis.'

  static readonly nonNegative: NumberFieldValidation = (value, options) => {
    // Single number field: empty and the hasMany (number[]) shape carry no value to check.
    if (typeof value !== 'number') {
      return options?.required && value == null ? IntegerValidator.REQUIRED_MESSAGE : true
    }
    if (!Number.isInteger(value)) return IntegerValidator.INTEGER_MESSAGE
    if (value < 0) return IntegerValidator.NEGATIVE_MESSAGE
    return true
  }
}
