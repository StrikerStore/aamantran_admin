import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function Transactions() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [txs,     setTxs]     = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState('');
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => { setTopbarTitle('Transactions'); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.transactions.list({ status: status || undefined, page, limit: 20 });
      setTxs(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [status, page, toast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{total} transaction{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : txs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <div className="empty-text">No transactions found</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Template</th>
                <th>Invitation</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {txs.map(tx => (
                <tr key={tx.id} className="clickable" onClick={() => navigate(`/transactions/${tx.id}`)}>
                  <td>
                    <div className="td-primary">{tx.user?.username || '—'}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{tx.user?.email}</div>
                  </td>
                  <td>{tx.template?.name || '—'}</td>
                  <td>
                    {tx.event
                      ? <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>/{tx.event.slug}</span>
                      : '—'}
                  </td>
                  <td className="td-primary">{formatCurrency(tx.amount)}</td>
                  <td><Badge status={tx.status} /></td>
                  <td>{formatDate(tx.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Pagination total={total} page={page} limit={20} onPageChange={setPage} />
      </div>
    </div>
  );
}
