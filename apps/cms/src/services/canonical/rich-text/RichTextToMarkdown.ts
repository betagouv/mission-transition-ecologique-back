/** A Payload Lexical rich text field value (`{ root: { children: [...] } }`). */
export type RichTextValue = { root: Record<string, unknown>; [k: string]: unknown }

/**
 * Port for converting Payload rich text to Markdown. The mapper depends on this
 * abstraction, not on Payload's converter: the real implementation needs the
 * sanitized server editor config (only available in a server runtime), while
 * tests inject a lightweight stub.
 */
export interface RichTextToMarkdown {
  convert(value: RichTextValue | null | undefined): string
}
