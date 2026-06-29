import type { RichTextToMarkdown, RichTextValue } from '@/services/canonical/rich-text/RichTextToMarkdown'
import type { Program } from '../../../payload-types'

export const CUID = 'a1b2c3d4e5f6g7h8i9j0klmn'
export const TIMESTAMP = '2026-03-19T17:00:00.000Z'

/** Minimal Lexical rich text wrapping a single paragraph. */
export function richText(text: string): Program['description'] {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [{ type: 'text', text, format: 0, version: 1 }],
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  }
}

/** A minimal, valid Payload program with all required fields populated. */
export function buildProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 1,
    canonicalId: CUID,
    title: 'Visite Énergie',
    operator: { id: 1, name: 'ADEME', updatedAt: TIMESTAMP, createdAt: TIMESTAMP },
    url: 'https://example.org/visite',
    aidType: 'financement',
    promise: 'Réduisez votre facture énergétique',
    description: richText('Un accompagnement pour les PME industrielles.'),
    slug: 'visite-energie',
    workflowStatus: 'publie',
    updatedAt: TIMESTAMP,
    createdAt: TIMESTAMP,
    ...overrides,
  } as Program
}

/**
 * Test double for the rich text → Markdown port. Markdown fidelity is Payload's
 * concern (PayloadRichTextToMarkdown); here we flatten text nodes deterministically.
 */
export class StubRichTextToMarkdown implements RichTextToMarkdown {
  convert(value: RichTextValue | null | undefined): string {
    const children = value?.root?.children
    if (!Array.isArray(children)) return ''
    return children.map((block) => StubRichTextToMarkdown.text(block)).join('\n\n').trim()
  }

  private static text(node: unknown): string {
    if (typeof node !== 'object' || node === null) return ''
    const record = node as { text?: unknown; children?: unknown }
    if (typeof record.text === 'string') return record.text
    if (Array.isArray(record.children)) {
      return record.children.map((child) => StubRichTextToMarkdown.text(child)).join('')
    }
    return ''
  }
}
