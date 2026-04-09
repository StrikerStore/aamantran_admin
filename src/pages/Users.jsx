import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate, debounce } from '../lib/utils';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function Users() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [users,   setUsers]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => { setTopbarTitle('Users'); }, []);

  const load = useCallback(async (q, p) => {
    setLoading(true);
    try {
      const res = await api.users.list({ search: q || undefined, page: p, limit: 20 });
      setUsers(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((q, p) => load(q, p), 320), [load]);

  useEffect(() => {
    debouncedSearch(search, page);
  }, [search, page, debouncedSearch]);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{total} registered couple{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search */}
      <div className="filters-bar">
        <div className="search-wrap">
          <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="search-input"
            placeholder="Search by username, email, or phone…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-text">No users found</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Events</th>
                <th>Payments</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="clickable" onClick={() => navigate(`/users/${u.id}`)}>
                  <td className="td-primary" style={{ fontSize: '0.88rem' }}>{u.username || '—'}</td>
                  <td>
                    <div className="td-primary">{u.email}</div>
                  </td>
                  <td>{u.phone || '—'}</td>
                  <td>{u._count?.events ?? 0}</td>
                  <td>{u._count?.payments ?? 0}</td>
                  <td>{formatDate(u.createdAt)}</td>
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
