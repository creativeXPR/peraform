import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { LayoutGrid, Menu, Moon, PanelLeft, Search, Sun, X } from 'lucide-react'
import AccountMenu from '../features/auth/AccountMenu.jsx'
import { useTheme } from './useTheme.js'
import './AppShell.css'

const NAV_ITEMS = [{ to: '/', label: 'My forms', icon: LayoutGrid }]

// Creator-side frame: top bar, optional collapsible sidebar, content card,
// footer. Desktop collapses the sidebar in place; below 768px it becomes a
// slide-over drawer.
//   nav     — sidebar items ({ to, label, icon, end? })
//   search  — centred top-bar search; the page reads useOutletContext().search
//   center  — any other centred top-bar content (e.g. the form title)
//   actions — extra top-bar buttons, before the theme toggle and account
export default function AppShell({
  sidebar = true,
  nav = NAV_ITEMS,
  search = false,
  center = null,
  actions = null,
}) {
  const { theme, toggleTheme } = useTheme()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div
      className="shell"
      data-sidebar={!sidebar ? 'none' : sidebarOpen ? 'open' : 'closed'}
      data-drawer={drawerOpen ? 'open' : 'closed'}
    >
      <header className={`topbar${search || center ? ' topbar-has-center' : ''}`}>
        <div className="topbar-start">
          {sidebar && (
            <button
              type="button"
              className="icon-btn drawer-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
          )}
          <Link to="/" className="logo">
            PeraForm
          </Link>
        </div>
        {(search || center) && (
          <div className="topbar-center">
            {search ? <SearchBar value={searchText} onChange={setSearchText} /> : center}
          </div>
        )}
        <div className="topbar-actions">
          {actions}
          <button
            type="button"
            className="icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <AccountMenu />
        </div>
      </header>

      <div className="shell-main">
        {sidebar && (
          <aside className="sidebar" aria-label="Main navigation">
            <div className="drawer-head">
              <span className="logo">PeraForm</span>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="sidebar-nav">
              {nav.map(({ to, label, icon: Icon, end = true }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className="nav-item"
                  onClick={() => setDrawerOpen(false)}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>
        )}

        {sidebar && (
          <button
            type="button"
            className="icon-btn sidebar-toggle"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            <PanelLeft size={16} />
          </button>
        )}

        <main className="content-card">
          <Outlet context={{ search: searchText }} />
        </main>
      </div>

      <footer className="footerbar">PeraForm</footer>

      {sidebar && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
    </div>
  )
}

function SearchBar({ value, onChange }) {
  return (
    <label className="searchbar">
      <Search size={17} />
      <input
        type="search"
        placeholder="Search forms"
        aria-label="Search forms"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
