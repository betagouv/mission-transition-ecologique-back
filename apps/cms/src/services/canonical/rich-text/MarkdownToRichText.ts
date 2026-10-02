import type { Program } from '../../../../payload-types'

export type RichTextDocument = Program['description']

/**
 * Port for converting Markdown to Payload rich text, the inverse of
 * `RichTextToMarkdown`. The real implementation needs the sanitized editor
 * config; tests inject a stub.
 */
export interface MarkdownToRichText {
  convert(markdown: string): RichTextDocument
}
