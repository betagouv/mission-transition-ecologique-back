import type { SanitizedConfig } from 'payload'
import { PayloadRichTextToMarkdown } from './PayloadRichTextToMarkdown'
import type { RichTextToMarkdown } from './RichTextToMarkdown'

let markdownPromise: Promise<RichTextToMarkdown> | undefined

/**
 * Memoized rich text → Markdown adapter. `PayloadRichTextToMarkdown.create`
 * rebuilds the sanitized editor config, which is identical across calls (same
 * Payload config), so it is resolved once and reused on every publish.
 */
export function getRichTextToMarkdown(config: SanitizedConfig): Promise<RichTextToMarkdown> {
  return (markdownPromise ??= PayloadRichTextToMarkdown.create(config))
}
