import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, formatMoney } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Select } from '../components/ui/Select';

/**
 * What the business did, over a period you choose.
 *
 * The four cards here used to be `total` counts borrowed from list endpoints —
 * how many templates exist, how many users have registered ever, how many
 * payments are paid ever, how many tickets are open. Three of those only ever go
 * up, so the dashboard could not tell a good month from a bad one.
 *
 * Money is shown per currency, never added together: an order's amount is in the
 * minor units of its own currency, so one combined "revenue" number across
 * rupees and dollars would be false.
 *
 * "Needs attention" is deliberately first among equals: a paid order whose buyer
 * never finished registering is someone who has paid and has nothing, and it is
 * the one figure here that is a job rather than a statistic.
 */

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/** YYYY-MM-DD, `days` ago in UTC — the same day boundaries the API uses. */
function dayKey(daysAgo) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [days, setDays] = useState(() => localStorage.getItem('aam_admin_dash_range') || '30');
  const [storefront, setStorefront] = useState('');
  const [metrics, setMetrics] = useState(null);
  const [recent, setRecent] = useState({});
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await api.analytics.business({
        from: dayKey(Number(days) - 1),
        to: dayKey(0),
        storefront: storefront || undefined,
      });
      setMetrics(res);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [days, storefront]);

  useEffect(() => { load(); }, [load]);

  // The two lists below are context, not headline figures, so they load on their
  // own and a failure in one never blanks the page.
  useEffect(() => {
    let alive = true;
    api.users.list({ limit: 5 })
      .then((r) => { if (alive) setRecent((s) => ({ ...s, users: r.data })); })
      .catch(() => { if (alive) setRecent((s) => ({ ...s, users: [] })); });
    api.transactions.list({ limit: 5 })
      .then((r) => { if (alive) setRecent((s) => ({ ...s, txs: r.data })); })
      .catch(() => { if (alive) setRecent((s) => ({ ...s, txs: [] })); });
    return () => { alive = false; };
  }, []);

  function changeRange(value) {
    setDays(value);
    localStorage.setItem('aam_admin_dash_range', value);
  }

  const revenue = metrics?.revenue || [];
  const previous = metrics?.previousRevenue || [];
  const attention = metrics?.attention || {};
  const periodLabel = RANGES.find((r) => r.value === days)?.label.toLowerCase() || 'this period';

  /** The same currency's figure in the period before this one, for the comparison. */
  const previousFor = (currency) => previous.find((p) => p.currency === currency);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">What sold, {periodLabel}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Select className="filter-select" value={days} onChange={(e) => changeRange(e.target.value)} aria-label="Period">
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
          <Select className="filter-select" value={storefront} onChange={(e) => setStorefront(e.target.value)} aria-label="Storefront">
            <option value="">Both sites</option>
            <option value="IN">India</option>
            <option value="INTL">Global</option>
          </Select>
        </div>
      </div>

      {failed && (
        <div className="dash-error" role="alert">
          The dashboard figures could not be loaded.{' '}
          <button className="btn btn-ghost btn-sm" onClick={load}>Try again</button>
        </div>
      )}

      {/* ── Money, per currency ───────────────────────────────────────────── */}
      <div className="stats-grid">
        {loading && revenue.length === 0 && (
          <>
            <StatCard label="Received" value={undefined} />
            <StatCard label="Orders" value={undefined} />
          </>
        )}

        {!loading && revenue.length === 0 && (
          <StatCard label="Received" value={formatMoney(0, 'INR')} sub={`Nothing sold ${periodLabel}`} accent="var(--mint)" />
        )}

        {revenue.map((r) => {
          const before = previousFor(r.currency);
          return (
            <StatCard
              key={r.currency}
              label={`Received (${r.currency})`}
              value={formatMoney(r.paidAmount, r.currency)}
              sub={
                <>
                  {r.paidOrders} order{r.paidOrders === 1 ? '' : 's'}
                  {before && <> · was {formatMoney(before.paidAmount, r.currency)} the period before</>}
                  {r.refundedOrders > 0 && (
                    <> · {r.refundedOrders} refunded ({formatMoney(r.refundedAmount, r.currency)})</>
                  )}
                </>
              }
              accent={r.currency === 'USD' ? 'var(--sky)' : 'var(--mint)'}
            />
          );
        })}

        <StatCard
          label="Visitors → orders"
          value={metrics ? `${metrics.conversion.rate}%` : undefined}
          sub={metrics ? `${metrics.conversion.paidOrders} paid of ${metrics.conversion.visitors} visits` : ''}
          accent="var(--lav)"
        />
      </div>

      {/* ── Things waiting for someone ────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Needs attention</span></div>
        <div className="card-body">
          <div className="dash-attention">
            <AttentionItem
              count={attention.paidNotOnboarded}
              label="paid, account never created"
              detail="They have paid and have no invitation to build. Worth an email."
              onClick={() => navigate('/transactions?status=paid')}
              urgent
            />
            <AttentionItem
              count={attention.openTickets}
              label="open support tickets"
              onClick={() => navigate('/tickets')}
            />
            <AttentionItem
              count={attention.stuckPending}
              label="orders stuck pending over an hour"
              detail="Started checkout, never came back. Usually abandoned, occasionally a gateway problem."
              onClick={() => navigate('/transactions?status=pending')}
            />
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* ── What sold ───────────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Best sellers</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/templates')}>All designs →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Design</th><th>Orders</th><th>Received</th></tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={3}><div className="spinner-wrap" style={{ padding: 24 }}><div className="spinner" /></div></td></tr>
                )}
                {!loading && (metrics?.topTemplates || []).length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">Nothing sold {periodLabel}</div></div></td></tr>
                )}
                {!loading && (metrics?.topTemplates || []).map((t) => (
                  <tr key={`${t.id}-${t.currency}`}>
                    <td className="td-primary">{t.name}</td>
                    <td>{t.orders}</td>
                    <td>{formatMoney(t.amount, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Where the money came through ────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Orders and gateways</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>All orders →</button>
          </div>
          <div className="card-body">
            {metrics && (
              <div className="dash-orderline">
                <span><strong>{metrics.orders.paid}</strong> paid</span>
                <span><strong>{metrics.orders.pending}</strong> pending</span>
                <span><strong>{metrics.orders.failed}</strong> failed</span>
                <span><strong>{metrics.orders.refunded}</strong> refunded</span>
              </div>
            )}
            <table>
              <thead>
                <tr><th>Gateway</th><th>Orders</th><th>Received</th></tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={3}><div className="spinner-wrap" style={{ padding: 24 }}><div className="spinner" /></div></td></tr>
                )}
                {!loading && (metrics?.gateways || []).length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No payments {periodLabel}</div></div></td></tr>
                )}
                {!loading && (metrics?.gateways || []).map((g) => (
                  <tr key={`${g.gateway}-${g.currency}`}>
                    <td className="td-primary">{g.gateway === 'razorpay' ? 'Razorpay' : 'PayU'}</td>
                    <td>{g.orders}</td>
                    <td>{formatMoney(g.amount, g.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Recent, for context ─────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent orders</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>View all →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>User</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {recent.txs === undefined && (
                  <tr><td colSpan={3}><div className="spinner-wrap" style={{ padding: 24 }}><div className="spinner" /></div></td></tr>
                )}
                {recent.txs?.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No transactions yet</div></div></td></tr>
                )}
                {recent.txs?.map(tx => (
                  <tr key={tx.id} className="clickable" onClick={() => navigate(`/transactions/${tx.id}`)}>
                    <td>
                      <div className="td-primary">{tx.user?.username || tx.customerEmail || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tx.template?.name}</div>
                    </td>
                    <td>{formatMoney(tx.amount, tx.currency)}</td>
                    <td><Badge status={tx.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent sign-ups</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/users')}>View all →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Username / Email</th><th>Events</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {recent.users === undefined && (
                  <tr><td colSpan={3}><div className="spinner-wrap" style={{ padding: 24 }}><div className="spinner" /></div></td></tr>
                )}
                {recent.users?.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No users yet</div></div></td></tr>
                )}
                {recent.users?.map(u => (
                  <tr key={u.id} className="clickable" onClick={() => navigate(`/users/${u.id}`)}>
                    <td>
                      <div className="td-primary">{u.username || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{u.email}</div>
                    </td>
                    <td>{u._count?.events ?? 0}</td>
                    <td>{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  const pending = value === undefined;
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${pending ? ' stat-value-pending' : ''}`}>
        {pending ? '—' : value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
      <div className="stat-accent" style={{ background: accent || 'var(--lav)' }} />
    </div>
  );
}

/**
 * One row of the attention list.
 *
 * A zero is shown, not hidden: "0 paid, account never created" is the reassuring
 * answer to a question an owner asks, and a row that disappears when it is fine
 * leaves you unsure whether it was checked.
 */
function AttentionItem({ count, label, detail, onClick, urgent }) {
  const n = count ?? 0;
  const active = n > 0;
  return (
    <button
      type="button"
      className={`dash-attention-item${active && urgent ? ' is-urgent' : ''}`}
      onClick={onClick}
    >
      <span className="dash-attention-count">{count === undefined ? '—' : n}</span>
      <span className="dash-attention-label">{label}</span>
      {detail && active && <span className="dash-attention-detail">{detail}</span>}
    </button>
  );
}
