/** The upstream TEE data files, as published in the upstream repository. */
export const UPSTREAM_FILES = ['programs', 'projects', 'redirects', 'operators', 'ademe_themes'] as const

export type UpstreamFile = (typeof UPSTREAM_FILES)[number]
