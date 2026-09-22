import { useState } from 'react';
import { api } from '../lib/api';
import {
  useAnalytics, fmt, cap, StatCard, Delta, TwoCol, Card, DataTable, Rate, BreakdownRows, Empty,
} from './analyticsParts';

const TONES = {
  good: { bg: 'var(--mint-soft, #e7f7ef)', border: 'var(--mint, #4cc38a)', label: 'Working' },
  warn: { bg: 'var(--peach-soft, #fff1e6)', border: 'var(--peach, #f4a261)', label: 'Fix' },
  info: { bg: 'var(--sky-soft, #e8f3fc)', border: 'var(--sky, #6cb4ee)', label: 'Plan' },
};

/**
 * Campaign insights: written findings first, then the tables they come from —
 * channels and campaigns, designs, timing, devices and countries.
 */
export default function AnalyticsInsights({ days, storefront }) {
  const { data, loading, refreshing, error } = useAnalytics(api.analytics.insights, days, storefront);

  if (error) return <div className="card" style={{ padding: 20, color: 'var(--rose, #b42318)' }}>{error}</div>;
  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!data) return null;

  const { compare, totals, orders } = data;
  const overallRate = totals.visitors ? Number(((orders.paid / totals.visitors) * 100).toFixed(2)) : 0;

  return (
    <div className={refreshing ? 'is-refreshing' : undefined}>
      {refreshing && <div className="refresh-bar" />}

      {/* What changed */}
      <div className="stats-grid">
        <StatCard label="Visitors" value={fmt(compare.visitors.current)} sub={<Delta change={compare.visitors.change} />} accent="var(--lav)" />
        <StatCard label="Checkouts started" value={fmt(compare.checkouts.current)} sub={<Delta change={compare.checkouts.change} />} accent="var(--sky)" />
        <StatCard label="Try-it demos made" value={fmt(compare.tryDemos.current)} sub={<Delta change={compare.tryDemos.change} />} accent="var(--peach)" />
        <StatCard label="Paid orders" value={fmt(compare.paidOrders.current)} sub={<Delta change={compare.paidOrders.change} />} accent="var(--mint)" />
      </div>

      {/* Findings */}
      <Card
        title="What the numbers say"
        hint="Written from this period's data. A finding appears only once there is enough traffic behind it to trust."
      >
        {data.insights.length === 0 ? (
          <Empty>Not enough traffic in this period to draw conclusions yet. Try a longer range.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 12, padding: '4px 16px 16px' }}>
            {data.insights.map((i) => <Insight key={i.title} insight={i} />)}
          </div>
        )}
      </Card>

      {/* Channels */}
      <Card
        title="Channels and campaigns"
        hint={`Where visitors came from, and what they went on to do. "Bought" counts tracked purchases, which undercount a little; use it to compare channels. Overall, ${overallRate}% of visitors bought.`}
      >
        <DataTable
          rows={data.channels}
          rowKey={(r) => `${r.source}|${r.medium}|${r.campaign}`}
          empty="No visitors in this period"
          cols={[
            { key: 'source', label: 'Source', primary: true, render: (r) => r.source },
            { key: 'campaign', label: 'Campaign', render: (r) => r.campaign || <Muted>—</Muted> },
            { key: 'medium', label: 'Medium', render: (r) => r.medium || <Muted>—</Muted> },
            { key: 'visitors', label: 'Visitors', align: 'right', render: (r) => fmt(r.visitors) },
            { key: 'viewedTemplate', label: 'Viewed a design', align: 'right', render: (r) => fmt(r.viewedTemplate) },
            { key: 'triedDemo', label: 'Tried it', align: 'right', render: (r) => fmt(r.triedDemo) },
            { key: 'startedCheckout', label: 'Checkout', align: 'right', render: (r) => fmt(r.startedCheckout) },
            { key: 'purchased', label: 'Bought', align: 'right', render: (r) => fmt(r.purchased) },
            { key: 'conversionRate', label: 'Conversion', align: 'right', render: (r) => <Rate value={r.conversionRate} reference={r.visitors >= 20 ? overallRate : null} /> },
          ]}
        />
        <UtmTip />
      </Card>

      {/* Designs */}
      <Card
        title="Designs: interest vs sales"
        hint="Viewers are visitors who opened a design's page. Paid orders come from payments. A high-interest design that rarely sells is a candidate for a coupon or a retargeting ad; a high converter is your ad's hero."
      >
        <DataTable
          rows={data.templates}
          rowKey={(r) => r.id}
          empty="No design activity in this period"
          cols={[
            { key: 'name', label: 'Design', primary: true, render: (r) => <>{r.name}{!r.isActive && <Muted> (hidden)</Muted>}</> },
            { key: 'viewers', label: 'Viewers', align: 'right', render: (r) => fmt(r.viewers) },
            { key: 'demoOpens', label: 'Live demo', align: 'right', render: (r) => fmt(r.demoOpens) },
            { key: 'tryDemos', label: 'Tried it', align: 'right', render: (r) => fmt(r.tryDemos) },
            { key: 'checkouts', label: 'Checkout', align: 'right', render: (r) => fmt(r.checkouts) },
            { key: 'paidOrders', label: 'Paid orders', align: 'right', render: (r) => fmt(r.paidOrders) },
            { key: 'viewToBuy', label: 'View → buy', align: 'right', render: (r) => <Rate value={r.viewToBuy} reference={r.viewers >= 15 ? avgViewToBuy(data.templates) : null} /> },
          ]}
        />
      </Card>

      {/* Timing */}
      <Heatmap timing={data.timing} />

      {/* Try-it lift + orders */}
      <TwoCol>
        <div className="card">
          <div className="card-header"><span className="card-title">Does trying a design sell it?</span></div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 16px 8px' }}>
            Visitors who looked at a design, split by whether they made a try-it demo.
          </p>
          <LiftBars lift={data.tryLift} />
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Orders in this period</span></div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 16px 8px' }}>
            Every order opened at checkout, by how it ended.
          </p>
          <BreakdownRows
            rows={[
              ['Paid', orders.paid],
              ['Still pending (not paid)', orders.pending],
              ['Failed at the gateway', orders.failed],
              ['Refunded', orders.refunded],
            ]}
          />
        </div>
      </TwoCol>

      {/* Devices and countries */}
      <TwoCol>
        <Card title="Devices" style={{ marginBottom: 0 }}>
          <DataTable
            rows={data.devices}
            rowKey={(r) => r.label}
            cols={[
              { key: 'label', label: 'Device', primary: true, render: (r) => cap(r.label) },
              { key: 'visitors', label: 'Visitors', align: 'right', render: (r) => fmt(r.visitors) },
              { key: 'purchased', label: 'Bought', align: 'right', render: (r) => fmt(r.purchased) },
              { key: 'conversionRate', label: 'Conversion', align: 'right', render: (r) => `${r.conversionRate}%` },
            ]}
          />
        </Card>
        <Card title="Countries" style={{ marginBottom: 0 }}>
          <DataTable
            rows={data.countries}
            rowKey={(r) => r.label}
            cols={[
              { key: 'label', label: 'Country', primary: true },
              { key: 'visitors', label: 'Visitors', align: 'right', render: (r) => fmt(r.visitors) },
              { key: 'purchased', label: 'Bought', align: 'right', render: (r) => fmt(r.purchased) },
              { key: 'conversionRate', label: 'Conversion', align: 'right', render: (r) => `${r.conversionRate}%` },
            ]}
          />
        </Card>
      </TwoCol>

      {/* Unmet demand */}
      <Card
        title="Occasions shoppers asked for"
        hint="Clicks on an occasion the shop does not stock yet — demand waiting for a design."
      >
        {data.occasions.length === 0
          ? <Empty>No requests in this period</Empty>
          : <BreakdownRows rows={data.occasions.map((o) => [o.label, o.count])} color="var(--peach, #f4a261)" />}
      </Card>
    </div>
  );
}

