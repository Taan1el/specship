import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { criteriaState, statusOrder, type ProductSpec, type SpecPriority, type SpecStatus } from '../../shared/spec'
import { editSpecSchema, specFieldLimits } from '../../shared/validation'
import type { EditSpecInput } from '../services/demoApi'
import { Dialog } from './Dialog'

type SpecEditDialogProps = {
  spec: ProductSpec
  onSave: (input: EditSpecInput) => Promise<void>
  onClose: () => void
}

type Row = { key: number; text: string; done: boolean }

const priorities: SpecPriority[] = ['High', 'Medium', 'Low']

/** One readable message and the field to focus for the first thing wrong with the draft. */
function describeProblem(path: PropertyKey[], message: string): { message: string; field: string } {
  const [name, index] = path
  if (name === 'title') return { message: `Title must be 3 to ${specFieldLimits.title} characters.`, field: 'title' }
  if (name === 'owner') return { message: `Owner can be left empty, or be 2 to ${specFieldLimits.owner} characters.`, field: 'owner' }
  if (name === 'requirement') {
    const refused = message.startsWith('The requirement cannot')
    return { message: refused ? `${message}.` : `Requirement must be 10 to ${specFieldLimits.requirement} characters.`, field: 'requirement' }
  }
  if (name === 'acceptanceCriteria' && typeof index === 'number') {
    return { message: `Criterion ${index + 1} must be 1 to ${specFieldLimits.criterion} characters. Remove it if it is not needed.`, field: `criterion-${index}` }
  }
  if (name === 'acceptanceCriteria') {
    return { message: message.startsWith('Add at least') ? 'Add at least one acceptance criterion.' : 'A spec can have at most 25 acceptance criteria.', field: 'criterion-0' }
  }
  return { message, field: '' }
}

export function SpecEditDialog({ spec, onSave, onClose }: SpecEditDialogProps) {
  const nextKey = useRef(spec.acceptanceCriteria.length)
  const makeRow = (text: string, done: boolean): Row => ({ key: nextKey.current++, text, done })
  const [title, setTitle] = useState(spec.title)
  const [owner, setOwner] = useState(spec.owner)
  const [priority, setPriority] = useState<SpecPriority>(spec.priority)
  const [status, setStatus] = useState<SpecStatus>(spec.status)
  const [requirement, setRequirement] = useState(spec.requirement)
  const [rows, setRows] = useState<Row[]>(() => {
    const done = criteriaState(spec)
    return spec.acceptanceCriteria.map((text, index) => ({ key: index, text, done: done[index] }))
  })
  const [problem, setProblem] = useState<{ message: string; field: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (!problem) return
    const field = problem.field ? formRef.current?.querySelector<HTMLElement>(`[name="${problem.field}"]`) : null
    ;(field ?? errorRef.current)?.focus()
  }, [problem])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const draft = {
      acceptanceCriteria: rows.map((row) => row.text),
      criteriaDone: rows.map((row) => row.done),
      owner: owner.trim(),
      priority,
      requirement,
      status,
      title,
    }
    const checked = editSpecSchema.safeParse(draft)
    if (!checked.success) {
      const issue = checked.error.issues[0]
      setProblem(describeProblem(issue.path, issue.message))
      return
    }

    setProblem(null)
    setSaving(true)
    try {
      await onSave(checked.data as EditSpecInput)
    } catch (error) {
      setProblem({ message: error instanceof Error ? error.message : 'The spec could not be saved.', field: '' })
      setSaving(false)
    }
  }

  const invalid = (field: string) => (problem?.field === field ? true : undefined)
  const describedBy = (field: string) => (problem?.field === field ? 'edit-error' : undefined)

  return (
    <Dialog onClose={onClose} title="Edit spec">
      <form className="spec-form" onSubmit={submit} ref={formRef}>
        <label className="form-group">
          Title
          <input
            aria-describedby={describedBy('title')}
            aria-invalid={invalid('title')}
            maxLength={specFieldLimits.title}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>

        <div className="form-pair">
          <label className="form-group">
            Owner (optional)
            <input
              aria-describedby={describedBy('owner')}
              aria-invalid={invalid('owner')}
              maxLength={specFieldLimits.owner}
              name="owner"
              onChange={(event) => setOwner(event.target.value)}
              value={owner}
            />
          </label>

          <label className="form-group">
            Priority
            <select onChange={(event) => setPriority(event.target.value as SpecPriority)} value={priority}>
              {priorities.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-group">
          Status
          <select onChange={(event) => setStatus(event.target.value as SpecStatus)} value={status}>
            {statusOrder.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>

        <label className="form-group">
          Requirement
          <textarea
            aria-describedby={describedBy('requirement')}
            aria-invalid={invalid('requirement')}
            maxLength={specFieldLimits.requirement}
            name="requirement"
            onChange={(event) => setRequirement(event.target.value)}
            rows={6}
            value={requirement}
          />
        </label>

        <fieldset className="criteria-editor">
          <legend>Acceptance criteria</legend>
          {rows.map((row, index) => (
            <div className="criterion-row" key={row.key}>
              <span aria-hidden="true" className="criterion-number mono">
                {index + 1}
              </span>
              <input
                aria-describedby={describedBy(`criterion-${index}`)}
                aria-invalid={invalid(`criterion-${index}`)}
                aria-label={`Criterion ${index + 1}`}
                maxLength={specFieldLimits.criterion}
                name={`criterion-${index}`}
                onChange={(event) =>
                  setRows((current) => current.map((item) => (item.key === row.key ? { ...item, text: event.target.value } : item)))
                }
                value={row.text}
              />
              {rows.length > 1 && (
                <button
                  aria-label={`Remove criterion ${index + 1}`}
                  className="btn btn-secondary btn-icon"
                  onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                </button>
              )}
            </div>
          ))}
          <button
            className="btn btn-secondary"
            disabled={rows.length >= 25}
            onClick={() => setRows((current) => [...current, makeRow('', false)])}
            type="button"
          >
            <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
            Add criterion
          </button>
        </fieldset>

        {problem && (
          <p className="form-error" id="edit-error" ref={errorRef} role="alert" tabIndex={-1}>
            {problem.message}
          </p>
        )}

        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="btn btn-primary" disabled={saving} type="submit">
            <Check aria-hidden="true" size={16} strokeWidth={1.75} />
            Save changes
          </button>
        </div>
      </form>
    </Dialog>
  )
}
