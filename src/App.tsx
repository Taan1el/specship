import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  seedSpecs,
  statusOrder,
  type CreateSpecInput,
  type ProductSpec,
  type SpecStatus,
} from '../shared/spec'
import { DemoBanner, Header, SpecBoard, SpecDetail, SpecForm, StatsBar, SyncStatus } from './components'
import './App.css'
import {
  ApiError,
  createSpec as createSpecRequest,
  isDemoMode,
  listSpecs,
  resetDemoData,
  updateSpecStatus as updateSpecStatusRequest,
} from './services'

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
  const [selectedSpecId, setSelectedSpecId] = useState<string>()
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

  const shippedCount = specs.filter((spec) => spec.status === 'Shipped').length
  const highPriorityCount = specs.filter((spec) => spec.priority === 'High').length
  const selectedSpec = specs.find((spec) => spec.id === selectedSpecId)

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
    setSelectedSpecId(undefined)
    setFormError(null)
    setListError(null)
  }

  return (
    <div className="app-shell">
      {isDemoMode && <DemoBanner onReset={handleResetDemoData} />}
      <Header />

      <main className="app-main">
        <StatsBar
          activeCount={specs.length}
          highPriorityCount={highPriorityCount}
          shippedCount={shippedCount}
        />

        <div className="content-grid">
          <div className="main-column">
            <SpecBoard
              listError={listError}
              onMoveSpec={moveSpec}
              onSelectSpec={setSelectedSpecId}
              onStatusChange={setSelectedStatus}
              selectedSpecId={selectedSpec?.id}
              selectedStatus={selectedStatus}
              specs={specs}
            />
          </div>

          <aside className="side-column">
            <SyncStatus state={apiState} />
            <SpecDetail spec={selectedSpec} />
            <SpecForm
              form={form}
              formError={formError}
              onChange={setForm}
              onSubmit={createSpec}
            />
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
