import type { RelationshipFieldSingleValidation } from 'payload'
import { validations } from 'payload'

/**
 * Required validation for single relationship fields that surfaces inline, like
 * text fields do.
 *
 * Payload's built-in relationship validation returns `true` on the client
 * `onChange` pass (`if (event === 'onChange') return true`), so a required
 * relationship is only flagged server-side. When sibling text fields fail
 * client-side, the submit aborts before reaching the server and the
 * relationship is never marked. Checking `required` here (which runs on
 * `onChange` too) makes the red indicator appear like the other fields, then
 * delegates to the built-in validation so `filterOptions` and id checks still
 * run on submit.
 */
export class RelationshipValidator {
  private static readonly REQUIRED_MESSAGE = 'Ce champ est requis.'

  static readonly required: RelationshipFieldSingleValidation = (value, options) => {
    if (value == null) {
      return options?.required ? RelationshipValidator.REQUIRED_MESSAGE : true
    }
    return (validations.relationship as RelationshipFieldSingleValidation)(value, options)
  }
}
