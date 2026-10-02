import { Plus } from 'lucide-react'

type HeaderProps = {
  onNewSpec: () => void
}

export function Header({ onNewSpec }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="page header-inner">
        <div>
          <h1 className="brand-name">SpecShip</h1>
          <p className="brand-subtitle">
            Tracks a product spec from requirement to shipped, with owner,
            priority, and delivery status in one place.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNewSpec} type="button">
          <Plus aria-hidden="true" size={16} strokeWidth={1.75} />
          New spec
        </button>
      </div>
    </header>
  )
}
