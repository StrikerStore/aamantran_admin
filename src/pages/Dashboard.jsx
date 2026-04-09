import { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Badge } from '../components/ui/Badge';

function setTopbarTitle(title) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = title;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => { setTopbarTitle('Overview'); }, []);

  useEffect(() => {
    Promise.all([
      api.templates.list({ limit: 1 }),
      api.users.list({ limit: 5 }),
      api.transactions.list({ limit: 5 }),
      api.tickets.list({ status: 'open', limit: 1 }),
      api.transactions.list({ status: 'paid', limit: 1 }),
    ]).then(([tplRes, usersRes, txRes, ticketsRes, paidRes]) => {
      setStats({
        templates:    tplRes.total,
        users:        usersRes.total,
        openTickets:  ticketsRes.total,
        totalPaid:    paidRes.total,
        recentUsers:  usersRes.data,
        recentTx:     txRes.data,
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="spinner-wrap"><div className="spinner" /></div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Platform at a glance</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Templates" value={stats?.templates ?? '—'} accent="var(--gold)" />
        <StatCard label="Registered Users" value={stats?.users ?? '—'} accent="var(--blue)" />
        <StatCard label="Paid Transactions" value={stats?.totalPaid ?? '—'} accent="var(--green)" />
        <StatCard label="Open Tickets" value={stats?.openTickets ?? '—'} accent="var(--red)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
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
                {stats?.recentUsers?.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No users yet</div></div></td></tr>
                )}
                {stats?.recentUsers?.map(u => (
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
                {stats?.recentTx?.length === 0 && (
                  <tr><td colSpan={3}><div className="empty-state"><div className="empty-text">No transactions yet</div></div></td></tr>
                )}
                {stats?.recentTx?.map(tx => (
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
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-accent" style={{ background: accent }} />
    </div>
  );
}
