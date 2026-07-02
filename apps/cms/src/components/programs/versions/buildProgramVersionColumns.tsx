import React from 'react'
import type { Column } from 'payload'
import type { WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'
import { WorkflowStatusPill } from '@/components/programs/WorkflowStatusPill'
import { CreatedAtCell } from './CreatedAtCell'

/** Minimal `ClientField` placeholder: the Table only uses it for sort metadata. */
const minimalField = (type: string): Column['field'] =>
  ({ name: '', type }) as unknown as Column['field']

type Author = { email?: string; name?: string } | number | string | null | undefined

/** A version doc as returned by `payload.findVersions` (snapshot in `version`). */
export type ProgramVersionDoc = {
  id: number | string
  updatedAt: string
  version?: {
    workflowStatus?: string
    lastModifiedBy?: Author
  }
}

/** Best-effort display label for the "Qui" column from a (possibly populated) relationship. */
const resolveAuthorLabel = (value: Author): string => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return value.name || value.email || '—'
  return String(value)
}

const renderStatus = (status?: string): React.ReactNode =>
  status ? (
    <WorkflowStatusPill status={status as WorkflowStatus} />
  ) : (
    <span>—</span>
  )

/**
 * Builds the columns for the custom program versions list:
 * Date (links to the native diff view) / Qui / Statut depuis / Statut vers.
 *
 * `docs` are sorted newest-first, so the "depuis" status of a row is the
 * `workflowStatus` of the next (older) row. The oldest row on a page has no
 * previous version within the page and renders "—".
 */
export const buildProgramVersionColumns = ({
  collectionSlug,
  docID,
  docs,
}: {
  collectionSlug: string
  docID: number | string
  docs: ProgramVersionDoc[]
}): Column[] => [
  {
    accessor: 'updatedAt',
    active: true,
    field: minimalField('date'),
    Heading: <span>Date</span>,
    renderedCells: docs.map((doc) => (
      <CreatedAtCell
        key={doc.id}
        collectionSlug={collectionSlug}
        docID={docID}
        rowData={{ id: doc.id, updatedAt: doc.updatedAt }}
      />
    )),
  },
  {
    accessor: 'lastModifiedBy',
    active: true,
    field: minimalField('text'),
    Heading: <span>Qui</span>,
    renderedCells: docs.map((doc) => (
      <span key={doc.id}>{resolveAuthorLabel(doc.version?.lastModifiedBy)}</span>
    )),
  },
  {
    accessor: 'statusFrom',
    active: true,
    field: minimalField('text'),
    Heading: <span>Statut depuis</span>,
    renderedCells: docs.map((doc, i) => (
      <React.Fragment key={doc.id}>
        {renderStatus(docs[i + 1]?.version?.workflowStatus)}
      </React.Fragment>
    )),
  },
  {
    accessor: 'statusTo',
    active: true,
    field: minimalField('text'),
    Heading: <span>Statut vers</span>,
    renderedCells: docs.map((doc) => (
      <React.Fragment key={doc.id}>
        {renderStatus(doc.version?.workflowStatus)}
      </React.Fragment>
    )),
  },
  {
    accessor: 'id',
    active: true,
    field: minimalField('text'),
    Heading: <span>Identifiant</span>,
    renderedCells: docs.map((doc) => <span key={doc.id}>{doc.id}</span>),
  },
]
