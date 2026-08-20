import { useRef } from 'react';
import './Tabs.css';

/**
 * Segmented tab control with a sliding active indicator.
 *
 * The indicator moves with `transform: translateX()` only — no width/left
 * animation, no measuring the DOM. Equal-width columns make the geometry pure
 * arithmetic: the indicator is 1/n of the track, and slot `i` is `i * 100%` of
 * its own width away. React supplies the two numbers as CSS custom properties,
 * so there is no layout read, no ResizeObserver, and no animation library.
 *
 * tabs: [{ key, label }]
 */
export function Tabs({ tabs, value, onChange, ariaLabel }) {
  const listRef = useRef(null);
  const index = Math.max(0, tabs.findIndex((t) => t.key === value));

  // Roving arrow-key navigation, as expected of a real tablist.
  function onKeyDown(e) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    listRef.current?.querySelectorAll('[role="tab"]')[next]?.focus();
  }

  return (
    <div
      className="tabs"
      role="tablist"
      aria-label={ariaLabel}
      ref={listRef}
      onKeyDown={onKeyDown}
      style={{ '--tab-count': tabs.length, '--tab-index': index }}
    >
      <span className="tabs-indicator" aria-hidden="true" />
      {tabs.map((t) => {
        const selected = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`tabs-tab${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
