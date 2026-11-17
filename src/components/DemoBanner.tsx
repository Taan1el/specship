type DemoBannerProps = {
  mode: 'sample' | 'workspace'
  onReset: () => void
}

export function DemoBanner({ mode, onReset }: DemoBannerProps) {
  function handleReset() {
    if (window.confirm('Reset the sample specs back to the seed data?')) {
      onReset()
    }
  }

  return (
    <output className="demo-bar">
      <div className="page demo-bar-inner">
        <span>
          {mode === 'workspace' ? 'Your workspace' : 'Sample data'}: specs stay in this browser and nothing is uploaded.
        </span>
        <span className="demo-bar-links">
          {mode === 'sample' && (
            <button className="link-btn" onClick={handleReset} type="button">
              Reset sample data
            </button>
          )}
          <a href="https://github.com/Taan1el/specship" rel="noreferrer" target="_blank">
            Source on GitHub
          </a>
        </span>
      </div>
    </output>
  )
}
