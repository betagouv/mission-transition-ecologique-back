import type { CanonicalSyncAction } from './CanonicalSyncPolicy'

export interface ProjectSyncState {
  /** Status of the version that was just written. */
  status: 'draft' | 'published'
  /** Whether the main document, the one served to readers, is still published. */
  publishedVersionLive: boolean
}

/**
 * Decides what a project save means for the canonical store. Only published
 * projects are stored: a draft saved over a published version leaves the
 * canonical untouched, so the published version stays served while it is
 * being rewritten.
 */
export class ProjectCanonicalSyncPolicy {
  static actionFor({ status, publishedVersionLive }: ProjectSyncState): CanonicalSyncAction {
    if (status === 'published') return 'save'
    return publishedVersionLive ? 'keep' : 'remove'
  }
}
