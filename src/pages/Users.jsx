import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { formatDate } from '../lib/utils';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';
import { useDebounced } from '../lib/useDebounced';

export default function Users() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [users,      setUsers]      = useState([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);  // first load only
  const [refreshing, setRefreshing] = useState(false); // subsequent fetches
  const loadedOnce = useRef(false);

  // Only the search term is debounced; page changes fire immediately.
  const debouncedSearch = useDebounced(search, 320);

  useEffect(() => {
    const ctrl = new AbortController();
    if (loadedOnce.current) setRefreshing(true);

    api.users
      .list({ search: debouncedSearch || undefined, page, limit: 20 }, { signal: ctrl.signal })
      .then((res) => {
        setUsers(res.data);
        setTotal(res.total);
        loadedOnce.current = true;
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return; // superseded by a newer query
        toast(err.message, 'error');
        setLoading(false);
      })
      .finally(() => setRefreshing(false));

    // Cancel in flight when the query changes or the page unmounts, so a slow
    // early response can never overwrite a newer one.
    return () => ctrl.abort();
  }, [debouncedSearch, page, toast]);

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

      {/* Table — rows stay on screen while a new query loads */}
      {refreshing && <div className="refresh-bar" />}
      <div className={`table-container${refreshing ? ' is-refreshing' : ''}`}>
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
