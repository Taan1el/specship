type SyncStatusProps = {
  state: 'Loading' | 'Ready' | 'Offline'
}

export function SyncStatus({ state }: SyncStatusProps) {
  return (
    <div className="sync-line">
      <span aria-hidden="true" className={`status-dot status-dot-sync-${state.toLowerCase()}`} />
      <span className="label">Sync</span>
      <span className="sync-value">{state}</span>
      {state === 'Offline' && (
        <span className="sync-note">Changes remain on this page until you refresh it.</span>
      )}
    </div>
  )
}
