import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { formatRelative } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';

export default function Tickets() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [tickets, setTickets] = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [status,  setStatus]  = useState('open');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.tickets.list({ status: status || undefined, page, limit: 20 });
      setTickets(res.data);
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
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-subtitle">{total} ticket{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <Select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="">All</option>
        </Select>
      </div>

      {refreshing && <div className="refresh-bar" />}
      <div className={`table-container${refreshing ? ' is-refreshing' : ''}`}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📬</div>
            <div className="empty-text">No tickets found</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>User</th>
                <th>Invitation</th>
                <th>Messages</th>
                <th>Status</th>
                <th>Last update</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/tickets/${t.id}`)}>
                  <td className="td-primary">{t.subject}</td>
                  <td>
                    <div>{t.user?.username || '—'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.user?.email}</div>
                  </td>
                  <td>
                    {t.event
                      ? <span className="mono" style={{ fontSize: '0.8rem' }}>/{t.event.slug}</span>
                      : '—'}
                  </td>
                  <td>{t._count?.messages ?? 0}</td>
                  <td><Badge status={t.status} /></td>
                  <td>{formatRelative(t.updatedAt)}</td>
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
