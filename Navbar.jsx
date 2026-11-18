import { Menu } from 'lucide-react'

export default function Navbar({ title, onMenuClick, saveStatus = 'saved', saveError }) {
  const statusLabel = {
    saved: 'Saved',
    saving: 'Saving…',
    failed: 'Save failed',
  }[saveStatus] ?? 'Saved'

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="icon-button mobile-menu"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Menu size={19} />
        </button>
        <div className="breadcrumbs">
          <span className="breadcrumb-muted">Workspace</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{title}</span>
        </div>
      </div>
      <div className={`workspace-save-status save-${saveStatus}`} title={saveError ?? statusLabel} role="status">
        <span />
        {statusLabel}
      </div>
    </header>
  )
}