function Muted({ children }) {
  return <span style={{ color: 'var(--text-muted)' }}>{children}</span>;
}

function avgViewToBuy(templates) {
  const viewers = templates.reduce((s, t) => s + t.viewers, 0);
  const paid = templates.reduce((s, t) => s + t.paidOrders, 0);
  return viewers ? (paid / viewers) * 100 : 0;
}

function Insight({ insight }) {
  const tone = TONES[insight.tone] || TONES.info;
  return (
    <div style={{ background: tone.bg, borderLeft: `4px solid ${tone.border}`, borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{tone.label}</span>
        <strong style={{ fontSize: '0.92rem', color: 'var(--text-primary)' }}>{insight.title}</strong>
      </div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: 4 }}>{insight.detail}</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--text-primary)', marginTop: 6 }}>→ {insight.action}</div>
    </div>
  );
}

function UtmTip() {
  return (
    <details style={{ margin: '4px 16px 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
      <summary style={{ cursor: 'pointer' }}>How to make a campaign show up here</summary>
      <p style={{ margin: '8px 0 4px' }}>
        Add tags to every link you post or put in an ad. Visitors are credited to the source and campaign in the link they first arrived on:
      </p>
      <code style={{ display: 'block', padding: 8, background: 'var(--bg-elevated)', borderRadius: 6, wordBreak: 'break-all' }}>
        https://aamantran.online/?utm_source=instagram&amp;utm_medium=reel&amp;utm_campaign=diwali-2026
      </code>
      <p style={{ margin: '6px 0 0' }}>
        Use one <strong>utm_campaign</strong> name per campaign, and a different <strong>utm_medium</strong> per format (reel, story, bio, whatsapp) to compare them.
      </p>
    </details>
  );
}

function LiftBars({ lift }) {
  const rows = [
    { label: 'Made a try-it demo', ...lift.tried, color: 'var(--mint, #4cc38a)' },
    { label: 'Only viewed the design', ...lift.viewedOnly, color: 'var(--lav, #8b8bd9)' },
  ];
  const max = Math.max(...rows.map((r) => r.rate), 1);
  if (!rows.some((r) => r.sessions)) return <Empty>No design views in this period</Empty>;
  return (
    <div style={{ padding: '8px 16px 16px', display: 'grid', gap: 12 }}>
      {rows.map((r) => (
        <div key={r.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 4 }}>
            <span>{r.label}</span>
            <span><strong>{r.rate}%</strong> <span style={{ color: 'var(--text-muted)' }}>bought ({fmt(r.purchased)} of {fmt(r.sessions)})</span></span>
          </div>
          <div style={{ background: 'var(--bg-subtle, #f2f2f7)', borderRadius: 6, height: 14, overflow: 'hidden' }}>
            <div style={{ width: `${(r.rate / max) * 100}%`, height: '100%', background: r.color, borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Heatmap({ timing }) {
  const [metric, setMetric] = useState('visitors');
  const grid = metric === 'visitors' ? timing.visitors : timing.paidOrders;
  const max = Math.max(1, ...grid.flat());
  const total = grid.flat().reduce((a, b) => a + b, 0);
  return (
    <Card
      title="When people shop"
      hint={`Day and hour in ${timing.timezone}. Darker is busier — schedule posts and weight ad spend toward the dark cells.`}
      right={(
        <div style={{ display: 'flex', gap: 6 }}>
          {[['visitors', 'Visitors'], ['paidOrders', 'Paid orders']].map(([k, label]) => (
            <button key={k} className={`btn btn-sm ${metric === k ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetric(k)}>{label}</button>
          ))}
        </div>
      )}
    >
      {total === 0 ? <Empty>Nothing in this period yet</Empty> : (
        <div style={{ padding: '4px 16px 16px', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(24, minmax(14px, 1fr))', gap: 2, minWidth: 420 }}>
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center' }}>{h % 3 === 0 ? h : ''}</div>
            ))}
            {timing.days.map((d, di) => (
              <Row key={d} label={d} cells={grid[di]} max={max} metric={metric} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function Row({ label, cells, max, metric }) {
  return (
    <>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center' }}>{label}</div>
      {cells.map((v, h) => (
        <div
          key={h}
          title={`${label} ${String(h).padStart(2, '0')}:00 — ${v} ${metric === 'visitors' ? 'visitors' : 'paid orders'}`}
          style={{
            height: 20,
            borderRadius: 3,
            background: v ? (metric === 'visitors' ? 'var(--lav, #8b8bd9)' : 'var(--mint, #4cc38a)') : 'var(--bg-subtle, #f2f2f7)',
            opacity: v ? 0.2 + 0.8 * (v / max) : 1,
          }}
        />
      ))}
    </>
  );
}
