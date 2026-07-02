// @vitest-environment node
import type { Payload } from 'payload'
import { getPayload } from 'payload'
import config from '@payload-config'
import { describe, it, beforeAll, expect } from 'vitest'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import type { User } from '../../payload-types'
import { ProgramsSeed } from '@/scripts/seed/programs'

const fixturesDir = fileURLToPath(new URL('../fixtures', import.meta.url))
const programsFixture = resolve(fixturesDir, 'programs.json')

let payload: Payload
let programId: number
let author: User
let otherUser: User

describe('review-comments', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await new ProgramsSeed(payload, programsFixture).run()
    const programs = await payload.find({ collection: 'programs', limit: 1, depth: 0 })
    programId = programs.docs[0]!.id

    author = await payload.create({
      collection: 'users',
      data: { email: 'reviewer@tee.test', password: 'reviewer@tee.test', role: 'creator' },
    })
    otherUser = await payload.create({
      collection: 'users',
      data: { email: 'other-reviewer@tee.test', password: 'other-reviewer@tee.test', role: 'creator' },
    })
  }, 60_000)

  it('stamps author from req.user, ignoring any client-provided author', async () => {
    const comment = await payload.create({
      collection: 'review-comments',
      // A client tries to spoof the author: the hook must override it.
      data: { program: programId, text: 'Relecture OK', author: otherUser.id },
      user: author,
      depth: 0,
    })
    expect(comment.author).toBe(author.id)
  })

  it('refuses to create a comment without an authenticated user', async () => {
    await expect(
      payload.create({
        collection: 'review-comments',
        // Even a client-provided author must not bypass the req.user requirement.
        data: { program: programId, text: 'Commentaire sans auteur', author: author.id },
      }),
    ).rejects.toThrow()
  })

  it('does not mutate the related program when a comment is created', async () => {
    const before = await payload.findByID({ collection: 'programs', id: programId, depth: 0 })
    await payload.create({
      collection: 'review-comments',
      data: { program: programId, text: 'Un commentaire de plus', author: author.id },
      user: author,
    })
    const after = await payload.findByID({ collection: 'programs', id: programId, depth: 0 })
    expect(after.updatedAt).toBe(before.updatedAt)
    expect(after._status).toBe(before._status)
  })
})
