import type { FC } from 'react'

// No definitive service logo yet: render nothing so no placeholder shows in the
// nav / login (issue #6). Kept registered in `admin.components.graphics` because
// dropping the registration would bring back Payload's default logo.
export const Logo: FC = () => null
