import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearToken, getAdminInfo } from '../lib/auth';
import { NAV, titleForPath } from '../nav';
import { IconLogout, IconMenu } from './icons';
import { api } from '../lib/api';
import './Layout.css';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const info = getAdminInfo();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('aam_admin_sidebar') === 'collapsed');
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    api.tickets.list({ status: 'open', limit: 1 })
      .then(r => setTicketCount(r.total))
      .catch(() => {});
  }, []);

  function handleLogout() {
    clearToken();
    navigate('/');
  }

  // One button, two behaviors: slides the drawer on mobile, collapses to an icon rail on desktop
  function toggleSidebar() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      setSidebarOpen(o => !o);
    } else {
      setCollapsed(c => {
        localStorage.setItem('aam_admin_sidebar', c ? 'expanded' : 'collapsed');
        return !c;
      });
    }
  }

  const initial = (info?.email?.[0] || 'A').toUpperCase();
  const username = info?.email?.split('@')[0] || 'Admin';

  return (
    <div className={`app-shell${collapsed ? ' collapsed' : ''}`}>
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-row">
            {/* 80px source for a 40px slot (2x displays). Was logo.png at
                1024x1024 / 281KB — the single heaviest asset in the panel. */}
            <img src="/logo-80.png" alt="" className="sidebar-logo-img" width="40" height="40" decoding="async" />
            <div className="logotype">Aamantran</div>
          </div>
          <div className="admin-badge">Admin Panel</div>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(group => (
            <div key={group.section}>
              <div className="nav-section-label">{group.section}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                  /* Styled CSS tooltip instead of `title`: the native one has a
                     ~1s delay, cannot be themed, and would double up with ours.
                     The label stays in the DOM for assistive tech either way. */
                  data-tooltip={item.label}
                >
                  <item.icon />
                  <span>{item.label}</span>
                  {item.badge && ticketCount > 0 && (
                    <span className="nav-badge">{ticketCount > 99 ? '99+' : ticketCount}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{username}</div>
              <div className="sidebar-user-email">{info?.email || ''}</div>
            </div>
            {/* aria-label carries the accessible name now that `title` is gone;
                the icon alone gives screen readers nothing. */}
            <button
              className="sidebar-logout-btn"
              onClick={handleLogout}
              aria-label="Sign out"
              data-tooltip="Sign out"
            >
              <IconLogout />
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <IconMenu />
          </button>
          <div className="topbar-title">{titleForPath(location.pathname)}</div>
          <div className="topbar-actions" id="topbar-actions-slot" />
        </header>

        <main className="page-content page-fade">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
