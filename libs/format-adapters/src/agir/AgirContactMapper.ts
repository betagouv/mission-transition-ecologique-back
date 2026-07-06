import type { ContactQuestion } from '@tee-backoffice/canonical'
import type { AgirContactQuestion } from './ademe-pivot.schema'

/**
 * Maps the canonical `contact_question` to the AGIR wire shape. Only the
 * discriminant casing differs (`ADEME → ademe`, snake_case/lowercase wire
 * vocabulary); every other channel and its value pass through unchanged.
 */
export class AgirContactMapper {
  static toAgir(contact: ContactQuestion): AgirContactQuestion {
    if (contact.type === 'ADEME') return { type: 'ademe' }
    return contact
  }
}
