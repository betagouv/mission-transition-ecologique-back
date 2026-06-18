'use client'

import React from 'react'
import {
  LoadingOverlayToggle,
  Pagination,
  PerPage,
  Table,
  useListQuery,
  useTranslation,
} from '@payloadcms/ui'
import { useSearchParams } from 'next/navigation.js'

type Column = {
  accessor: string
  active: boolean
  field: { name: string; type: string }
  Heading: React.ReactNode
  renderedCells: React.ReactNode[]
}

type Props = {
  baseClass: string
  columns: Column[]
  paginationLimits?: number[]
}

/**
 * Client table for the custom program versions list. Vendored from the native
 * `@payloadcms/next` Versions list view; only `@payloadcms/ui` public exports
 * are used. Behaviour (pagination, per-page, loading overlay) is unchanged.
 */
export const VersionsViewClient: React.FC<Props> = ({
  baseClass,
  columns,
  paginationLimits,
}) => {
  const { data, handlePageChange, handlePerPageChange } = useListQuery()
  const searchParams = useSearchParams()
  const limit = searchParams.get('limit')
  const { i18n } = useTranslation()
  const versionCount = data?.totalDocs || 0

  return (
    <React.Fragment>
      <LoadingOverlayToggle name="versions" show={!data} />
      {versionCount === 0 && (
        <div className={`${baseClass}__no-versions`}>
          {i18n.t('version:noFurtherVersionsFound')}
        </div>
      )}
      {versionCount > 0 && (
        <React.Fragment>
          <Table columns={columns} data={data?.docs} />
          <div className={`${baseClass}__page-controls`}>
            <Pagination
              hasNextPage={data.hasNextPage}
              hasPrevPage={data.hasPrevPage}
              limit={data.limit}
              nextPage={data.nextPage ?? undefined}
              numberOfNeighbors={1}
              onChange={handlePageChange}
              page={data.page}
              prevPage={data.prevPage ?? undefined}
              totalPages={data.totalPages}
            />
            {data?.totalDocs > 0 && (
              <React.Fragment>
                <div className={`${baseClass}__page-info`}>
                  {data.page * data.limit - (data.limit - 1)}
                  {'-'}
                  {data.totalPages > 1 && data.totalPages !== data.page
                    ? data.limit * data.page
                    : data.totalDocs}{' '}
                  {i18n.t('general:of')} {data.totalDocs}
                </div>
                <PerPage
                  handleChange={handlePerPageChange}
                  limit={limit ? Number(limit) : 10}
                  limits={paginationLimits}
                />
              </React.Fragment>
            )}
          </div>
        </React.Fragment>
      )}
    </React.Fragment>
  )
}
