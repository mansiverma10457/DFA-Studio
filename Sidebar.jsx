import { ChevronLeft, Command, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Link, NavLink } from 'react-router-dom'
import { navigationItems } from '../data/navigation.js'

function NavigationLink({ item, onNavigate }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
      onClick={onNavigate}
      title={item.label}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span className="nav-label">{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ collapsed, mobileOpen, onToggle, onNavigate }) {
  return (
    <aside className={`sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}>
      <div className="brand-row">
        <NavLink to="/" className="brand" onClick={onNavigate} aria-label="DFA Studio dashboard">
          <span className="brand-mark"><Command size={19} strokeWidth={2.2} /></span>
          <span className="brand-copy">
            <span className="brand-name">dfa<span>studio</span></span>
            <span className="brand-caption">AUTOMATA WORKSPACE</span>
          </span>
        </NavLink>
        <button
          type="button"
          className="icon-button sidebar-collapse"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <button
          type="button"
          className="icon-button mobile-close"
          onClick={onNavigate}
          aria-label="Close navigation"
        >
          <ChevronLeft size={19} />
        </button>
      </div>

      <div className="workspace-switcher">
        <span className="workspace-avatar">M</span>
        <span className="workspace-copy">
          <span className="workspace-name">My workspace</span>
          <span className="workspace-plan">Personal plan</span>
        </span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <p className="nav-section-label">WORKSPACE</p>
        <div className="nav-items">
          {navigationItems.map((item) => (
            <NavigationLink key={item.path} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="profile-button">
          <span className="profile-avatar">U</span>
          <span className="profile-copy"><strong>Workspace owner</strong><small>Free plan</small></span>
        </div>
      </div>
    </aside>
  )
}
