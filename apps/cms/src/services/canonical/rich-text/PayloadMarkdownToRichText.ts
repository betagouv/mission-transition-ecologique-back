import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SanitizedConfig } from 'payload'
import type { MarkdownToRichText, RichTextDocument } from './MarkdownToRichText'

type EditorConfig = Awaited<ReturnType<typeof editorConfigFactory.default>>

/** Production adapter backing the Markdown → rich text port with Payload's converter. */
export class PayloadMarkdownToRichText implements MarkdownToRichText {
  private constructor(private readonly editorConfig: EditorConfig) {}

  static async create(config: SanitizedConfig): Promise<PayloadMarkdownToRichText> {
    return new PayloadMarkdownToRichText(await editorConfigFactory.default({ config }))
  }

  convert(markdown: string): RichTextDocument {
    return convertMarkdownToLexical({ editorConfig: this.editorConfig, markdown }) as RichTextDocument
  }
}
