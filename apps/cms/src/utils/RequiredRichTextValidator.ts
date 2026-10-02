import type { RichTextFieldValidation } from 'payload'
import { validations } from 'payload'
import type { RichTextValue } from '@/services/canonical/rich-text/RichTextToMarkdown'
import { getRichTextToMarkdown } from '@/services/canonical/rich-text/richTextToMarkdownProvider'

/**
 * Validation for required rich text fields that also refuses a content with
 * nothing to read (whitespace, empty paragraphs): Payload's built-in check only
 * catches a single empty paragraph. "Empty" is decided by the Markdown
 * conversion used for the canonical format, so a content accepted here is never
 * dropped as empty by the pivot. Payload's own validation runs first.
 */
export class RequiredRichTextValidator {
  private static readonly REQUIRED_MESSAGE = 'Ce champ est requis.'

  static readonly validate: RichTextFieldValidation = async (value, options) => {
    const builtIn = await validations.richText(value, options)
    if (builtIn !== true || !options.required) return builtIn

    const markdown = await getRichTextToMarkdown(options.req.payload.config)
    return markdown.convert(value as RichTextValue | null | undefined).trim() === ''
      ? RequiredRichTextValidator.REQUIRED_MESSAGE
      : true
  }
}
