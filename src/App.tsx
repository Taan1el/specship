import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  seedSpecs,
  statusOrder,
  type CreateSpecInput,
  type ProductSpec,
  type SpecPriority,
  type SpecStatus,
} from '../shared/spec'
import './App.css'
import {
  ApiError,
  createSpec as createSpecRequest,
  isDemoMode,
  listSpecs,
  resetDemoData,
  updateSpecStatus as updateSpecStatusRequest,
} from './services'

const priorities: SpecPriority[] = ['High', 'Medium', 'Low']

const emptyForm: CreateSpecInput = {
  acceptanceCriteria: [''],
  owner: '',
  priority: 'Medium',
  requirement: '',
  title: '',
}

function App() {
  const [specs, setSpecs] = useState<ProductSpec[]>(seedSpecs)
  const [selectedStatus, setSelectedStatus] = useState<'All' | SpecStatus>('All')
  const [form, setForm] = useState<CreateSpecInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [apiState, setApiState] = useState<'Loading' | 'Ready' | 'Offline'>(
    'Loading',
  )

  useEffect(() => {
    async function loadSpecs() {
      try {
        setSpecs(await listSpecs())
        setApiState('Ready')
      } catch {
        setApiState('Offline')
      }
    }

    loadSpecs()
  }, [])

  const filteredSpecs = useMemo(() => {
    if (selectedStatus === 'All') {
      return specs
    }

    return specs.filter((spec) => spec.status === selectedStatus)
  }, [selectedStatus, specs])

  const shippedCount = specs.filter((spec) => spec.status === 'Shipped').length
  const highPriorityCount = specs.filter((spec) => spec.priority === 'High').length

  async function createSpec(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const input: CreateSpecInput = {
      ...form,
      acceptanceCriteria: form.acceptanceCriteria.filter(Boolean),
    }

    if (!input.title || !input.owner || !input.requirement || input.acceptanceCriteria.length === 0) {
      setFormError('Fill in a title, owner, requirement, and at least one acceptance criterion.')
      return
    }

    try {
      const spec = await createSpecRequest(input)
      setSpecs((current) => [spec, ...current])
      setApiState('Ready')
      setForm(emptyForm)
    } catch (error) {
      if (error instanceof ApiError) {
        // The request reached the API and it rejected the input. Show the
        // real reason instead of pretending the spec was created.
        setFormError(error.issues?.[0]?.message ?? error.message)
        return
      }

      // The request never reached the API (offline, API not running). Keep
      // the workflow usable by saving the spec locally until it is back.
      const spec: ProductSpec = {
        ...input,
        id: `local-${Date.now()}`,
        status: 'Backlog',
        updatedAt: new Date().toISOString(),
      }

      setSpecs((current) => [spec, ...current])
      setApiState('Offline')
      setForm(emptyForm)
    }
  }

  async function moveSpec(spec: ProductSpec) {
    const nextStatus =
      statusOrder[(statusOrder.indexOf(spec.status) + 1) % statusOrder.length]

    setListError(null)

    try {
      const updatedSpec = await updateSpecStatusRequest(spec.id, nextStatus)

      setSpecs((current) =>
        current.map((currentSpec) =>
          currentSpec.id === spec.id ? updatedSpec : currentSpec,
        ),
      )
      setApiState('Ready')
    } catch (error) {
      if (error instanceof ApiError) {
        setListError(`Could not move "${spec.title}": ${error.message}`)
        return
      }

      setSpecs((current) =>
        current.map((currentSpec) =>
          currentSpec.id === spec.id
            ? {
                ...currentSpec,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : currentSpec,
        ),
      )
      setApiState('Offline')
    }
  }

  async function handleResetDemoData() {
    resetDemoData?.()
    setSpecs(await listSpecs())
    setSelectedStatus('All')
    setFormError(null)
    setListError(null)
  }

  function updateCriterion(index: number, value: string) {
    setForm({
      ...form,
      acceptanceCriteria: form.acceptanceCriteria.map((criterion, currentIndex) =>
        currentIndex === index ? value : criterion,
      ),
    })
  }

  return (
    <main className="app-shell">
      {isDemoMode && (
        <p className="demo-notice">
          <strong>Demo mode:</strong> data is simulated in your browser and saved
          only on this device.{' '}
          <button type="button" onClick={handleResetDemoData}>
            Reset demo data
          </button>{' '}
          <a href="https://github.com/Taan1el/specship" target="_blank" rel="noreferrer">
            View the source on GitHub
          </a>
        </p>
      )}

      <section className="hero-section">
        <div>
          <p className="eyebrow">React + TypeScript + Node delivery tracker</p>
          <h1>SpecShip</h1>
          <p>
            A small product-spec dashboard that follows a feature from requirement
            to production-style review.
          </p>
        </div>
        <div className="stats-grid">
          <article>
            <span>{specs.length}</span>
            <p>active specs</p>
          </article>
          <article>
            <span>{highPriorityCount}</span>
            <p>high priority</p>
          </article>
          <article>
            <span>{shippedCount}</span>
            <p>shipped</p>
          </article>
        </div>
      </section>

      <section className="delivery-strip">
        <div>
          <p className="label">API state</p>
          <h2>{apiState}</h2>
          <p>
            {isDemoMode
              ? 'Running fully in your browser. Nothing is sent to a server.'
              : 'Uses the Node API. If a request cannot reach it, changes are kept in this tab until it responds again.'}
          </p>
        </div>
        <div>
          <p className="label">System shape</p>
          <h2>React, TypeScript, Node, APIs, database-ready design</h2>
          <p>
            Keeps product specs moving from intake through review with typed
            frontend and API contracts.
          </p>
        </div>
      </section>

      <section className="workspace-grid">
        <div>
          <div className="section-heading">
            <div>
              <p className="label">Feature board</p>
              <h2>Specs by delivery status</h2>
            </div>
            <div className="tabs" aria-label="Filter specs by status">
              {(['All', ...statusOrder] as Array<'All' | SpecStatus>).map(
                (status) => (
                  <button
                    aria-pressed={status === selectedStatus}
                    className={status === selectedStatus ? 'active' : ''}
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    type="button"
                  >
                    {status}
                  </button>
                ),
              )}
            </div>
          </div>

          {listError && (
            <p className="form-error" role="alert">
              {listError}
            </p>
          )}

          <div className="spec-list" aria-label="Filtered product specs">
            {filteredSpecs.map((spec) => (
              <article className="spec-card" key={spec.id}>
                <div className="spec-card-header">
                  <div>
                    <span className={`priority ${spec.priority.toLowerCase()}`}>
                      {spec.priority}
                    </span>
                    <h3>{spec.title}</h3>
                    <p>{spec.requirement}</p>
                  </div>
                  <button
                    aria-label={`Move ${spec.title} from ${spec.status}`}
                    onClick={() => moveSpec(spec)}
                    type="button"
                  >
                    {spec.status}
                  </button>
                </div>
                <ul>
                  {spec.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
                <p className="timestamp">
                  Owner: {spec.owner} - Updated{' '}
                  {new Date(spec.updatedAt).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        </div>

        <aside className="side-panel">
          <section className="standards-panel">
            <p className="label">Architecture notes</p>
            <h2>Technical standards</h2>
            <ul>
              <li>Shared TypeScript contracts between frontend and API.</li>
              <li>Validated API inputs with explicit error responses.</li>
              <li>PostgreSQL-ready store with in-memory local fallback.</li>
              <li>Small, testable delivery workflow from spec to shipped.</li>
            </ul>
          </section>

          <form className="spec-form" onSubmit={createSpec}>
            <p className="label">New feature</p>
            <h2>Create spec</h2>
            <label>
              Title
              <input
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder="Feature name"
                value={form.title}
              />
            </label>
            <label>
              Owner
              <input
                onChange={(event) => setForm({ ...form, owner: event.target.value })}
                placeholder="Frontend, Backend, Platform"
                value={form.owner}
              />
            </label>
            <label>
              Priority
              <select
                onChange={(event) =>
                  setForm({
                    ...form,
                    priority: event.target.value as SpecPriority,
                  })
                }
                value={form.priority}
              >
                {priorities.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </label>
            <label>
              Requirement
              <textarea
                onChange={(event) =>
                  setForm({ ...form, requirement: event.target.value })
                }
                placeholder="What user or business need does this solve?"
                value={form.requirement}
              />
            </label>
            <label>
              Acceptance criterion
              <textarea
                onChange={(event) => updateCriterion(0, event.target.value)}
                placeholder="What must be true before this ships?"
                value={form.acceptanceCriteria[0]}
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button type="submit">Create spec</button>
          </form>
        </aside>
      </section>
    </main>
  )
}

export default App
