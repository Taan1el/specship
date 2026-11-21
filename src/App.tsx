import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import {
  criteriaState,
  seedSpecs,
  statusOrder,
  type CreateSpecInput,
  type ProductSpec,
  type SpecStatus,
} from '../shared/spec'
import {
  ConfirmDialog,
  DemoBanner,
  Header,
  ImportDialog,
  LocalBar,
  SpecBoard,
  SpecDetail,
  SpecEditDialog,
  SpecForm,
  StatsBar,
  SyncStatus,
} from './components'
import './App.css'
import { exportAllCombined, exportAllZip, exportSpecFile } from './local/exportSpecs'
import { SpecMarkdownError } from './local/specMarkdown'
import {
  chooseWorkspaceMode,
  markBackedUp,
  removeWorkspace,
  setNotice,
  subscribeWorkspace,
  workspaceState,
  type WorkspaceMode,
} from './local/specWorkspace'
import { UpdateNotice } from './local/UpdateNotice'
import {
  ApiError,
  createSpec as createSpecRequest,
  isDemoMode,
  listSpecs,
  localApi,
  resetDemoData,
  updateSpecStatus as updateSpecStatusRequest,
} from './services'
import type { EditSpecInput } from './services/demoApi'
import { formatCount } from './utils/pluralize'

const emptyForm: CreateSpecInput = {
  acceptanceCriteria: [''],
  owner: '',
  priority: 'Medium',
  requirement: '',
  title: '',
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.issues?.[0]?.message ?? error.message
  return error instanceof Error ? error.message : 'Something went wrong.'
}

function toEditInput(spec: ProductSpec, criteriaDone: boolean[]): EditSpecInput {
  return {
    acceptanceCriteria: spec.acceptanceCriteria,
    criteriaDone,
    owner: spec.owner,
    priority: spec.priority,
    requirement: spec.requirement,
    status: spec.status,
    title: spec.title,
  }
}

