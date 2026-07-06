import type { FC } from 'react'

// No definitive service icon yet: render nothing so no placeholder shows in the
// admin nav (issue #6). The browser-tab favicon is set separately through
// `admin.meta.icons` (see public/favicon.svg).
export const Icon: FC = () => null
