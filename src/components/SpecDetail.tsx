import { ArrowRight, Download, Pencil, Printer, Trash2 } from 'lucide-react'
import { criteriaState, nextStatus, type ProductSpec } from '../../shared/spec'

/** Actions that change a spec. Only the browser client has them, so the API build leaves this out. */
export type SpecEditing = {
  onToggleCriterion: (spec: ProductSpec, index: number, done: boolean) => void
  onEdit: (spec: ProductSpec) => void
  onDelete: (spec: ProductSpec) => void
}

type SpecDetailProps = {
  spec?: ProductSpec
  emptyMessage?: string
  onMoveSpec: (spec: ProductSpec) => void
  onExport: (spec: ProductSpec) => void
  onPrint: () => void
  editing?: SpecEditing
}

function slug(status: string): string {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export function SpecDetail({ spec, emptyMessage, onMoveSpec, onExport, onPrint, editing }: SpecDetailProps) {
  if (!spec) {
    return (
      <article className="document">
        <p className="empty-desc">{emptyMessage ?? 'No spec in view. Pick another status filter or create a spec.'}</p>
      </article>
    )
  }

  const done = criteriaState(spec)
  const doneCount = done.filter(Boolean).length
  const allDone = done.length > 0 && doneCount === done.length
  const suggested = spec.status === 'Shipped' ? null : nextStatus(spec.status)

  return (
    <article className="document" aria-label={`Spec: ${spec.title}`}>
      <p className="meta-row">
        <span className="status-text">
          <span aria-hidden="true" className={`status-dot status-dot-${slug(spec.status)}`} />
          {spec.status}
        </span>
        <span>{spec.priority} priority</span>
        <span>{spec.owner || 'No owner'}</span>
        <span className="mono">Updated {new Date(spec.updatedAt).toLocaleDateString()}</span>
      </p>

      <h2 className="doc-title">{spec.title}</h2>

      <h3 className="doc-heading">Requirement</h3>
      <p className="doc-prose">{spec.requirement}</p>

      <h3 className="doc-heading">Acceptance criteria</h3>
      {editing && (
        <p className="criteria-progress mono">
          {doneCount} of {done.length} ticked
        </p>
      )}
      <ol className="criteria-list">
        {spec.acceptanceCriteria.map((criterion, index) => (
          <li key={index}>
            {editing ? (
              <label className="criterion">
                <input
                  checked={done[index]}
                  onChange={(event) => editing.onToggleCriterion(spec, index, event.target.checked)}
                  type="checkbox"
                />
                <span>{criterion}</span>
              </label>
            ) : (
              criterion
            )}
          </li>
        ))}
      </ol>

      {editing && (
        <div className="suggestion" role="status">
          {allDone && suggested && (
            <>
              <p>All acceptance criteria are ticked. This spec could move to {suggested}.</p>
              <button className="btn btn-secondary" onClick={() => onMoveSpec(spec)} type="button">
                Move to {suggested}
                <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      )}

      <div className="doc-actions">
        <button
          aria-label={`Move ${spec.title} from ${spec.status}`}
          className="btn btn-secondary"
          onClick={() => onMoveSpec(spec)}
          type="button"
        >
          Move to {nextStatus(spec.status)}
          <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
        </button>
        {editing && (
          <button aria-label={`Edit ${spec.title}`} className="btn btn-secondary" onClick={() => editing.onEdit(spec)} type="button">
            <Pencil aria-hidden="true" size={16} strokeWidth={1.75} />
            Edit
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => onExport(spec)} type="button">
          <Download aria-hidden="true" size={16} strokeWidth={1.75} />
          Export .md
        </button>
        <button className="btn btn-secondary" onClick={onPrint} type="button">
          <Printer aria-hidden="true" size={16} strokeWidth={1.75} />
          Print or save PDF
        </button>
        {editing && (
          <button aria-label={`Delete ${spec.title}`} className="btn btn-secondary btn-danger-text" onClick={() => editing.onDelete(spec)} type="button">
            <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
            Delete
          </button>
        )}
      </div>

      <p className="print-footer">
        SpecShip, spec id {spec.id}. Printed {new Date().toLocaleDateString()}.
      </p>
    </article>
  )
}
