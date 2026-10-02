import { ArrowRight } from 'lucide-react'
import { statusOrder, type ProductSpec, type SpecStatus } from '../../shared/spec'

type SpecDetailProps = {
  spec?: ProductSpec
  onMoveSpec: (spec: ProductSpec) => void
}

function nextStatus(status: SpecStatus): SpecStatus {
  return statusOrder[(statusOrder.indexOf(status) + 1) % statusOrder.length]
}

function slug(status: SpecStatus): string {
  return status.toLowerCase().replace(/\s+/g, '-')
}

export function SpecDetail({ spec, onMoveSpec }: SpecDetailProps) {
  if (!spec) {
    return (
      <article className="document">
        <p className="empty-desc">
          No spec in view. Pick another status filter or create a spec.
        </p>
      </article>
    )
  }

  return (
    <article className="document" aria-label={`Spec: ${spec.title}`}>
      <p className="meta-row">
        <span className="status-text">
          <span aria-hidden="true" className={`status-dot status-dot-${slug(spec.status)}`} />
          {spec.status}
        </span>
        <span>{spec.priority} priority</span>
        <span>{spec.owner}</span>
        <span className="mono">Updated {new Date(spec.updatedAt).toLocaleDateString()}</span>
      </p>

      <h2 className="doc-title">{spec.title}</h2>

      <h3 className="doc-heading">Requirement</h3>
      <p className="doc-prose">{spec.requirement}</p>

      <h3 className="doc-heading">Acceptance criteria</h3>
      <ol className="criteria-list">
        {spec.acceptanceCriteria.map((criterion) => (
          <li key={criterion}>{criterion}</li>
        ))}
      </ol>

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
      </div>
    </article>
  )
}
