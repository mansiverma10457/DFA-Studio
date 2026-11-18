import { lazy, Suspense, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Navbar from './components/Navbar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Designer from './pages/Designer.jsx'
import TransitionTable from './pages/TransitionTable.jsx'
import Simulator from './pages/Simulator.jsx'
import StringTesting from './pages/StringTesting.jsx'
import { DfaWorkspaceProvider, useDfaWorkspace } from './dfa/DfaWorkspaceContext.jsx'
import { navigationItems } from './data/navigation.js'
import SavedAutomata from './pages/SavedAutomata.jsx'

const DfaReport = lazy(() => import('./pages/DfaReport.jsx'))
const Documentation = lazy(() => import('./pages/Documentation.jsx'))

function AppLayout() {
  const { storageStatus, storageError } = useDfaWorkspace()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const activePage = navigationItems.find((item) => item.path === location.pathname)

  function closeMobileNavigation() {
    setMobileOpen(false)
  }

  return (
    <div className={`app-shell${collapsed ? ' sidebar-is-collapsed' : ''}`}>
      {mobileOpen && (
        <button
          className="mobile-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileNavigation}
        />
      )}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed((value) => !value)}
        onNavigate={closeMobileNavigation}
      />
      <main className="main-panel">
        <Navbar
          title={activePage?.label ?? (location.pathname === '/report' ? 'DFA Report' : 'Dashboard')}
          onMenuClick={() => setMobileOpen((value) => !value)}
          saveStatus={storageStatus}
          saveError={storageError}
        />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/designer" element={<Designer />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/string-testing" element={<StringTesting />} />
            <Route path="/saved-automata" element={<SavedAutomata />} />
            <Route path="/report" element={<Suspense fallback={<div className="route-loading" role="status">Loading report…</div>}><DfaReport /></Suspense>} />
            <Route path="/transition-table" element={<TransitionTable />} />
            <Route path="/documentation" element={<Suspense fallback={<div className="route-loading" role="status">Loading documentation…</div>}><Documentation /></Suspense>} />
            <Route path="/settings" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <DfaWorkspaceProvider>
      <AppLayout />
    </DfaWorkspaceProvider>
  )
}
