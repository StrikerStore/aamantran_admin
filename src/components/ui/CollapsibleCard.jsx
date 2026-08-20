import { useId, useState } from 'react';
import './CollapsibleCard.css';

/**
 * A `.card` whose header toggles its body open and closed.
 *
 * The open/close animation is the pure-CSS grid trick: the region is a grid
 * that moves between `grid-template-rows: 0fr` and `1fr`. That interpolates
 * without anyone measuring a height, so there is no JS, no scrollHeight read,
 * and no forced reflow — unlike the usual max-height hack it also lands on the
 * content's true height instead of an arbitrary ceiling.
 *
 * Drop-in for the existing markup: renders the same
 * `.card > .card-header > .card-title` + `.card-body` structure.
 */
export function CollapsibleCard({ title, children, defaultOpen = false, style, actions }) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();

  return (
    <div className={`card collapsible-card${open ? ' is-open' : ''}`} style={style}>
      <div className="card-header collapsible-header">
        <button
          type="button"
          className="collapsible-trigger"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="card-title">{title}</span>
          <svg
            className="collapsible-chevron"
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {actions}
      </div>

      <div className="collapsible-region" id={regionId} role="region">
        <div className="collapsible-inner">
          <div className="card-body">{children}</div>
        </div>
      </div>
    </div>
  );
}
