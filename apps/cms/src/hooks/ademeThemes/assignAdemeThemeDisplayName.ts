import type { CollectionBeforeChangeHook } from 'payload'

/** Title shown in pickers, `19_03 · Eau`: sub-theme labels alone are ambiguous, the code groups them under their root. */
export const assignAdemeThemeDisplayName: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  const code = (data.code ?? originalDoc?.code) as string | undefined
  const label = (data.label ?? originalDoc?.label) as string | undefined
  if (!code || !label) return data
  data.displayName = `${code} · ${label}`
  return data
}
