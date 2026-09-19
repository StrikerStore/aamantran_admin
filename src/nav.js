import {
  IconAsset, IconBlog, IconCard, IconChart, IconCode, IconFlask, IconGrid,
  IconLayers, IconMail, IconSliders, IconStar, IconTag, IconUsers,
} from './components/icons';

/**
 * Every page in the panel, once.
 *
 * The sidebar, the topbar title and the breadcrumbs were three hardcoded lists
 * that had to agree and did not: eight of the twenty pages appeared in no list
 * at all, so they had no title and no way in; Transactions sat under "Users";
 * and Pricing sat under "Internal" beside Testing and Developers. All three are
 * now derived from this one array, so a page added here is reachable, titled and
 * placed in the same change.
 *
 * Each entry is:
 *   path      the route, as written in App.jsx (`:param` segments allowed)
 *   title     the topbar title
 *   section   which sidebar group it belongs to — omit to keep it out of the
 *             sidebar (detail pages, editors), which does NOT make it untitled
 *   label     the sidebar label, when it has a section
 *   parent    the page a breadcrumb should lead back to
 *
 * ORDER MATTERS for matching: the first entry whose path matches wins, so
 * `/templates/new` is listed before `/templates/:id/edit` and both before
 * `/templates`.
 */

export const SECTIONS = ['Overview', 'Catalogue', 'Orders', 'Customers', 'Content', 'Settings'];

export const ROUTES = [
  // ── Overview ──────────────────────────────────────────────────────────────
  { path: '/dashboard', title: 'Overview', section: 'Overview', label: 'Dashboard', icon: IconGrid },
  { path: '/analytics', title: 'Website Analytics', section: 'Overview', label: 'Analytics', icon: IconChart },

  // ── Catalogue ─────────────────────────────────────────────────────────────
  { path: '/templates/new', title: 'Add Template', parent: '/templates' },
  { path: '/templates/:id/edit', title: 'Edit Template', parent: '/templates' },
  { path: '/templates', title: 'Templates', section: 'Catalogue', label: 'Templates', icon: IconLayers },
  { path: '/assets', title: 'Assets', section: 'Catalogue', label: 'Assets', icon: IconAsset },

  // ── Orders ────────────────────────────────────────────────────────────────
  // Transactions used to sit under "Users", which is where nobody looked for an
  // order.
  { path: '/transactions/:id', title: 'Transaction Detail', parent: '/transactions' },
  { path: '/transactions', title: 'Transactions', section: 'Orders', label: 'Transactions', icon: IconCard },
  { path: '/coupons', title: 'Coupons', section: 'Orders', label: 'Coupons', icon: IconTag },

  // ── Customers ─────────────────────────────────────────────────────────────
  { path: '/users/:id', title: 'User Detail', parent: '/users' },
  { path: '/users', title: 'Users', section: 'Customers', label: 'Users', icon: IconUsers },
  { path: '/tickets/:id', title: 'Support Ticket', parent: '/tickets' },
  { path: '/tickets', title: 'Support Tickets', section: 'Customers', label: 'Support Tickets', icon: IconMail, badge: true },
  { path: '/reviews', title: 'Reviews', section: 'Customers', label: 'Reviews', icon: IconStar },

  // ── Content ───────────────────────────────────────────────────────────────
  { path: '/blog/new', title: 'New Post', parent: '/blog' },
  { path: '/blog/:id/edit', title: 'Edit Post', parent: '/blog' },
  { path: '/blog', title: 'Blog', section: 'Content', label: 'Blog', icon: IconBlog },

  // ── Settings ──────────────────────────────────────────────────────────────
  { path: '/settings/pricing', title: 'Pricing Settings', section: 'Settings', label: 'Pricing', icon: IconSliders },
  { path: '/settings/payments', title: 'Payment Settings', section: 'Settings', label: 'Payments', icon: IconCard },
  { path: '/testing', title: 'Testing', section: 'Settings', label: 'Testing', icon: IconFlask },
  { path: '/developers', title: 'Template Developers', section: 'Settings', label: 'Developers', icon: IconCode },
];

/** `/users/:id` → a regex that matches `/users/abc123` but not `/users`. */
function toMatcher(path) {
  const source = path
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('/');
  return new RegExp(`^/${source}(/|$)`);
}

const MATCHERS = ROUTES.map((route) => ({ ...route, matcher: toMatcher(route.path) }));

/** The manifest entry for a pathname, or null. First match wins. */
export function routeFor(pathname) {
  return MATCHERS.find((route) => route.matcher.test(pathname)) || null;
}

/** The topbar title for a pathname. Empty string rather than a stale one. */
export function titleForPath(pathname) {
  const route = routeFor(pathname);
  return route ? route.title : '';
}

/** The sidebar, grouped, in SECTIONS order. Sections with no pages disappear. */
export const NAV = SECTIONS
  .map((section) => ({
    section,
    items: ROUTES.filter((route) => route.section === section),
  }))
  .filter((group) => group.items.length > 0);

/**
 * The trail for a detail page: its parent, then itself.
 *
 * `current` overrides the last crumb's text, which is how a page shows what it
 * is actually looking at ("Priya & Arjun") rather than its route's generic
 * title ("User Detail").
 */
export function trailFor(pathname, current) {
  const route = routeFor(pathname);
  if (!route) return [];
  const crumbs = [];
  if (route.parent) {
    const parent = routeFor(route.parent);
    if (parent) crumbs.push({ to: parent.path, label: parent.title });
  }
  crumbs.push({ label: current || route.title });
  return crumbs;
}
