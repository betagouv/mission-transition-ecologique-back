import { describe, it, expect, vi } from 'vitest'
import { PayloadLoggerEventSink } from '@/services/canonical/observability/PayloadLoggerEventSink'

const build = () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return { logger, sink: new PayloadLoggerEventSink(logger) }
}

describe('PayloadLoggerEventSink', () => {
  it('names the project in a failed project sync', () => {
    const { logger, sink } = build()

    sink.emit({ type: 'sync_failed', severity: 'error', entity: 'project', slug: 'plan-energie', error: 'boom' })

    expect(logger.error).toHaveBeenCalledWith('canonical project sync failed for "plan-energie": boom')
  })

  it('reads a failed sync without entity as a program one', () => {
    const { logger, sink } = build()

    sink.emit({ type: 'sync_failed', severity: 'error', slug: 'diag-eco', error: 'boom' })
    sink.emit({ type: 'sync_failed', severity: 'error', entity: 'program', slug: 'diag-eco', error: 'boom' })

    expect(logger.error).toHaveBeenNthCalledWith(1, 'canonical sync failed for "diag-eco": boom')
    expect(logger.error).toHaveBeenNthCalledWith(2, 'canonical sync failed for "diag-eco": boom')
  })

  it('routes each severity to its logger level', () => {
    const { logger, sink } = build()

    sink.emit({ type: 'project_saved', severity: 'info', slug: 'plan-energie', canonicalId: 'c1' })
    sink.emit({ type: 'project_dropped', severity: 'warning', phase: 'write', slug: 'plan-energie', errors: [] })

    expect(logger.info).toHaveBeenCalledWith('canonical project saved "plan-energie" (c1)')
    expect(logger.warn).toHaveBeenCalledWith(
      'canonical project dropped on write for "plan-energie": unreadable stored data',
    )
  })
})
