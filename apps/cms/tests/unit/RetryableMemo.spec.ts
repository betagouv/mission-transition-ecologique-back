import { describe, it, expect } from 'vitest'
import { RetryableMemo } from '@/services/canonical/RetryableMemo'

describe('RetryableMemo', () => {
  it('creates the value once and shares it', async () => {
    const memo = new RetryableMemo<object>()
    let calls = 0
    const create = () => {
      calls++
      return Promise.resolve({})
    }

    const [first, second] = await Promise.all([memo.get(create), memo.get(create)])

    expect(calls).toBe(1)
    expect(second).toBe(first)
    expect(await memo.get(create)).toBe(first)
  })

  it('forgets a failed creation, so the next call retries', async () => {
    const memo = new RetryableMemo<string>()
    let calls = 0
    const create = () => {
      calls++
      return calls === 1 ? Promise.reject(new Error('database unavailable')) : Promise.resolve('ready')
    }

    await expect(memo.get(create)).rejects.toThrow('database unavailable')
    expect(await memo.get(create)).toBe('ready')
    expect(await memo.get(create)).toBe('ready')
    expect(calls).toBe(2)
  })

  it('rejects every caller waiting on the failed creation', async () => {
    const memo = new RetryableMemo<string>()
    const create = () => Promise.reject(new Error('database unavailable'))

    const results = await Promise.allSettled([memo.get(create), memo.get(create)])

    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
  })
})
