import React from 'react'
import type { WorkflowStatus } from '@/services/workflow/WorkflowTransitionPolicy'
import { WorkflowStatusPill } from '@/components/programs/WorkflowStatusPill'
import { CreatedAtCell } from './CreatedAtCell'

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

type Column = {
  accessor: string
  active: boolean
  field: { name: string; type: string }
  Heading: React.ReactNode
  renderedCells: React.ReactNode[]
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
    field: { name: '', type: 'date' },
    Heading: <span>Date</span>,
    renderedCells: docs.map((doc, i) => (
      <CreatedAtCell
        key={i}
        collectionSlug={collectionSlug}
        docID={docID}
        rowData={{ id: doc.id, updatedAt: doc.updatedAt }}
      />
    )),
  },
  {
    accessor: 'lastModifiedBy',
    active: true,
    field: { name: '', type: 'text' },
    Heading: <span>Qui</span>,
    renderedCells: docs.map((doc, i) => (
      <span key={i}>{resolveAuthorLabel(doc.version?.lastModifiedBy)}</span>
    )),
  },
  {
    accessor: 'statusFrom',
    active: true,
    field: { name: '', type: 'text' },
    Heading: <span>Statut depuis</span>,
    renderedCells: docs.map((doc, i) => (
      <React.Fragment key={i}>
        {renderStatus(docs[i + 1]?.version?.workflowStatus)}
      </React.Fragment>
    )),
  },
  {
    accessor: 'statusTo',
    active: true,
    field: { name: '', type: 'text' },
    Heading: <span>Statut vers</span>,
    renderedCells: docs.map((doc, i) => (
      <React.Fragment key={i}>
        {renderStatus(doc.version?.workflowStatus)}
      </React.Fragment>
    )),
  },
  {
    accessor: 'id',
    active: true,
    field: { name: '', type: 'text' },
    Heading: <span>Identifiant</span>,
    renderedCells: docs.map((doc, i) => <span key={i}>{doc.id}</span>),
  },
]
