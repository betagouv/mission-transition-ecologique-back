'use client'

import React from 'react'
import { Link, useConfig, useTranslation } from '@payloadcms/ui'
import { formatDate } from '@payloadcms/ui/shared'
import { formatAdminURL } from 'payload/shared'

type Props = {
  collectionSlug: string
  docID: number | string
  rowData: { id: number | string; updatedAt: string }
}

/**
 * Date cell linking to the native single-version view (the diff accordion).
 * Vendored from `@payloadcms/next` Versions list so the link to the native
 * "détail des changements entre deux versions" is preserved.
 */
export const CreatedAtCell: React.FC<Props> = ({
  collectionSlug,
  docID,
  rowData,
}) => {
  const {
    config: {
      admin: { dateFormat },
      routes: { admin: adminRoute },
    },
  } = useConfig()
  const { i18n } = useTranslation()

  const href = formatAdminURL({
    adminRoute,
    path: `/collections/${collectionSlug}/${docID}/versions/${rowData.id}`,
  })

  return (
    <Link href={href} prefetch={false}>
      {formatDate({ date: rowData.updatedAt, i18n, pattern: dateFormat })}
    </Link>
  )
}
