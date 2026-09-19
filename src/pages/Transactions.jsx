import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { formatDate, formatMoney, debounce } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../components/ui/Toast';

/**
 * Orders, and what came of them.
 *
 * This page had one dropdown — status — which meant finding a specific order
 * involved paging through everything. The filters here are the ones someone
 * actually arrives with: a customer emails an order id, a bank statement shows a
 * gateway reference, a question is about "last week on the global site".
 *
 * The totals are per currency and never combined. Payment.amount is in minor
 * units of its own currency, so a single "total revenue" figure across rupees
 * and dollars would be arithmetic nonsense presented as fact.
 *
 * Export takes the filters as they stand, so the CSV always matches the table
 * above it.
 */

const EMPTY_FILTERS = { q: '', status: '', storefront: '', gateway: '', currency: '', from: '', to: '' };

/**
 * Filters the page was opened with.
 *
 * The dashboard links here already narrowed — "3 orders stuck pending" goes to
 * the pending ones — so the address has to be able to say so, or those links
 * land on an unfiltered list and the count stops meaning anything.
 */
function filtersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const next = { ...EMPTY_FILTERS };
  for (const key of Object.keys(EMPTY_FILTERS)) {
    const value = params.get(key);
    if (value) next[key] = value;
  }
  return next;
}

export default function Transactions() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [txs,     setTxs]     = useState([]);
  const [total,   setTotal]   = useState(0);
  const [totals,  setTotals]  = useState([]);
  const [page,    setPage]    = useState(1);
  const [filters, setFilters] = useState(filtersFromUrl);
  // `q` is typed, so the request it drives is debounced while the input is not.
  const [queryText, setQueryText] = useState(() => filtersFromUrl().q);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const loadedOnce = useRef(false);

  const applyQuery = useMemo(
    () => debounce((value) => { setFilters((f) => ({ ...f, q: value })); setPage(1); }, 350),
    [],
  );

  const load = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.transactions.list({ ...filters, page, limit: 20 });
      setTxs(res.data);
      setTotal(res.total);
      setTotals(res.totals || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadedOnce.current = true;
    }
  }, [filters, page, toast]);

  useEffect(() => { load(); }, [load]);

  const set = (key) => (e) => { setFilters((f) => ({ ...f, [key]: e.target.value })); setPage(1); };
  const filtered = Object.entries(filters).some(([, v]) => v !== '');

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setQueryText('');
    setPage(1);
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await api.transactions.exportCsv(filters);
      toast('Export downloaded', 'success');
    } catch (err) {
      toast(err.message || 'Could not export these transactions', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">
            {total} transaction{total !== 1 ? 's' : ''}{filtered ? ' matching these filters' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {filtered && (
            <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>
          )}
          <Button variant="secondary" onClick={exportCsv} loading={exporting} disabled={exporting || total === 0}>
            {exporting ? 'Preparing…' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Money taken, per currency. Never one number — see the note above. */}
      {totals.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 20 }}>
          {totals.map((t) => (
            <div className="stat-card" key={t.currency}>
              <div className="stat-label">
                Received ({t.currency}){filtered ? ' · filtered' : ''}
              </div>
              <div className="stat-value">{formatMoney(t.paidAmount, t.currency)}</div>
              <div className="stat-sub">
                {t.paidOrders} paid
                {t.refundedOrders > 0 && (
                  <> · {t.refundedOrders} refunded ({formatMoney(t.refundedAmount, t.currency)})</>
                )}
              </div>
              <div className="stat-accent" style={{ background: t.currency === 'USD' ? 'var(--sky)' : 'var(--mint)' }} />
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="filters-bar">
        <input
          className="form-input filter-search"
          type="search"
          value={queryText}
          placeholder="Order ID, email, username, invitation or gateway reference"
          aria-label="Search transactions"
          onChange={(e) => { setQueryText(e.target.value); applyQuery(e.target.value.trim()); }}
        />
        <Select className="filter-select" value={filters.status} onChange={set('status')} aria-label="Status">
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </Select>
        <Select className="filter-select" value={filters.storefront} onChange={set('storefront')} aria-label="Storefront">
          <option value="">Both sites</option>
          <option value="IN">India</option>
          <option value="INTL">Global</option>
        </Select>
        <Select className="filter-select" value={filters.gateway} onChange={set('gateway')} aria-label="Gateway">
          <option value="">Any gateway</option>
          <option value="payu">PayU</option>
          <option value="razorpay">Razorpay</option>
        </Select>
        <Select className="filter-select" value={filters.currency} onChange={set('currency')} aria-label="Currency">
          <option value="">Any currency</option>
          <option value="INR">₹ INR</option>
          <option value="USD">$ USD</option>
        </Select>
        <input
          className="form-input filter-date"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          aria-label="From date"
          onChange={set('from')}
        />
        <input
          className="form-input filter-date"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          aria-label="To date"
          onChange={set('to')}
        />
      </div>

      {refreshing && <div className="refresh-bar" />}
      <div className={`table-container${refreshing ? ' is-refreshing' : ''}`}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : txs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">💳</div>
            <div className="empty-text">
              {filtered ? 'No transactions match these filters' : 'No transactions found'}
            </div>
            {filtered && <Button variant="ghost" onClick={clearFilters}>Clear filters</Button>}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>User</th>
                <th>Template</th>
                <th>Site</th>
                <th>Gateway</th>
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
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {tx.user?.email || tx.customerEmail || ''}
                    </div>
                  </td>
                  <td>
                    <div>{tx.template?.name || '—'}</div>
                    {tx.event && (
                      <div style={{ fontFamily: 'monospace', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        /{tx.event.slug}
                      </div>
                    )}
                  </td>
                  <td>{tx.storefront === 'INTL' ? 'Global' : 'India'}</td>
                  <td>{tx.gateway === 'razorpay' ? 'Razorpay' : 'PayU'}</td>
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
