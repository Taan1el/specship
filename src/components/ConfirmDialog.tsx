import type { ReactNode } from 'react'
import { Dialog } from './Dialog'

type ConfirmDialogProps = {
  title: string
  confirmLabel: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
  children: ReactNode
}

/** Asks before something that cannot be undone. Focus starts on Cancel, the safe choice. */
export function ConfirmDialog({ title, confirmLabel, busy, error, onCancel, onConfirm, children }: ConfirmDialogProps) {
  return (
    <Dialog onClose={onCancel} title={title}>
      <div className="dialog-text">{children}</div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="btn btn-secondary" data-autofocus onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn btn-danger" disabled={busy} onClick={onConfirm} type="button">
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
