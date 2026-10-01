import { describe, it, expect, vi } from 'vitest'
import { RequiredRichTextValidator } from '@/utils/RequiredRichTextValidator'

// Stands for the Markdown conversion of the pivot: the text of the paragraphs, trimmed.
vi.mock('@/services/canonical/rich-text/richTextToMarkdownProvider', () => ({
  getRichTextToMarkdown: () =>
    Promise.resolve({
      convert: (value: { root: { children: { children?: { text?: string }[] }[] } } | null | undefined) =>
        (value?.root.children ?? [])
          .map((node) => (node.children ?? []).map((child) => child.text ?? '').join(''))
          .join('\n\n')
          .trim(),
    }),
}))

const REQUIRED = 'Ce champ est requis.'

const richText = (...paragraphs: string[]) => ({
  root: {
    type: 'root',
    children: paragraphs.map((text) => ({ type: 'paragraph', children: [{ type: 'text', text }] })),
  },
})

// Payload's built-in rich text validation delegates to the editor of the field.
const validate = (value: object | null | undefined, overrides: Record<string, unknown> = {}) => {
  const editor = { validate: vi.fn().mockResolvedValue(true) }
  const result = RequiredRichTextValidator.validate(value, {
    editor,
    req: { payload: { config: {} }, t: (key: string) => key },
    ...overrides,
  } as never)
  return { editor, result }
}

describe('RequiredRichTextValidator', () => {
  it.each([
    ['whitespace', richText('   ')],
    ['empty paragraphs', richText('', '')],
    ['blank paragraphs', richText(' ', '\t')],
  ])('rejects a required content made of %s', async (_label, value) => {
    expect(await validate(value, { required: true }).result).toBe(REQUIRED)
  })

  it('accepts a required content with text', async () => {
    expect(await validate(richText('', 'Contenu'), { required: true }).result).toBe(true)
  })

  it('accepts a blank content on an optional field', async () => {
    expect(await validate(richText('   ')).result).toBe(true)
    expect(await validate(null, { required: false }).result).toBe(true)
  })

  it('returns the error of the built-in validation first', async () => {
    const editor = { validate: vi.fn().mockResolvedValue('validation:required') }

    expect(await validate(null, { required: true, editor }).result).toBe('validation:required')
    expect(await validate(richText('Contenu'), { required: true, editor }).result).toBe('validation:required')
    expect(editor.validate).toHaveBeenCalledTimes(2)
  })
})