function App() {
  // The browser build starts empty and fills from the saved data, so seed specs never flash in front of a saved workspace.
  const [specs, setSpecs] = useState<ProductSpec[]>(isDemoMode ? [] : seedSpecs)
  const local = useSyncExternalStore(subscribeWorkspace, workspaceState)
  const [editingId, setEditingId] = useState<string>()
  const [deletingId, setDeletingId] = useState<string>()
  const [importOpen, setImportOpen] = useState(false)
  const [droppedFiles, setDroppedFiles] = useState<File[]>()
  const [clearOpen, setClearOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [headingFocus, setHeadingFocus] = useState(0)
  const dialogsOpen = useRef(false)
  const [selectedStatus, setSelectedStatus] = useState<'All' | SpecStatus>('All')
  const [selectedSpecId, setSelectedSpecId] = useState<string>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<CreateSpecInput>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [focusFormError, setFocusFormError] = useState(false)
  const [errorField, setErrorField] = useState<string | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [apiState, setApiState] = useState<'Loading' | 'Ready' | 'Offline'>(
    'Loading',
  )

  // In the browser build the saved data can change under this tab: the mode is switched, the workspace is
  // cleared, or another tab saves. `local.syncTick` goes up for each of those and the list is read again.
  useEffect(() => {
    let current = true

    async function loadSpecs() {
      try {
        const loaded = await listSpecs()
        if (!current) return
        setSpecs(loaded)
        setApiState('Ready')
      } catch {
        if (current) setApiState('Offline')
      }
    }

    loadSpecs()
    return () => {
      current = false
    }
  }, [local.syncTick])

  useEffect(() => {
    dialogsOpen.current = importOpen || Boolean(editingId) || Boolean(deletingId) || clearOpen
  }, [importOpen, editingId, deletingId, clearOpen])

  // Dropping Markdown files anywhere on the page opens the import preview.
  useEffect(() => {
    if (!isDemoMode) return

    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')
    const onDragOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault()
    }
    const onDrop = (event: DragEvent) => {
      // The drop area inside the import dialog handles its own drops.
      if (!hasFiles(event) || event.defaultPrevented || dialogsOpen.current) return
      event.preventDefault()
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length === 0 || workspaceState().problem?.kind === 'unreadable') return
      setDroppedFiles(files)
      setImportOpen(true)
    }

    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  // After a delete the focused button is gone, so focus moves to the list heading.
  useEffect(() => {
    if (headingFocus > 0) document.getElementById('spec-index-heading')?.focus()
  }, [headingFocus])

  const shippedCount = specs.filter((spec) => spec.status === 'Shipped').length
  const highPriorityCount = specs.filter((spec) => spec.priority === 'High').length
  const visibleSpecs = statusOrder.flatMap((status) =>
    selectedStatus === 'All' || selectedStatus === status
      ? specs.filter((spec) => spec.status === status)
      : [],
  )
  const selectedSpec =
    visibleSpecs.find((spec) => spec.id === selectedSpecId) ?? visibleSpecs[0]

  function closeDialog() {
    setDialogOpen(false)
    setFormError(null)
    setFocusFormError(false)
    setErrorField(null)
  }

  async function createSpec(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    setErrorField(null)
    const formElement = event.currentTarget
    const focusField = (field: string) => {
      const name = field === 'acceptanceCriteria' ? 'criterion' : field
      if (!['title', 'owner', 'requirement', 'criterion'].includes(name)) return false
      const element = formElement.querySelector<HTMLElement>(`[name="${name}"]`)
      element?.focus()
      return Boolean(element)
    }

    const input: CreateSpecInput = {
      ...form,
      title: form.title.trim(),
      owner: form.owner.trim(),
      requirement: form.requirement.trim(),
      acceptanceCriteria: form.acceptanceCriteria.map((criterion) => criterion.trim()).filter(Boolean),
    }

    if (!input.title || !input.owner || !input.requirement || input.acceptanceCriteria.length === 0) {
      setFormError('Fill in a title, owner, requirement, and at least one acceptance criterion.')
      setFocusFormError(false)
      const field = !input.title ? 'title' : !input.owner ? 'owner' : !input.requirement ? 'requirement' : 'criterion'
      setErrorField(field)
      focusField(field)
      return
    }

    try {
      const spec = await createSpecRequest(input)
      setSpecs((current) => [spec, ...current])
      setApiState('Ready')
      setForm(emptyForm)
      setSelectedStatus('All')
      setSelectedSpecId(spec.id)
      setDialogOpen(false)
    } catch (error) {
      if (error instanceof ApiError) {
        // The request reached the API and it rejected the input. Show the
        // real reason instead of pretending the spec was created.
        setFormError(error.issues?.[0]?.message ?? error.message)
        const field = error.issues?.[0]?.path[0]
        const name = field === 'acceptanceCriteria' ? 'criterion' : field
        const validField = typeof name === 'string' && ['title', 'owner', 'requirement', 'criterion'].includes(name)
        setErrorField(validField ? name : null)
        setFocusFormError(!validField || !focusField(name))
        return
      }

      // A failed request has no durable server record. Keep the form available for retry.
      setFormError('Could not save the spec. Check the connection and try again.')
      setFocusFormError(true)
      setApiState('Offline')
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

  async function refreshSpecs() {
    setSpecs(await listSpecs())
  }

  async function changeMode(mode: WorkspaceMode) {
    setListError(null)
    setStatus('')
    try {
      await chooseWorkspaceMode(mode)
      setSelectedStatus('All')
      setSelectedSpecId(undefined)
    } catch (error) {
      setListError(errorText(error))
    }
  }

  async function toggleCriterion(spec: ProductSpec, index: number, done: boolean) {
    if (!localApi) return
    const ticked = criteriaState(spec)
    ticked[index] = done
    setListError(null)
    try {
      await localApi.updateSpec(spec.id, toEditInput(spec, ticked))
    } catch (error) {
      setListError(`Could not update "${spec.title}": ${errorText(error)}`)
    }
    await refreshSpecs()
  }

  async function saveEdit(spec: ProductSpec, input: EditSpecInput) {
    if (!localApi) return
    try {
      await localApi.updateSpec(spec.id, input)
    } catch (error) {
      await refreshSpecs()
      throw new Error(errorText(error))
    }
    await refreshSpecs()
    setEditingId(undefined)
  }

  async function confirmDelete(spec: ProductSpec) {
    if (!localApi) return
    setDialogError(null)
    try {
      await localApi.deleteSpec(spec.id)
    } catch (error) {
      setDialogError(errorText(error))
      await refreshSpecs()
      return
    }
    await refreshSpecs()
    setDeletingId(undefined)
    setHeadingFocus((count) => count + 1)
    setStatus(`Deleted "${spec.title}".`)
  }

  async function importSpecs(imported: ProductSpec[], summary: string) {
    if (!localApi) return
    try {
      await localApi.importSpecs(imported)
    } catch (error) {
      await refreshSpecs()
      throw new Error(errorText(error))
    }
    await refreshSpecs()
    setSelectedStatus('All')
    setImportOpen(false)
    setDroppedFiles(undefined)
    setStatus(summary)
  }

  function exportOne(spec: ProductSpec) {
    setListError(null)
    try {
      exportSpecFile(spec)
    } catch (error) {
      setListError(error instanceof SpecMarkdownError ? error.message : 'The spec could not be exported.')
    }
  }

  async function exportAll(kind: 'zip' | 'combined') {
    setListError(null)
    try {
      if (kind === 'zip') exportAllZip(specs)
      else exportAllCombined(specs)
    } catch (error) {
      setListError(error instanceof SpecMarkdownError ? error.message : 'The specs could not be exported.')
      return
    }
    setStatus(`Downloaded ${formatCount(specs.length, 'spec')} as ${kind === 'zip' ? 'a zip file of Markdown files' : 'one Markdown file'}.`)
    // The file is written, so the backup reminder can go. A failed note must not hide the download.
    await markBackedUp().catch(() => undefined)
  }

  async function confirmClear() {
    setDialogError(null)
    try {
      await removeWorkspace()
    } catch (error) {
      setDialogError(errorText(error))
      return
    }
    setClearOpen(false)
    setSelectedSpecId(undefined)
    setStatus('Workspace cleared.')
  }

  const editingSpec = specs.find((spec) => spec.id === editingId)
  const deletingSpec = specs.find((spec) => spec.id === deletingId)
  const unreadable = local.problem?.kind === 'unreadable'
  const editing =
    isDemoMode && localApi && !unreadable
      ? {
          onDelete: (spec: ProductSpec) => {
            setDialogError(null)
            setDeletingId(spec.id)
          },
          onEdit: (spec: ProductSpec) => setEditingId(spec.id),
          onToggleCriterion: (spec: ProductSpec, index: number, done: boolean) => void toggleCriterion(spec, index, done),
        }
      : undefined
  const emptyMessage =
    isDemoMode && local.mode === 'workspace' && specs.length === 0
      ? unreadable
        ? 'The saved workspace cannot be read. See the message above.'
        : 'Your workspace has no specs yet. Choose New spec, or import Markdown files.'
      : undefined

  return (
    <div className="app-shell">
      {isDemoMode && <UpdateNotice />}
      {isDemoMode && <DemoBanner mode={local.mode} onReset={handleResetDemoData} />}
      <Header onNewSpec={() => setDialogOpen(true)} />
      {isDemoMode && (
        <LocalBar
          mode={local.mode}
          notice={local.notice}
          onClear={() => {
            setDialogError(null)
            setClearOpen(true)
          }}
          onDismissNotice={() => setNotice('')}
          onExportCombined={() => void exportAll('combined')}
          onExportZip={() => void exportAll('zip')}
          onImport={() => {
            setDroppedFiles(undefined)
            setImportOpen(true)
          }}
          onModeChange={(mode) => void changeMode(mode)}
          problem={local.problem}
          specCount={specs.length}
          status={status}
          unbacked={local.unbacked}
        />
      )}

      <main className="page reader">
        <aside className="reader-list">
          <StatsBar
            activeCount={specs.length}
            highPriorityCount={highPriorityCount}
            shippedCount={shippedCount}
          />
          <SpecBoard
            listError={listError}
            onSelectSpec={setSelectedSpecId}
            onStatusChange={setSelectedStatus}
            selectedSpecId={selectedSpec?.id}
            selectedStatus={selectedStatus}
            specs={specs}
          />
          {!isDemoMode && <SyncStatus state={apiState} />}
        </aside>

        <SpecDetail
          editing={editing}
          emptyMessage={emptyMessage}
          onExport={exportOne}
          onMoveSpec={moveSpec}
          onPrint={() => window.print()}
          spec={selectedSpec}
        />
      </main>

      {dialogOpen && (
        <SpecForm
          focusFormError={focusFormError}
          errorField={errorField}
          form={form}
          formError={formError}
          onChange={(nextForm) => {
            setForm(nextForm)
            setErrorField(null)
          }}
          onClose={closeDialog}
          onSubmit={createSpec}
        />
      )}

      {editingSpec && (
        <SpecEditDialog onClose={() => setEditingId(undefined)} onSave={(input) => saveEdit(editingSpec, input)} spec={editingSpec} />
      )}

      {deletingSpec && (
        <ConfirmDialog
          confirmLabel="Delete spec"
          error={dialogError}
          onCancel={() => setDeletingId(undefined)}
          onConfirm={() => void confirmDelete(deletingSpec)}
          title="Delete this spec?"
        >
          <p>
            "{deletingSpec.title}" will be removed from {local.mode === 'workspace' ? 'your workspace' : 'the sample data'}. This cannot be undone. Export it first if you want a copy.
          </p>
        </ConfirmDialog>
      )}

      {clearOpen && (
        <ConfirmDialog
          confirmLabel="Clear workspace"
          error={dialogError}
          onCancel={() => setClearOpen(false)}
          onConfirm={() => void confirmClear()}
          title="Clear your workspace?"
        >
          <p>
            {unreadable
              ? 'This removes the saved workspace in this browser, which cannot be read. It cannot be undone.'
              : `This removes ${formatCount(specs.length, 'spec')} saved in this browser. It cannot be undone. Download a backup first if you want a copy.`}
          </p>
        </ConfirmDialog>
      )}

      {importOpen && (
        <ImportDialog
          initialFiles={droppedFiles}
          mode={local.mode}
          onClose={() => {
            setImportOpen(false)
            setDroppedFiles(undefined)
          }}
          onImport={importSpecs}
          savedSpecs={specs}
        />
      )}
    </div>
  )
}

export default App
