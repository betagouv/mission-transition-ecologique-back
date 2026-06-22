import type { CollectionBeforeValidateHook } from 'payload'

/**
 * Keeps `geographicAreas` consistent with the chosen `geographicCoverage`.
 *
 * When coverage is `national` (or unset), the aid applies everywhere and no
 * zone should be attached. Selected areas are otherwise hidden by the field
 * `condition` but would still fail the relationship `filterOptions` validation
 * (which returns no options for national), blocking the save. Clearing them
 * here, before validation runs, avoids that.
 *
 * Note: switching between `regional` and `departemental` can leave stale areas
 * of the wrong `coverageType`; resolving that requires loading each area and is
 * left as a follow-up. The editor is expected to re-pick zones after switching.
 *
 * On partial updates the payload may omit `geographicCoverage`, so we fall back
 * to `originalDoc` to avoid wiping existing areas on unrelated edits.
 */
export const normalizeGeographicCoverage: CollectionBeforeValidateHook = ({
  data,
  originalDoc,
}) => {
  if (!data) return data

  const coverage = data.geographicCoverage ?? originalDoc?.geographicCoverage

  if (coverage !== 'regional' && coverage !== 'departemental') {
    data.geographicAreas = []
  }

  return data
}
