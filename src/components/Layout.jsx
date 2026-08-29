import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { clearToken, getAdminInfo } from '../lib/auth';
import { api } from '../lib/api';
import './Layout.css';

/**
 * Topbar title, derived from the route rather than written into the DOM by each
 * page. Pages used to set it in their own layout effect, which left the previous
 * page's title on screen during navigation and skipped the blog routes entirely.
 * First match wins, so specific patterns come before their prefixes.
 */
const TITLES = [
  [/^\/dashboard/,                'Overview'],
  [/^\/analytics/,                'Website Analytics'],
  [/^\/templates\/new/,           'Add Template'],
  [/^\/templates\/[^/]+\/edit/,   'Edit Template'],
  [/^\/templates/,                'Templates'],
  [/^\/assets/,                   'Assets'],
  [/^\/users\/[^/]+/,             'User Detail'],
  [/^\/users/,                    'Users'],
  [/^\/transactions\/[^/]+/,      'Transaction Detail'],
  [/^\/transactions/,             'Transactions'],
  [/^\/coupons/,                  'Coupons'],
  [/^\/tickets\/[^/]+/,           'Support Ticket'],
  [/^\/tickets/,                  'Support Tickets'],
  [/^\/reviews/,                  'Reviews'],
  [/^\/blog\/new/,                'New Post'],
  [/^\/blog\/[^/]+\/edit/,        'Edit Post'],
  [/^\/blog/,                     'Blog'],
  [/^\/testing/,                  'Testing'],
  [/^\/developers/,               'Template Developers'],
];

function titleForPath(pathname) {
  const hit = TITLES.find(([re]) => re.test(pathname));
  return hit ? hit[1] : '';
}

const NAV = [
  {
    section: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: IconGrid },
      { label: 'Analytics', to: '/analytics', icon: IconChart },
    ],
  },
  {
    section: 'Catalogue',
    items: [
      { label: 'Templates', to: '/templates', icon: IconLayers },
      { label: 'Assets', to: '/assets', icon: IconAsset },
    ],
  },
  {
    section: 'Users',
    items: [
      { label: 'Users',        to: '/users',        icon: IconUsers },
      { label: 'Transactions', to: '/transactions',  icon: IconCard  },
    ],
  },
  {
    section: 'Marketing',
    items: [
      { label: 'Coupons', to: '/coupons', icon: IconTag },
      { label: 'Reviews', to: '/reviews', icon: IconStar },
      { label: 'Blog', to: '/blog', icon: IconBlog },
    ],
  },
  {
    section: 'Support',
    items: [{ label: 'Support Tickets', to: '/tickets', icon: IconMail, badge: true }],
  },
  {
    section: 'Internal',
    items: [
      { label: 'Testing',    to: '/testing',    icon: IconFlask },
      { label: 'Developers', to: '/developers', icon: IconCode },
    ],
  },
];

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
                  key={item.to}
                  to={item.to}
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

/* ── SVG Icons ── */
function IconGrid() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconLayers() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
    </svg>
  );
}
function IconUsers() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  );
}
function IconCard() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  );
}
function IconMail() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}
function IconTag() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12l-8 8-9-9V4h7l10 8z" />
      <circle cx="7" cy="7" r="1.6" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  );
}
function IconLogout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
    </svg>
  );
}

function IconAsset() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"></path>
      <circle cx="6" cy="18" r="3"></circle>
      <circle cx="18" cy="16" r="3"></circle>
    </svg>
  );
}
function IconChart() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      <line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}
function IconFlask() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v6.5L4.5 18A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-3L14 8.5V2"/>
      <line x1="9" y1="2" x2="15" y2="2"/><line x1="7" y1="15" x2="17" y2="15"/>
    </svg>
  );
}
function IconCode() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );
}
function IconStar() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  );
}
function IconBlog() {
  return (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}
