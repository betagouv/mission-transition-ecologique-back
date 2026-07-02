import type { NumberFieldValidation } from 'payload'

/**
 * Validation for non-negative integer number fields (e.g. headcount bounds).
 *
 * Empty stays accepted (the field is optional / revealed conditionally); when a
 * value is present it must be a whole number >= 0. Payload's number field has no
 * built-in "integer only" rule, hence this reusable check.
 */
export class IntegerValidator {
  private static readonly INTEGER_MESSAGE = 'Saisissez un nombre entier.'
  private static readonly NEGATIVE_MESSAGE = 'Saisissez un nombre positif ou nul.'

  static readonly nonNegative: NumberFieldValidation = (value) => {
    // Single number field: ignore empty and the hasMany (number[]) shape.
    if (typeof value !== 'number') return true
    if (!Number.isInteger(value)) return IntegerValidator.INTEGER_MESSAGE
    if (value < 0) return IntegerValidator.NEGATIVE_MESSAGE
    return true
  }
}
