import type { ProductSpec } from '../../shared/spec'

type SpecDetailProps = {
  spec?: ProductSpec
}

export function SpecDetail({ spec }: SpecDetailProps) {
  if (!spec) {
    return (
      <div className="spec-detail">
        <p className="label">Selected spec</p>
        <p className="empty-desc">
          Select a spec from the list to see its full requirement and
          acceptance criteria.
        </p>
      </div>
    )
  }

  return (
    <div className="spec-detail">
      <p className="label">Selected spec</p>
      <h3>{spec.title}</h3>
      <p className="spec-detail-meta">
        <span className={`badge priority-badge priority-${spec.priority.toLowerCase()}`}>
          {spec.priority}
        </span>
        <span className="badge owner-badge">{spec.owner}</span>
        <span className="status-text">{spec.status}</span>
      </p>
      <dl>
        <dt>Requirement</dt>
        <dd>{spec.requirement}</dd>
        <dt>Acceptance criteria</dt>
        <dd>
          <ul className="criteria-list">
            {spec.acceptanceCriteria.map((criterion) => (
              <li key={criterion}>{criterion}</li>
            ))}
          </ul>
        </dd>
        <dt>Updated</dt>
        <dd className="mono">{new Date(spec.updatedAt).toLocaleDateString()}</dd>
      </dl>
    </div>
  )
}
