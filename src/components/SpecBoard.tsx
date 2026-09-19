import { ArrowRight } from 'lucide-react'
import { statusOrder, type ProductSpec, type SpecStatus } from '../../shared/spec'
import { formatCount } from '../utils/pluralize'

type SpecBoardProps = {
  specs: ProductSpec[]
  selectedStatus: 'All' | SpecStatus
  onStatusChange: (status: 'All' | SpecStatus) => void
  selectedSpecId?: string
  onSelectSpec: (id: string) => void
  onMoveSpec: (spec: ProductSpec) => void
  listError: string | null
}

const statusFilters: Array<'All' | SpecStatus> = ['All', ...statusOrder]

function nextStatus(status: SpecStatus): SpecStatus {
  return statusOrder[(statusOrder.indexOf(status) + 1) % statusOrder.length]
}

export function SpecBoard({
  specs,
  selectedStatus,
  onStatusChange,
  selectedSpecId,
  onSelectSpec,
  onMoveSpec,
  listError,
}: SpecBoardProps) {
  const statusesToShow = selectedStatus === 'All' ? statusOrder : [selectedStatus]
  const groups = statusesToShow.map((status) => ({
    status,
    specs: specs.filter((spec) => spec.status === status),
  }))
  const visibleCount = groups.reduce((total, group) => total + group.specs.length, 0)

  return (
    <section>
      <div className="section-heading-row">
        <div>
          <h2 className="section-heading">Specs by delivery status</h2>
          <p className="section-description">{formatCount(visibleCount, 'spec')} in view</p>
        </div>
        <div className="segmented" aria-label="Filter specs by status">
          {statusFilters.map((status) => (
            <button
              aria-pressed={status === selectedStatus}
              className={status === selectedStatus ? 'active' : ''}
              key={status}
              onClick={() => onStatusChange(status)}
              type="button"
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {listError && (
        <p className="form-error" role="alert">
          {listError}
        </p>
      )}

      <div aria-label="Filtered product specs" className="spec-groups">
        {groups.map((group) => (
          <div className="spec-group" key={group.status}>
            <h3 className="group-heading">
              <span className={`status-dot status-dot-${group.status.toLowerCase().replace(/\s+/g, '-')}`} aria-hidden="true" />
              {group.status}
              <span className="group-count">{formatCount(group.specs.length, 'spec')}</span>
            </h3>

            {group.specs.length === 0 ? (
              <p className="empty-desc">No specs in {group.status.toLowerCase()}.</p>
            ) : (
              <ul className="spec-rows">
                {group.specs.map((spec) => (
                  <li
                    className={spec.id === selectedSpecId ? 'spec-row selected' : 'spec-row'}
                    key={spec.id}
                  >
                    <button
                      className="spec-select-btn"
                      onClick={() => onSelectSpec(spec.id)}
                      type="button"
                    >
                      <h4>{spec.title}</h4>
                      <p className="spec-requirement">{spec.requirement}</p>
                    </button>
                    <span className={`badge priority-badge priority-${spec.priority.toLowerCase()}`}>
                      {spec.priority}
                    </span>
                    <span className="badge owner-badge">{spec.owner}</span>
                    <span className="spec-updated">
                      {new Date(spec.updatedAt).toLocaleDateString()}
                    </span>
                    <button
                      aria-label={`Move ${spec.title} from ${spec.status}`}
                      className="btn btn-secondary move-btn"
                      onClick={() => onMoveSpec(spec)}
                      type="button"
                    >
                      Move to {nextStatus(spec.status)}
                      <ArrowRight aria-hidden="true" size={16} strokeWidth={1.75} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
