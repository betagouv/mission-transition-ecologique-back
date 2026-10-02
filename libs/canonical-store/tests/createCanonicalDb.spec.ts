import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stands in for the `pg` pool: counts the pools opened and lets a test make the
// bootstrap queries fail, without any Postgres server.
const pg = vi.hoisted(() => ({ pools: 0, ended: 0, failing: false }))

vi.mock('pg', () => ({
  Pool: class {
    constructor() {
      pg.pools += 1
    }
    async query() {
      if (pg.failing) throw new Error('connection refused')
      return { rows: [], rowCount: 0 }
    }
    async end() {
      pg.ended += 1
    }
  },
}))

import { createCanonicalDb } from '../src/db'

describe('createCanonicalDb', () => {
  beforeEach(() => {
    pg.pools = 0
    pg.ended = 0
    pg.failing = false
  })

  it('opens a single pool per url, shared by every caller', async () => {
    const [first, second] = await Promise.all([
      createCanonicalDb('postgres://shared/tee'),
      createCanonicalDb('postgres://shared/tee'),
    ])

    expect(second).toBe(first)
    expect(await createCanonicalDb('postgres://shared/tee')).toBe(first)
    expect(pg.pools).toBe(1)
  })

  it('opens a distinct pool for another url', async () => {
    const first = await createCanonicalDb('postgres://one/tee')
    const second = await createCanonicalDb('postgres://two/tee')

    expect(second).not.toBe(first)
    expect(pg.pools).toBe(2)
  })

  it('does not cache a failed connection: the pool is closed and the next call retries', async () => {
    pg.failing = true
    await expect(createCanonicalDb('postgres://flaky/tee')).rejects.toThrow('Failed query')
    expect(pg.pools).toBe(1)
    expect(pg.ended).toBe(1)

    pg.failing = false
    const db = await createCanonicalDb('postgres://flaky/tee')
    expect(pg.pools).toBe(2)
    expect(await createCanonicalDb('postgres://flaky/tee')).toBe(db)
    expect(pg.pools).toBe(2)
  })
})
