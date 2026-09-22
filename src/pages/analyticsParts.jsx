import { useEffect, useRef, useState } from 'react';

/* Shared building blocks for the Analytics tabs. */

export function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

export function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-IN');
}

export function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Load one analytics endpoint for the selected range and storefront.
 *
 * Switching range keeps the current figures on screen, dimmed, rather than
 * blanking the tab back to a spinner.
 */
export function useAnalytics(fetcher, days, storefront) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const loadedOnce = useRef(false);
  const silentRef = useRef(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // A background refresh swaps the figures in place without dimming the tab.
    const silent = silentRef.current;
    silentRef.current = false;
    if (!loadedOnce.current) setLoading(true);
    else if (!silent) setRefreshing(true);
    setError('');
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    fetcher({ from: isoDay(from), to: isoDay(to), ...(storefront ? { storefront } : {}) })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load analytics'); })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
        loadedOnce.current = true;
      });
    return () => { cancelled = true; };
    // fetcher is a stable api method.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, storefront, tick]);

  const reload = ({ silent = false } = {}) => {
    silentRef.current = silent;
    setTick((t) => t + 1);
  };
  return { data, loading, refreshing, error, reload };
}

export function StatCard({ label, value, accent, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub != null && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
      <div className="stat-accent" style={{ background: accent }} />
    </div>
  );
}

/** "▲ 24% vs previous period", coloured, or a dash when there is nothing to compare with. */
export function Delta({ change }) {
  if (change == null) return <span style={{ color: 'var(--text-muted)' }}>no earlier data</span>;
  if (change === 0) return <span style={{ color: 'var(--text-muted)' }}>no change vs previous period</span>;
  const up = change > 0;
  return (
    <span style={{ color: up ? 'var(--mint-deep, #1a7f55)' : 'var(--rose-deep, #b42318)', fontWeight: 600 }}>
      {up ? '▲' : '▼'} {Math.abs(change)}% <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>vs previous period</span>
    </span>
  );
}

export function LegendDot({ color }) {
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: color, marginRight: 5, verticalAlign: 'middle' }} />;
}

export function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>{children}</div>;
}

export function Card({ title, right, hint, children, style }) {
  return (
    <div className="card" style={{ marginBottom: 24, ...style }}>
      <div className="card-header" style={{ gap: 12, flexWrap: 'wrap' }}>
        <span className="card-title">{title}</span>
        {right}
      </div>
      {hint && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 16px 8px' }}>{hint}</p>}
      {children}
    </div>
  );
}

export function Empty({ children }) {
  return (
    <div className="empty-state" style={{ padding: 24 }}>
      <div className="empty-text">{children || 'No data yet'}</div>
    </div>
  );
}

export function BreakdownCard({ title, rows, mono, emptyHint, hint }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      {hint && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 16px 4px' }}>{hint}</p>}
      {rows.length === 0 ? <Empty>{emptyHint}</Empty> : <BreakdownRows rows={rows} mono={mono} />}
    </div>
  );
}

export function BreakdownRows({ rows, mono, color }) {
  const max = Math.max(...rows.map(r => r[1]), 1);
  return (
    <div style={{ padding: '8px 16px 14px' }}>
      {rows.map(([label, count, note]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', padding: '5px 0' }}>
          <div style={{ position: 'relative', minHeight: 22, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(count / max) * 100}%`, background: color || 'var(--lav, #8b8bd9)', opacity: 0.14, borderRadius: 4 }} />
            <span style={{ position: 'relative', fontSize: '0.84rem', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: mono ? 'ui-monospace, monospace' : undefined }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {fmt(count)}{note && <span style={{ color: 'var(--text-muted)' }}> · {note}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Horizontal funnel. Each step shows its count and the share of the previous
 * step that reached it — the leak to fix is the step with the smallest share.
 */
export function Funnel({ steps, note }) {
  const base = steps[0]?.count || 0;
  return (
    <div style={{ padding: '14px 16px' }}>
      {steps.map((s, i) => {
        const prev = i === 0 ? s.count : steps[i - 1].count;
        const pctOfBase = base ? (s.count / base) * 100 : 0;
        const pctOfPrev = prev ? Math.round((s.count / prev) * 100) : 0;
        return (
          <div key={s.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 190px) 1fr 110px', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.85rem' }}>{s.label}</div>
            <div style={{ background: 'var(--bg-subtle, #f2f2f7)', borderRadius: 6, height: 26, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(pctOfBase, s.count > 0 ? 2 : 0)}%`, height: '100%', background: 'linear-gradient(90deg, var(--lav, #8b8bd9), var(--mint, #4cc38a))', borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: '0.82rem', textAlign: 'right' }}>
              <strong>{fmt(s.count)}</strong>
              {i > 0 && <span style={{ color: 'var(--text-muted)' }}> · {pctOfPrev}%</span>}
            </div>
          </div>
        );
      })}
      {note && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{note}</p>}
    </div>
  );
}

/** Simple table inside a card. `cols`: [{ key, label, align, render }] */
export function DataTable({ cols, rows, empty, rowKey }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-container" style={{ boxShadow: 'none' }}>
      <table>
        <thead>
          <tr>{cols.map((c) => <th key={c.key} style={{ textAlign: c.align || 'left' }}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey ? rowKey(r) : i}>
              {cols.map((c) => (
                <td key={c.key} className={c.primary ? 'td-primary' : undefined} style={{ textAlign: c.align || 'left', fontVariantNumeric: c.align === 'right' ? 'tabular-nums' : undefined }}>
                  {c.render ? c.render(r) : r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A rate, shaded when it beats (or trails) a reference rate. */
export function Rate({ value, reference }) {
  let color;
  if (reference != null && value > 0 && value >= reference * 1.5) color = 'var(--mint-deep, #1a7f55)';
  if (reference != null && reference > 0 && value === 0) color = 'var(--rose-deep, #b42318)';
  return <span style={{ color, fontWeight: color ? 600 : undefined }}>{value}%</span>;
}
