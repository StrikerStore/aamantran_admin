import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { formatDate, formatMoney, debounce } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { Modal } from '../components/ui/Modal';
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

/**
 * The last complete calendar month, in IST — which is the month being filed
 * nearly every time this dialog is opened, so it is what the dates start on.
 * IST because that is the month the return covers; the server reads the same
 * two dates the same way.
 */
const IST_OFFSET_MS = 330 * 60 * 1000;

function lastCompleteMonthIst(now = new Date()) {
  const t = new Date(now.getTime() + IST_OFFSET_MS);
  const year = t.getUTCFullYear();
  const month = t.getUTCMonth();
  const py = month === 0 ? year - 1 : year;
  const pm = month === 0 ? 11 : month - 1;
  const lastDay = new Date(Date.UTC(py, pm + 1, 0)).getUTCDate();
  const pad = (n) => String(n).padStart(2, '0');
  return { from: `${py}-${pad(pm + 1)}-01`, to: `${py}-${pad(pm + 1)}-${pad(lastDay)}` };
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
  const [gstOpen,  setGstOpen]  = useState(false);
  const [gstRange, setGstRange] = useState(lastCompleteMonthIst);
  const [gstBusy,  setGstBusy]  = useState(false);
  const [gstError, setGstError] = useState('');
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

  // Checked here as well as on the server, so an impossible range is refused
  // before it costs a round trip — not instead of the server checking it.
  const gstInvalid =
    !gstRange.from || !gstRange.to
      ? 'Pick both dates.'
      : gstRange.from > gstRange.to
        ? 'The "from" date must not be after the "to" date.'
        : (Date.parse(gstRange.to) - Date.parse(gstRange.from)) / 86400000 > 365
          ? 'Ask for a year or less at a time.'
          : '';

  function openGstDialog() {
    setGstError('');
    setGstRange(lastCompleteMonthIst());
    setGstOpen(true);
  }

  const setGst = (key) => (e) => {
    setGstError('');
    setGstRange((r) => ({ ...r, [key]: e.target.value }));
  };

  async function downloadGstReport() {
    setGstBusy(true);
    setGstError('');
    try {
      await api.transactions.gstReport(gstRange);
      setGstOpen(false);
      toast('GST report downloaded', 'success');
    } catch (err) {
      // Left open on purpose: the answer is almost always a shorter range, and
      // closing the dialog would make the admin set the dates again to retry.
      setGstError(err.message || 'Could not build the GST report');
    } finally {
      setGstBusy(false);
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
          {/*
            * Not disabled on an empty table: this report has its own date range
            * and covers India orders whatever the filters above are showing.
            */}
          <Button variant="secondary" onClick={openGstDialog}>GST report</Button>
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

      {gstOpen && (
        <Modal
          title="GST report"
          onClose={() => { if (!gstBusy) setGstOpen(false); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setGstOpen(false)} disabled={gstBusy}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={downloadGstReport}
                disabled={gstBusy || Boolean(gstInvalid)}
              >
                {gstBusy ? 'Preparing…' : 'Download .xlsx'}
              </button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="gst-from">From</label>
              <input
                id="gst-from"
                className="form-input"
                type="date"
                value={gstRange.from}
                max={gstRange.to || undefined}
                onChange={setGst('from')}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="gst-to">To</label>
              <input
                id="gst-to"
                className="form-input"
                type="date"
                value={gstRange.to}
                min={gstRange.from || undefined}
                onChange={setGst('to')}
              />
            </div>
          </div>

          <p className="form-hint">
            Both dates are included, and read in IST. India (₹) orders only — the global
            storefront is an export of services, zero-rated, and is not in this file.
          </p>

          {/*
            * One child: .alert is a flex row meant for an icon beside a line of
            * text, so inline <strong>s would each become a column of their own.
            */}
          <div className="alert alert-info" style={{ marginTop: 12, marginBottom: 0 }}>
            <span>
              Two sheets: <strong>revenue</strong> (orders sold in this range, including ones
              refunded later) and <strong>refund</strong> (refunds made in this range).
              Tax appears as one <strong>IGST</strong> line — no customer state is on file, so
              it cannot be split into CGST and SGST for a buyer in MP.
            </span>
          </div>

          {(gstError || gstInvalid) && (
            <div className="alert alert-warning" style={{ marginTop: 12, marginBottom: 0 }}>
              <span>{gstError || gstInvalid}</span>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
