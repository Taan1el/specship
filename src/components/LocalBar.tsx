import { Download, FileUp, Trash2 } from 'lucide-react'
import type { WorkspaceMode, WorkspaceProblem } from '../local/specWorkspace'
import { formatCount } from '../utils/pluralize'

type LocalBarProps = {
  mode: WorkspaceMode
  specCount: number
  problem: WorkspaceProblem | null
  /** True when Your workspace has changes that were not written to a file yet. */
  unbacked: boolean
  notice: string
  /** The result of the last import or other action, announced politely. */
  status: string
  onModeChange: (mode: WorkspaceMode) => void
  onImport: () => void
  onExportZip: () => void
  onExportCombined: () => void
  onClear: () => void
  onDismissNotice: () => void
}

const modes: { value: WorkspaceMode; label: string }[] = [
  { value: 'sample', label: 'Sample data' },
  { value: 'workspace', label: 'Your workspace' },
]

export function LocalBar({
  mode,
  specCount,
  problem,
  unbacked,
  notice,
  status,
  onModeChange,
  onImport,
  onExportZip,
  onExportCombined,
  onClear,
  onDismissNotice,
}: LocalBarProps) {
  const unreadable = problem?.kind === 'unreadable'
  const showBackup = mode === 'workspace' && unbacked && specCount > 0 && !problem

  return (
    <section aria-label="Spec files" className="local-bar">
      <div className="page">
        <div className="local-controls">
          <div aria-label="Data source" className="mode-toggle" role="group">
            {modes.map((item) => (
              <button
                aria-pressed={item.value === mode}
                className={item.value === mode ? 'filter-btn active' : 'filter-btn'}
                key={item.value}
                onClick={() => onModeChange(item.value)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="local-actions">
            {!unreadable && (
              <button className="btn btn-secondary" onClick={onImport} type="button">
                <FileUp aria-hidden="true" size={16} strokeWidth={1.75} />
                Import Markdown
              </button>
            )}
            <button className="btn btn-secondary" disabled={specCount === 0} onClick={onExportZip} type="button">
              <Download aria-hidden="true" size={16} strokeWidth={1.75} />
              Download all (.zip)
            </button>
            <button className="btn btn-secondary" disabled={specCount === 0} onClick={onExportCombined} type="button">
              <Download aria-hidden="true" size={16} strokeWidth={1.75} />
              Download one .md file
            </button>
            {mode === 'workspace' && (specCount > 0 || unreadable) && (
              <button className="btn btn-secondary" onClick={onClear} type="button">
                <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                Clear workspace
              </button>
            )}
          </div>
        </div>

        <p className="local-note">
          Every spec is a Markdown file you can import, edit anywhere and export again. SpecShip tracks specs on this device only: it does not sync between browsers or connect to an issue tracker.
        </p>

        {problem && (
          <p className="local-message local-problem" role="alert">
            {problem.message}
          </p>
        )}

        {notice && (
          <p className="local-message">
            {notice}{' '}
            <button className="link-btn" onClick={onDismissNotice} type="button">
              Dismiss
            </button>
          </p>
        )}

        {showBackup && (
          <p className="local-message">
            {formatCount(specCount, 'spec')} saved only in this browser, with changes not yet in a file.{' '}
            <button className="link-btn" onClick={onExportZip} type="button">
              Download a backup (.zip)
            </button>
          </p>
        )}

        <p aria-live="polite" className="local-message" role="status">
          {status}
        </p>
      </div>
    </section>
  )
}
