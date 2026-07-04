import { useState, useEffect, useLayoutEffect } from 'react';
import { api } from '../lib/api';

function setTopbarTitle(title) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = title;
}

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
];

const STAGE_LABELS = {
  Visitors: 'Visited website',
  view_template: 'Viewed a template',
  initiate_checkout: 'Started checkout',
  purchase: 'Completed payment',
  register_complete: 'Created account',
};

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

export default function Analytics() {
  const [days, setDays] = useState(29);
  const [data, setData] = useState(null);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useLayoutEffect(() => { setTopbarTitle('Website Analytics'); }, []);

  useEffect(() => {
    setLoading(true);
    setError('');
    const to = new Date();
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    api.analytics.summary({ from: isoDay(from), to: isoDay(to) })
      .then(setData)
      .catch(e => setError(e.message || 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [days]);

  // Live visitors refresh every 30s
  useEffect(() => {
    const load = () => api.analytics.live().then(setLive).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const ov = data?.overview;
  const liveCount = live?.liveVisitors ?? ov?.liveVisitors ?? 0;

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Website Analytics</h1>
          <p className="page-subtitle">First-party traffic, sources and conversion funnel</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PRESETS.map(p => (
            <button
              key={p.days}
              className={`btn btn-sm ${days === p.days ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setDays(p.days)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="card" style={{ padding: 20, color: 'var(--rose, #b42318)' }}>{error}</div>}
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}

      {!loading && data && (
        <>
          {/* Overview cards */}
          <div className="stats-grid">
            <StatCard label="Visitors" value={fmt(ov.visitors)} accent="var(--lav)" />
            <StatCard label="Page Views" value={fmt(ov.pageViews)} accent="var(--sky)" />
            <StatCard
              label="Live Right Now"
              value={<span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#22c55e', marginRight: 8, verticalAlign: 'middle' }} />{fmt(liveCount)}</span>}
              accent="#22c55e"
            />
            <StatCard label="Pages / Visit" value={ov.avgPagesPerVisit} accent="var(--mint)" />
          </div>
          <div className="stats-grid">
            <StatCard label="Checkouts Started" value={fmt(stage(data, 'initiate_checkout'))} accent="var(--sky)" />
            <StatCard label="Paid Orders" value={fmt(ov.paidOrders)} accent="var(--mint)" />
            <StatCard label="Conversion Rate" value={`${ov.conversionRate}%`} accent="var(--lav)" />
            <StatCard label="Accounts Created" value={fmt(stage(data, 'register_complete'))} accent="var(--rose)" />
          </div>

          {/* Traffic over time */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="card-title">Traffic over time</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <LegendDot color="var(--lav, #8b8bd9)" /> Page views&nbsp;&nbsp;
                <LegendDot color="var(--mint, #4cc38a)" /> Visitors
              </span>
            </div>
            <TimeseriesChart series={data.timeseries} />
          </div>

          {/* Funnel */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header"><span className="card-title">Invitation creation funnel</span></div>
            <Funnel funnel={data.funnel} paidOrders={ov.paidOrders} />
          </div>

          {/* Breakdowns */}
          <TwoCol>
            <BreakdownCard title="Traffic Sources" rows={data.sources.map(s => [s.label, s.count])} valueLabel="Visitors" />
            <BreakdownCard title="Top Pages" rows={data.pages.map(p => [p.path, p.views])} valueLabel="Views" mono />
          </TwoCol>
          <TwoCol>
            <BreakdownCard title="Countries" rows={data.geo.countries.map(c => [c.label, c.count])} valueLabel="Visitors" />
            <BreakdownCard
              title="Cities"
              rows={data.geo.cities.map(c => [[c.city, c.region, c.country].filter(Boolean).join(', '), c.count])}
              valueLabel="Visitors"
              emptyHint="City/region needs the free “visitor location headers” transform enabled in Cloudflare."
            />
          </TwoCol>
          <TwoCol>
            <BreakdownCard title="Devices" rows={data.devices.map(d => [cap(d.label), d.count])} valueLabel="Visitors" />
            <BreakdownCard title="Browsers" rows={data.browsers.map(b => [b.label, b.count])} valueLabel="Visitors" />
          </TwoCol>

          {/* Live pages */}
          {live?.activePages?.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><span className="card-title">Active pages (last 5 minutes)</span></div>
              <BreakdownRows rows={live.activePages.map(p => [p.path, p.views])} mono />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── helpers ── */

function fmt(n) {
  return Number(n ?? 0).toLocaleString('en-IN');
}
function cap(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function stage(data, name) {
  return data.funnel.find(f => f.stage === name)?.sessions ?? 0;
}

function StatCard({ label, value, accent }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-accent" style={{ background: accent }} />
    </div>
  );
}

function LegendDot({ color }) {
  return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: color, marginRight: 5, verticalAlign: 'middle' }} />;
}

function TwoCol({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24 }}>{children}</div>;
}

function TimeseriesChart({ series }) {
  if (!series?.length) {
    return <div className="empty-state" style={{ padding: 28 }}><div className="empty-text">No traffic in this period yet</div></div>;
  }
  const max = Math.max(...series.map(d => d.pageViews), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 180, padding: '16px 16px 8px' }}>
      {series.map(d => (
        <div
          key={d.date}
          title={`${d.date} — ${d.pageViews} views, ${d.visitors} visitors`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative', minWidth: 4 }}
        >
          <div style={{ height: `${(d.pageViews / max) * 100}%`, background: 'var(--lav, #8b8bd9)', borderRadius: '3px 3px 0 0', opacity: 0.45, minHeight: d.pageViews ? 2 : 0 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(d.visitors / max) * 100}%`, background: 'var(--mint, #4cc38a)', borderRadius: '3px 3px 0 0', minHeight: d.visitors ? 2 : 0 }} />
        </div>
      ))}
    </div>
  );
}

function Funnel({ funnel }) {
  const base = funnel[0]?.sessions || 0;
  return (
    <div style={{ padding: '14px 16px' }}>
      {funnel.map((f, i) => {
        const prev = i === 0 ? f.sessions : funnel[i - 1].sessions;
        const pctOfBase = base ? (f.sessions / base) * 100 : 0;
        const pctOfPrev = prev ? Math.round((f.sessions / prev) * 100) : 0;
        return (
          <div key={f.stage} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 130px', gap: 12, alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: '0.85rem' }}>{STAGE_LABELS[f.stage] || f.stage}</div>
            <div style={{ background: 'var(--bg-subtle, #f2f2f7)', borderRadius: 6, height: 26, overflow: 'hidden' }}>
              <div style={{ width: `${Math.max(pctOfBase, f.sessions > 0 ? 2 : 0)}%`, height: '100%', background: 'linear-gradient(90deg, var(--lav, #8b8bd9), var(--mint, #4cc38a))', borderRadius: 6 }} />
            </div>
            <div style={{ fontSize: '0.82rem', textAlign: 'right' }}>
              <strong>{fmt(f.sessions)}</strong>
              {i > 0 && <span style={{ color: 'var(--text-muted)' }}> · {pctOfPrev}%</span>}
            </div>
          </div>
        );
      })}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
        Percentages show conversion from the previous step. “Completed payment” counts tracked sessions — see Paid Orders above for the authoritative payment count.
      </p>
    </div>
  );
}

function BreakdownCard({ title, rows, valueLabel, mono, emptyHint }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      {rows.length === 0 ? (
        <div className="empty-state" style={{ padding: 24 }}>
          <div className="empty-text">{emptyHint || 'No data yet'}</div>
        </div>
      ) : (
        <BreakdownRows rows={rows} valueLabel={valueLabel} mono={mono} />
      )}
    </div>
  );
}

function BreakdownRows({ rows, mono }) {
  const max = Math.max(...rows.map(r => r[1]), 1);
  return (
    <div style={{ padding: '8px 16px 14px' }}>
      {rows.map(([label, count]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '1fr 70px', gap: 10, alignItems: 'center', padding: '5px 0' }}>
          <div style={{ position: 'relative', minHeight: 22, display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(count / max) * 100}%`, background: 'var(--lav, #8b8bd9)', opacity: 0.14, borderRadius: 4 }} />
            <span style={{ position: 'relative', fontSize: '0.84rem', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: mono ? 'ui-monospace, monospace' : undefined }}>
              {label}
            </span>
          </div>
          <div style={{ fontSize: '0.84rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(count)}</div>
        </div>
      ))}
    </div>
  );
}
