import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import {
  useAnalytics, fmt, cap, StatCard, LegendDot, TwoCol, BreakdownCard, BreakdownRows, Funnel,
} from './analyticsParts';
import AnalyticsInsights from './AnalyticsInsights';
import AnalyticsTrialDemos from './AnalyticsTrialDemos';

// The two websites report into one database, so this picks which storefront's
// traffic is on screen. '' means both combined.
const STOREFRONTS = [
  { value: '',     label: 'All' },
  { value: 'IN',   label: 'India' },
  { value: 'INTL', label: 'International' },
];

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
  { label: '90 days', days: 89 },
];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'insights', label: 'Campaign insights' },
  { key: 'trial',    label: 'Try-it demos' },
];

const TAB_STORAGE_KEY = 'aam_admin_analytics_tab';

const STAGE_LABELS = {
  Visitors: 'Visited website',
  view_template: 'Viewed a template',
  initiate_checkout: 'Started checkout',
  purchase: 'Completed payment',
  register_complete: 'Created account',
};

function readTab() {
  try {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return TABS.some((t) => t.key === saved) ? saved : 'overview';
  } catch {
    return 'overview';
  }
}

export default function Analytics() {
  const [days, setDays] = useState(29);
  const [storefront, setStorefront] = useState('');
  const [tab, setTab] = useState(readTab);

  const chooseTab = (key) => {
    setTab(key);
    try { localStorage.setItem(TAB_STORAGE_KEY, key); } catch { /* private window */ }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Website Analytics</h1>
          <p className="page-subtitle">Traffic, what sells, and what to do next</p>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {STOREFRONTS.map(sf => (
              <button
                key={sf.value || 'all'}
                className={`btn btn-sm ${storefront === sf.value ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setStorefront(sf.value)}
              >
                {sf.label}
              </button>
            ))}
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
      </div>

      <div role="tablist" aria-label="Analytics views" style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`btn ${tab === t.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => chooseTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <Overview days={days} storefront={storefront} />}
      {tab === 'insights' && <AnalyticsInsights days={days} storefront={storefront} />}
      {tab === 'trial' && <AnalyticsTrialDemos days={days} storefront={storefront} />}
    </div>
  );
}

function Overview({ days, storefront }) {
  const { data, loading, refreshing, error } = useAnalytics(api.analytics.summary, days, storefront);
  const [live, setLive] = useState(null);

  // Live visitors refresh every 30s — but only while the tab is actually
  // visible. It used to keep polling in a background tab indefinitely.
  useEffect(() => {
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      api.analytics.live(storefront ? { storefront } : undefined).then(setLive).catch(() => {});
    };
    load();
    const t = setInterval(load, 30000);
    document.addEventListener('visibilitychange', load);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', load);
    };
    // Re-subscribe when the storefront filter changes, or the live count would
    // keep reporting whichever site was selected when the page first mounted.
  }, [storefront]);

  const ov = data?.overview;
  const liveCount = live?.liveVisitors ?? ov?.liveVisitors ?? 0;

  return (
    <>
      {error && <div className="card" style={{ padding: 20, color: 'var(--rose, #b42318)' }}>{error}</div>}
      {loading && <div className="spinner-wrap"><div className="spinner" /></div>}
      {refreshing && <div className="refresh-bar" />}

      {!loading && data && (
        <div className={refreshing ? 'is-refreshing' : undefined}>
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
            <Funnel
              steps={data.funnel.map((f) => ({ label: STAGE_LABELS[f.stage] || f.stage, count: f.sessions }))}
              note="Percentages show conversion from the previous step. “Completed payment” counts tracked sessions — see Paid Orders above for the authoritative payment count."
            />
          </div>

          {/* Breakdowns */}
          <TwoCol>
            <BreakdownCard title="Traffic Sources" rows={data.sources.map(s => [s.label, s.count])} />
            <BreakdownCard title="Top Pages" rows={data.pages.map(p => [p.path, p.views])} mono />
          </TwoCol>
          <TwoCol>
            <BreakdownCard title="Countries" rows={data.geo.countries.map(c => [c.label, c.count])} />
            <BreakdownCard
              title="Cities"
              rows={data.geo.cities.map(c => [[c.city, c.region, c.country].filter(Boolean).join(', '), c.count])}
              emptyHint="City/region needs the free “visitor location headers” transform enabled in Cloudflare."
            />
          </TwoCol>
          <TwoCol>
            <BreakdownCard title="Devices" rows={data.devices.map(d => [cap(d.label), d.count])} />
            <BreakdownCard title="Browsers" rows={data.browsers.map(b => [b.label, b.count])} />
          </TwoCol>

          {/* Live pages */}
          {live?.activePages?.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><span className="card-title">Active pages (last 5 minutes)</span></div>
              <BreakdownRows rows={live.activePages.map(p => [p.path, p.views])} mono />
            </div>
          )}
        </div>
      )}
    </>
  );
}

function stage(data, name) {
  return data.funnel.find(f => f.stage === name)?.sessions ?? 0;
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
