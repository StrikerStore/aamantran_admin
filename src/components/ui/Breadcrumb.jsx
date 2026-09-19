import { Link, useLocation } from 'react-router-dom';
import { trailFor } from '../../nav';

/**
 * The trail back out of a detail page.
 *
 * Every detail page hand-rolled this, each with `<a href="#">` and a click
 * handler that called navigate() — which gives a link that cannot be opened in a
 * new tab, copied, or followed by a keyboard user who expects a real link. This
 * uses react-router's Link, and takes its parent from the route manifest so the
 * trail cannot disagree with the sidebar.
 *
 * `current` is what this page is showing — a name, an order id — and replaces
 * the last crumb's generic title.
 */
export function Breadcrumb({ current }) {
  const { pathname } = useLocation();
  const crumbs = trailFor(pathname, current);
  if (crumbs.length === 0) return null;

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={crumb.to || `current-${i}`} className="breadcrumb-crumb">
          {i > 0 && <span className="breadcrumb-sep" aria-hidden="true">›</span>}
          {crumb.to
            ? <Link to={crumb.to}>{crumb.label}</Link>
            : <span aria-current="page">{crumb.label}</span>}
        </span>
      ))}
    </nav>
  );
}
