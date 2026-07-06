import React from 'react'
import type { DocumentViewServerProps } from 'payload'
import { Gutter, ListQueryProvider, SetDocumentStepNav } from '@payloadcms/ui'
import { isNumber } from 'payload/shared'
import { notFound } from 'next/navigation.js'
import {
  buildProgramVersionColumns,
  type ProgramVersionDoc,
} from './buildProgramVersionColumns'
import { VersionsViewClient } from './VersionsViewClient'

const baseClass = 'versions'

/**
 * Custom versions list for the `programs` collection (ticket #6, point 11).
 *
 * Vendored from the native `@payloadcms/next` Versions list view and augmented
 * with workflow columns (Qui / Statut depuis / Statut vers). Each row still
 * links to the native single-version view, so the diff accordion ("détail des
 * changements entre deux versions") is preserved untouched.
 *
 * Data comes from the public `payload.findVersions` API; the "Qui" column reads
 * `lastModifiedBy` captured into every version snapshot by `trackLastModifiedBy`.
 */
export const ProgramVersionsView = async (props: DocumentViewServerProps) => {
  const {
    initPageResult: {
      collectionConfig,
      docID: id,
      req,
      req: { locale, payload, user },
    },
    searchParams,
  } = props

  const collectionSlug = collectionConfig?.slug
  if (!collectionSlug || id === undefined) return notFound()

  const { limit, page, sort } = searchParams as {
    limit?: string
    page?: string
    sort?: string
  }
  const defaultLimit = collectionConfig?.admin?.pagination?.defaultLimit ?? 10
  const limitToUse = isNumber(limit) ? Number(limit) : defaultLimit

  const versionsData = await payload.findVersions({
    collection: collectionSlug,
    depth: 1,
    limit: limitToUse,
    locale,
    overrideAccess: false,
    page: page ? parseInt(page, 10) : undefined,
    req,
    sort: sort ?? '-updatedAt',
    user,
    where: { parent: { equals: id } },
  })

  if (!versionsData) return notFound()

  const columns = buildProgramVersionColumns({
    collectionSlug,
    docID: id,
    docs: versionsData.docs as ProgramVersionDoc[],
  })

  return (
    <React.Fragment>
      <SetDocumentStepNav
        collectionSlug={collectionSlug}
        id={id}
        pluralLabel={collectionConfig?.labels?.plural}
        useAsTitle={collectionConfig?.admin?.useAsTitle}
        view="Versions"
      />
      <main className={baseClass}>
        <Gutter className={`${baseClass}__wrap`}>
          <ListQueryProvider
            data={versionsData}
            modifySearchParams
            query={{ limit: limitToUse, sort }}
          >
            <VersionsViewClient
              baseClass={baseClass}
              columns={columns}
              paginationLimits={collectionConfig?.admin?.pagination?.limits}
            />
          </ListQueryProvider>
        </Gutter>
      </main>
    </React.Fragment>
  )
}
