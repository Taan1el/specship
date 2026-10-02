import { statusOrder, type ProductSpec, type SpecStatus } from '../../shared/spec'
import { formatCount } from '../utils/pluralize'

type SpecBoardProps = {
  specs: ProductSpec[]
  selectedStatus: 'All' | SpecStatus
  onStatusChange: (status: 'All' | SpecStatus) => void
  selectedSpecId?: string
  onSelectSpec: (id: string) => void
  listError: string | null
}

const statusFilters: Array<'All' | SpecStatus> = ['All', ...statusOrder]

export function SpecBoard({
  specs,
  selectedStatus,
  onStatusChange,
  selectedSpecId,
  onSelectSpec,
  listError,
}: SpecBoardProps) {
  const statusesToShow = selectedStatus === 'All' ? statusOrder : [selectedStatus]
  const groups = statusesToShow.map((status) => ({
    status,
    specs: specs.filter((spec) => spec.status === status),
  }))
  const visibleCount = groups.reduce((total, group) => total + group.specs.length, 0)

  return (
    <nav aria-label="Specs" className="spec-index">
      <h2 className="index-heading">Specs by delivery status</h2>
      <p className="index-count">{formatCount(visibleCount, 'spec')} in view</p>

      <div className="filter-row" aria-label="Filter specs by status">
        {statusFilters.map((status) => (
          <button
            aria-pressed={status === selectedStatus}
            className={status === selectedStatus ? 'filter-btn active' : 'filter-btn'}
            key={status}
            onClick={() => onStatusChange(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>

      {listError && (
        <p className="form-error" role="alert">
          {listError}
        </p>
      )}

      <div aria-label="Filtered product specs" className="spec-groups">
        {groups.map((group) => (
          <section className="spec-group" key={group.status}>
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
                  <li key={spec.id}>
                    <button
                      aria-current={spec.id === selectedSpecId ? 'true' : undefined}
                      className={spec.id === selectedSpecId ? 'spec-select-btn selected' : 'spec-select-btn'}
                      onClick={() => onSelectSpec(spec.id)}
                      type="button"
                    >
                      <span className="spec-title">{spec.title}</span>
                      <span className="spec-meta">
                        {spec.priority} priority, {spec.owner}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </nav>
  )
}
