import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { CreateSpecInput, SpecPriority } from '../../shared/spec'

type SpecFormProps = {
  form: CreateSpecInput
  formError: string | null
  onChange: (form: CreateSpecInput) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

const priorities: SpecPriority[] = ['High', 'Medium', 'Low']

export function SpecForm({ form, formError, onChange, onSubmit }: SpecFormProps) {
  return (
    <form className="spec-form" onSubmit={onSubmit}>
      <p className="label">New spec</p>
      <h2 className="panel-heading">Create spec</h2>

      <label className="form-group">
        Title
        <input
          onChange={(event) => onChange({ ...form, title: event.target.value })}
          placeholder="Feature name"
          value={form.title}
        />
      </label>

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
  )
}
