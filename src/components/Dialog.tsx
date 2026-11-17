import { useEffect, useId, useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { X } from 'lucide-react'

type DialogProps = {
  title: string
  onClose: () => void
  children: ReactNode
  /** Wider panel for the import preview. */
  wide?: boolean
}

const focusableSelector =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog shell. Focus moves in on open (to the element marked
 * `data-autofocus`, else the first field), Tab stays inside, Escape closes, and
 * focus goes back to the opener when it is still on the page.
 */
export function Dialog({ title, onClose, children, wide }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const target =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>('input, textarea, select') ??
      dialog?.querySelector<HTMLElement>('button')
    target?.focus()
    return () => {
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }

    if (event.key !== 'Tab' || !dialogRef.current) {
      return
    }

    const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
    const first = items[0]
    const last = items[items.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="dialog-backdrop">
      {/* Clicking the backdrop closes the dialog; keyboard users have Escape and the Close button. */}
      <div aria-hidden="true" className="dialog-dismiss" onClick={onClose} />
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={wide ? 'dialog dialog-wide' : 'dialog'}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-head">
          <h2 className="dialog-title" id={titleId}>
            {title}
          </h2>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            <X aria-hidden="true" size={16} strokeWidth={1.75} />
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
