import { useEffect, useRef } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Plus, X } from 'lucide-react'
import type { CreateSpecInput, SpecPriority } from '../../shared/spec'

type SpecFormProps = {
  form: CreateSpecInput
  formError: string | null
  onChange: (form: CreateSpecInput) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const priorities: SpecPriority[] = ['High', 'Medium', 'Low']

const focusableSelector =
  'button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'

export function SpecForm({ form, formError, onChange, onClose, onSubmit }: SpecFormProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // Move focus into the dialog on open and give it back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    titleRef.current?.focus()
    return () => opener?.focus()
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
      {/* The backdrop click closes the dialog; keyboard users have Escape and the Close button. */}
      <button
        aria-hidden="true"
        className="dialog-dismiss"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />
      <div
        aria-labelledby="new-spec-heading"
        aria-modal="true"
        className="dialog"
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <div className="dialog-head">
          <h2 className="dialog-title" id="new-spec-heading">
            New spec
          </h2>
          <button className="btn btn-secondary" onClick={onClose} type="button">
            <X aria-hidden="true" size={16} strokeWidth={1.75} />
            Close
          </button>
        </div>

        <form className="spec-form" onSubmit={onSubmit}>
          <label className="form-group">
            Title
            <input
              onChange={(event) => onChange({ ...form, title: event.target.value })}
              placeholder="Feature name"
              ref={titleRef}
              value={form.title}
            />
          </label>

          <div className="form-pair">
            <label className="form-group">
              Owner
              <input
                onChange={(event) => onChange({ ...form, owner: event.target.value })}
                placeholder="Frontend, Backend, Platform"
                value={form.owner}
              />
            </label>

            <label className="form-group">
              Priority
              <select
                onChange={(event) =>
                  onChange({ ...form, priority: event.target.value as SpecPriority })
                }
                value={form.priority}
              >
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="form-group">
            Requirement
            <textarea
              onChange={(event) => onChange({ ...form, requirement: event.target.value })}
              placeholder="What user or business need does this solve?"
              value={form.requirement}
            />
          </label>

          <label className="form-group">
            Acceptance criterion
            <textarea
              onChange={(event) =>
                onChange({ ...form, acceptanceCriteria: [event.target.value] })
              }
              placeholder="What must be true before this ships?"
              value={form.acceptanceCriteria[0]}
            />
          </label>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <button className="btn btn-primary" type="submit">
            Create spec
            <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          </button>
        </form>
      </div>
    </div>
  )
}
