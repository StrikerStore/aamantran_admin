import { useEffect } from 'react';
import { api } from '../lib/api';
import { formatMoney } from '../lib/utils';
import {
  useAnalytics, fmt, cap, StatCard, TwoCol, Card, DataTable, Funnel, BreakdownCard, BreakdownRows, Empty, LegendDot,
} from './analyticsParts';

const VIA_LABELS = { inline: 'Inside the sheet', 'full-screen': 'Full screen' };

/**
 * "Try it with your names": what is live now, the last day, and history.
 *
 * Demos are erased 24 hours after they are made, so only the "live now" and
 * "last 24 hours" figures come from the demos themselves. History comes from
 * the website's anonymous events (kept 90 days), and sales from the orders.
 * Nothing a visitor typed — names, date, venue, city — is ever shown here.
 */
export default function AnalyticsTrialDemos({ days, storefront }) {
  const { data, loading, refreshing, error, reload } = useAnalytics(api.analytics.trialDemos, days, storefront);

  // Live demos count down in minutes; refresh every 30s while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') reload({ silent: true }); }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <div className="card" style={{ padding: 20, color: 'var(--rose, #b42318)' }}>{error}</div>;
  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!data) return null;

  const { funnel, sales, last24h, settings } = data;
  const tryToPaid = funnel.created ? ((funnel.paid / funnel.created) * 100).toFixed(1) : '0';

  return (
    <div className={refreshing ? 'is-refreshing' : undefined}>
      <div className="stats-grid">
        <StatCard
          label="Live right now"
          value={<span><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: data.live.length ? '#22c55e' : 'var(--text-muted)', marginRight: 8, verticalAlign: 'middle' }} />{fmt(data.live.length)}</span>}
          sub={`links work for ${settings.linkMinutes} minutes`}
          accent="#22c55e"
        />
        <StatCard label="Demos made" value={fmt(funnel.created)} sub={`${fmt(funnel.started)} opened the form`} accent="var(--lav)" />
        <StatCard
          label="Sales from demos"
          value={fmt(sales.paidOrders)}
          sub={`${sales.shareOfAllPaid}% of all paid orders · ${tryToPaid}% of demos`}
          accent="var(--mint)"
        />
        <StatCard
          label="Revenue from demos"
          value={sales.revenue.length ? sales.revenue.map((r) => formatMoney(r.amount, r.currency)).join(' + ') : '—'}
          sub="per currency, never added across"
          accent="var(--peach)"
        />
      </div>

      <Card
        title="Try-it funnel"
        hint="From opening the form to paying. Percentages are the share of the step before — the smallest one is where demos are lost."
      >
        <Funnel
          steps={[
            { label: 'Opened the form', count: funnel.started },
            { label: 'Made a demo', count: funnel.created },
            { label: 'Opened their demo', count: funnel.opened },
            { label: 'Went to checkout', count: funnel.toCheckout },
            { label: 'Order started', count: funnel.ordersCreated },
            { label: 'Paid', count: funnel.paid },
          ]}
          note="The first four steps are visitor sessions from website analytics; the last two are orders. Sales from demos are counted from orders placed after this release."
        />
      </Card>

      <Card
        title="Live right now"
        hint={`Demos whose link still works. Shown by design only — what the visitor typed stays private. Today: ${fmt(settings.createdToday)} of the ${fmt(settings.dailyCap)} daily limit.`}
        right={<button className="btn btn-sm btn-ghost" onClick={() => reload()}>Refresh</button>}
      >
        <DataTable
          rows={data.live}
          rowKey={(r) => r.id}
          empty="No demo links are live at the moment"
          cols={[
            { key: 'design', label: 'Design', primary: true },
            { key: 'createdAt', label: 'Made', render: (r) => minutesAgo(r.createdAt) },
            { key: 'minutesLeft', label: 'Link left', align: 'right', render: (r) => `${r.minutesLeft} min` },
            { key: 'views', label: 'Opens', align: 'right', render: (r) => fmt(r.views) },
            { key: 'ceremonies', label: 'Events', align: 'right', render: (r) => fmt(r.ceremonies) },
            { key: 'storefront', label: 'Site', render: (r) => (r.storefront === 'INTL' ? 'International' : 'India') },
            { key: 'startedCheckout', label: 'Checkout', render: (r) => (r.startedCheckout ? <strong style={{ color: 'var(--mint-deep, #1a7f55)' }}>Started</strong> : '—') },
          ]}
        />
      </Card>

      <Card
        title="Last 24 hours"
        hint={`Demos are erased ${settings.dataHours} hours after they are made; these figures come from the ones still stored.`}
      >
        <BreakdownRows
          rows={[
            ['Demos made', last24h.created],
            ['Opened at least once', last24h.opened],
            ['Opened more than once — usually forwarded to family', last24h.openedMoreThanOnce],
            ['Went on to checkout', last24h.startedCheckout],
            ['Paid', last24h.paid],
          ]}
        />
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 16px 14px' }}>
          {fmt(last24h.totalViews)} opens in total{last24h.created ? `, ${(last24h.totalViews / last24h.created).toFixed(1)} per demo` : ''}.
        </p>
      </Card>

      <Card
        title="Demos per day"
        right={(
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <LegendDot color="var(--lav, #8b8bd9)" /> Made&nbsp;&nbsp;<LegendDot color="var(--mint, #4cc38a)" /> Went to checkout
          </span>
        )}
      >
        <DailyBars daily={data.daily} />
      </Card>

      <Card
        title="By design"
        hint="Try rate is the share of a design's viewers who made a demo. A design people try a lot but rarely buy may need a clearer price or offer."
      >
        <DataTable
          rows={data.designs}
          rowKey={(r) => r.slug}
          empty="No demos in this period"
          cols={[
            { key: 'name', label: 'Design', primary: true },
            { key: 'viewers', label: 'Viewers', align: 'right', render: (r) => fmt(r.viewers) },
            { key: 'started', label: 'Opened form', align: 'right', render: (r) => fmt(r.started) },
            { key: 'created', label: 'Made demo', align: 'right', render: (r) => fmt(r.created) },
            { key: 'tryRate', label: 'Try rate', align: 'right', render: (r) => `${r.tryRate}%` },
            { key: 'toCheckout', label: 'To checkout', align: 'right', render: (r) => fmt(r.toCheckout) },
            { key: 'paid', label: 'Paid', align: 'right', render: (r) => fmt(r.paid) },
          ]}
        />
      </Card>

      <TwoCol>
        <BreakdownCard
          title="How far away the event is"
          hint="When demo makers' celebrations are — target ads at couples this far out."
          rows={data.lead.filter((l) => l.count > 0).map((l) => [l.label, l.count])}
          emptyHint="Recorded from this release onwards"
        />
        <BreakdownCard
          title="Events they picked"
          hint="Which ceremonies people put in their demo — the ones to feature in creative."
          rows={data.ceremonies.map((c) => [c.label, c.count])}
          emptyHint="Recorded from this release onwards"
        />
      </TwoCol>
      <TwoCol>
        <BreakdownCard title="Where demo makers came from" rows={data.sources.map((s) => [s.label, s.count])} emptyHint="No demos in this period" />
        <div className="card">
          <div className="card-header"><span className="card-title">Devices and how demos were opened</span></div>
          {data.devices.length === 0 && data.openedVia.length === 0 ? <Empty>No demos in this period</Empty> : (
            <>
              <BreakdownRows rows={data.devices.map((d) => [cap(d.label), d.count])} />
              {data.openedVia.length > 0 && (
                <BreakdownRows rows={data.openedVia.map((v) => [VIA_LABELS[v.label] || v.label, v.count])} color="var(--sky, #6cb4ee)" />
              )}
            </>
          )}
        </div>
      </TwoCol>
    </div>
  );
}

function minutesAgo(date) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(date).getTime()) / 60000));
  return mins < 1 ? 'just now' : `${mins} min ago`;
}

function DailyBars({ daily }) {
  if (!daily.length) return <Empty>No demos in this period</Empty>;
  const max = Math.max(1, ...daily.map((d) => d.created));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160, padding: '16px 16px 8px' }}>
      {daily.map((d) => (
        <div
          key={d.date}
          title={`${d.date} — ${d.created} made, ${d.toCheckout} went to checkout`}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%', position: 'relative', minWidth: 4 }}
        >
          <div style={{ height: `${(d.created / max) * 100}%`, background: 'var(--lav, #8b8bd9)', borderRadius: '3px 3px 0 0', opacity: 0.45, minHeight: d.created ? 2 : 0 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(d.toCheckout / max) * 100}%`, background: 'var(--mint, #4cc38a)', borderRadius: '3px 3px 0 0', minHeight: d.toCheckout ? 2 : 0 }} />
        </div>
      ))}
    </div>
  );
}
