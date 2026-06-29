import { convertLexicalToMarkdown, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SanitizedConfig } from 'payload'
import type { RichTextToMarkdown, RichTextValue } from './RichTextToMarkdown'

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.default>>
type LexicalData = Parameters<typeof convertLexicalToMarkdown>[0]['data']

/**
 * Production adapter backing the rich text → Markdown port with Payload's own
 * `convertLexicalToMarkdown`. The sanitized server editor config is resolved
 * once via `create()` (async) and reused for synchronous conversions.
 */
export class PayloadRichTextToMarkdown implements RichTextToMarkdown {
  private constructor(private readonly editorConfig: EditorConfig) {}

  /** Builds the adapter from the sanitized Payload config (default editor). */
  static async create(config: SanitizedConfig): Promise<PayloadRichTextToMarkdown> {
    const editorConfig = await editorConfigFactory.default({ config })
    return new PayloadRichTextToMarkdown(editorConfig)
  }

  convert(value: RichTextValue | null | undefined): string {
    if (!value?.root) return ''
    return convertLexicalToMarkdown({
      data: value as unknown as LexicalData,
      editorConfig: this.editorConfig,
    }).trim()
  }
}
