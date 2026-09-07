import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { formatCurrency, formatDate, formatMoney } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';

export default function Transactions() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [txs,     setTxs]     = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.transactions.list({ status: status || undefined, page, limit: 20 });
      setTxs(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadedOnce.current = true;
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
        <Select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
      </div>

      {refreshing && <div className="refresh-bar" />}
      <div className={`table-container${refreshing ? ' is-refreshing' : ''}`}>
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
                <th>Order ID</th>
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
                    <span style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{tx.orderId || '—'}</span>
                  </td>
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
                  <td className="td-primary">{formatMoney(tx.amount, tx.currency)}</td>
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
