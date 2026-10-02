import type { TextareaFieldValidation, TextFieldSingleValidation } from 'payload'
import { validations } from 'payload'

/**
 * Validation for required `text` and `textarea` fields that also refuses a
 * value made only of whitespace: Payload's built-in `required` check accepts
 * it, while the canonical format trims it and then refuses the document. An
 * optional field keeps the built-in behaviour, and so do the other built-in
 * checks (length), which are delegated to Payload.
 */
export class RequiredTextValidator {
  private static readonly REQUIRED_MESSAGE = 'Ce champ est requis.'

  static readonly text: TextFieldSingleValidation = (value, options) => {
    if (RequiredTextValidator.isMissing(value, options?.required)) return RequiredTextValidator.REQUIRED_MESSAGE
    return (validations.text as TextFieldSingleValidation)(value, options)
  }

  static readonly textarea: TextareaFieldValidation = (value, options) => {
    if (RequiredTextValidator.isMissing(value, options?.required)) return RequiredTextValidator.REQUIRED_MESSAGE
    return validations.textarea(value, options)
  }

  private static isMissing(value: string | null | undefined, required: boolean | undefined): boolean {
    return Boolean(required) && (typeof value !== 'string' || value.trim() === '')
  }
}
