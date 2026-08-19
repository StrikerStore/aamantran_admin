import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Badge } from '../components/ui/Badge';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({});
  const [failed, setFailed] = useState(false);

  // Each card resolves on its own rather than the page blocking on Promise.all,
  // so the first number appears as soon as its request lands. Failures used to
  // be swallowed by `.catch(() => {})`, leaving a dashboard of em-dashes with no
  // explanation; now they surface a banner.
  useEffect(() => {
    let alive = true;
    const merge = (patch) => { if (alive) setStats((s) => ({ ...s, ...patch })); };
    const onFail = () => { if (alive) setFailed(true); };

    api.templates.list({ limit: 1 })
      .then((r) => merge({ templates: r.total })).catch(onFail);
    api.users.list({ limit: 5 })
      .then((r) => merge({ users: r.total, recentUsers: r.data })).catch(onFail);
    api.transactions.list({ limit: 5 })
      .then((r) => merge({ recentTx: r.data })).catch(onFail);
    api.tickets.list({ status: 'open', limit: 1 })
      .then((r) => merge({ openTickets: r.total })).catch(onFail);
    api.transactions.list({ status: 'paid', limit: 1 })
      .then((r) => merge({ totalPaid: r.total })).catch(onFail);

    return () => { alive = false; };
  }, []);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Platform at a glance</p>
        </div>
      </div>

      {failed && (
        <div className="dash-error" role="alert">
          Some dashboard data could not be loaded. Figures shown may be incomplete.
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Templates" value={stats.templates} accent="var(--lav)" />
        <StatCard label="Registered Users" value={stats.users} accent="var(--sky)" />
        <StatCard label="Paid Transactions" value={stats.totalPaid} accent="var(--mint)" />
        <StatCard label="Open Tickets" value={stats.openTickets} accent="var(--rose)" />
      </div>

      <div className="dash-grid">
        {/* Recent users */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Users</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/users')}>
              View all →
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Username / Email</th>
                  <th>Events</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentUsers === undefined && (
                  <tr><td colSpan={3}><div className="spinner-wrap" style={{ padding: 24 }}><div className="spinner" /></div></td></tr>
                )}
                {stats.recentUsers?.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No users yet</div></div></td></tr>
                )}
                {stats.recentUsers?.map(u => (
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

        {/* Recent transactions */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Transactions</span>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/transactions')}>
              View all →
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentTx === undefined && (
                  <tr><td colSpan={3}><div className="spinner-wrap" style={{ padding: 24 }}><div className="spinner" /></div></td></tr>
                )}
                {stats.recentTx?.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No transactions yet</div></div></td></tr>
                )}
                {stats.recentTx?.map(tx => (
                  <tr key={tx.id} className="clickable" onClick={() => navigate(`/transactions/${tx.id}`)}>
                    <td>
                      <div className="td-primary">{tx.user?.username || tx.user?.email || '—'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tx.template?.name}</div>
                    </td>
                    <td>{formatCurrency(tx.amount)}</td>
                    <td><Badge status={tx.status} /></td>
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

function StatCard({ label, value, accent }) {
  const pending = value === undefined;
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value${pending ? ' stat-value-pending' : ''}`}>
        {pending ? '—' : value}
      </div>
      <div className="stat-accent" style={{ background: accent }} />
    </div>
  );
}
