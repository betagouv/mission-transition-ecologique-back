import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PublicBaseUrlResolver } from '@/utils/PublicBaseUrlResolver'

function request(headers: Record<string, string> = {}): PayloadRequest {
  return { headers: new Headers(headers), origin: 'http://localhost:3000' } as unknown as PayloadRequest
}

const forwarded = { 'x-forwarded-host': 'forged.example', 'x-forwarded-proto': 'http' }

describe('PublicBaseUrlResolver', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('prefers PUBLIC_BASE_URL over the request', () => {
    vi.stubEnv('PUBLIC_BASE_URL', 'https://back.example')
    expect(PublicBaseUrlResolver.resolve(request(forwarded))).toBe('https://back.example')
  })

  it('reads the forwarded headers outside production', () => {
    vi.stubEnv('PUBLIC_BASE_URL', '')
    expect(PublicBaseUrlResolver.resolve(request(forwarded))).toBe('http://forged.example')
  })

  it('defaults the forwarded protocol to https', () => {
    vi.stubEnv('PUBLIC_BASE_URL', '')
    expect(PublicBaseUrlResolver.resolve(request({ 'x-forwarded-host': 'review.example' }))).toBe('https://review.example')
  })

  it('falls back to the request origin outside production', () => {
    vi.stubEnv('PUBLIC_BASE_URL', '')
    expect(PublicBaseUrlResolver.resolve(request())).toBe('http://localhost:3000')
  })

  it('ignores the forwarded headers in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PUBLIC_BASE_URL', 'https://back.example')
    expect(PublicBaseUrlResolver.resolve(request(forwarded))).toBe('https://back.example')
  })

  it('refuses to resolve in production without PUBLIC_BASE_URL', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('PUBLIC_BASE_URL', '')
    expect(() => PublicBaseUrlResolver.resolve(request(forwarded))).toThrow('PUBLIC_BASE_URL')
  })
})
