import type { Payload } from 'payload'
import { ProgramCanonicalMapper } from '@/services/canonical/ProgramCanonicalMapper'
import { PayloadRichTextToMarkdown } from '@/services/canonical/rich-text/PayloadRichTextToMarkdown'
import { getCanonicalProgramService } from '@/services/canonical/canonicalProgramService'
import { WORKFLOW_STATUS } from '@/services/workflow/WorkflowTransitionPolicy'

/**
 * Populates the canonical store from the seeded programs. Selects by
 * `workflowStatus === 'publie'` (the editorial intent) rather than `_status`,
 * because the program seed writes content as draft. The CMS mapper produces the
 * canonical input; the domain `CanonicalProgramService` validates and persists it.
 */
export class CanonicalSeed {
  constructor(private readonly payload: Payload) {}

  async run(): Promise<void> {
    const markdown = await PayloadRichTextToMarkdown.create(this.payload.config)
    const mapper = new ProgramCanonicalMapper(markdown)
    const service = await getCanonicalProgramService()

    const { docs } = await this.payload.find({
      collection: 'programs',
      where: { workflowStatus: { equals: WORKFLOW_STATUS.publie } },
      depth: 1,
      draft: true,
      overrideAccess: true,
      limit: 0,
    })

    process.stdout.write(`Syncing ${docs.length.toString()} published programs to the canonical store...\n`)

    let saved = 0
    let invalid = 0
    for (const program of docs) {
      const result = await service.save(mapper.map(program))
      if (result.status === 'saved') {
        saved++
      } else {
        invalid++
        process.stderr.write(`Invalid canonical for "${result.slug}" — skipped.\n`)
      }
    }

    process.stdout.write(`Canonical seed complete — ${saved.toString()} saved, ${invalid.toString()} invalid.\n`)
  }
}
