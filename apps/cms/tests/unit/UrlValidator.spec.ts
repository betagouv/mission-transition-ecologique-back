import { describe, it, expect } from 'vitest'
import { UrlValidator } from '@/utils/UrlValidator'

// The Payload validator signature passes several runtime arguments we don't use
// here; an empty options object is enough to exercise the validation logic.
const validate = (value: string | null | undefined) =>
  UrlValidator.validate(value, {} as never)

describe('UrlValidator', () => {
  describe('empty values are accepted (field stays optional)', () => {
    it('accepts null, undefined and empty string', () => {
      expect(validate(null)).toBe(true)
      expect(validate(undefined)).toBe(true)
      expect(validate('')).toBe(true)
    })

    it('accepts whitespace-only values', () => {
      expect(validate('   ')).toBe(true)
    })
  })

  describe('required fields reject empty values', () => {
    const validateRequired = (value: string | null | undefined) =>
      UrlValidator.validate(value, { required: true } as never)

    it('rejects null, undefined, empty and whitespace-only when required', () => {
      expect(validateRequired(null)).toBe('Ce champ est requis.')
      expect(validateRequired(undefined)).toBe('Ce champ est requis.')
      expect(validateRequired('')).toBe('Ce champ est requis.')
      expect(validateRequired('   ')).toBe('Ce champ est requis.')
    })

    it('still accepts a well-formed URL when required', () => {
      expect(validateRequired('https://example.org')).toBe(true)
    })
  })

  describe('well-formed http(s) and mailto URLs are accepted', () => {
    it('accepts http and https URLs', () => {
      expect(validate('http://example.org')).toBe(true)
      expect(validate('https://example.org/path?query=1')).toBe(true)
    })

    it('accepts mailto links', () => {
      expect(validate('mailto:test@example.org')).toBe(true)
    })

    it('accepts URLs with leading/trailing whitespace (trimmed before parsing)', () => {
      expect(validate('  https://example.org  ')).toBe(true)
    })
  })

  describe('invalid URLs are rejected', () => {
    it('rejects strings that are not URLs', () => {
      expect(validate('not a url')).toBe('URL invalide. Exemple attendu : https://...')
    })

    it('rejects http(s) URLs with a malformed host', () => {
      expect(validate('https://- <https://example.org>')).toBe(
        'URL invalide. Exemple attendu : https://...',
      )
    })

    it('rejects a file:/// path pasted behind https://', () => {
      expect(validate('https://file:///Users/me/Downloads/doc.pdf')).toBe(
        'URL invalide. Exemple attendu : https://...',
      )
    })

    it('rejects http(s) URLs whose host has no dot', () => {
      expect(validate('https://intranet')).toBe(
        'URL invalide. Exemple attendu : https://...',
      )
    })
  })

  describe('disallowed protocols are rejected', () => {
    it('rejects ftp and javascript URLs', () => {
      const message = 'L’URL doit commencer par http://, https:// ou mailto:.'
      expect(validate('ftp://example.org')).toBe(message)
      expect(validate('javascript:alert(1)')).toBe(message)
    })
  })
})
