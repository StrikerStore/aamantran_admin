import { useCallback, useEffect, useState, useRef } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { Pagination } from '../components/ui/Pagination';
import { formatMoney } from '../lib/utils';

const PAGE_SIZE = 20;

export default function Coupons() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);
  const [coupons, setCoupons] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxGlobalUses, setMaxGlobalUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [isDisplayed, setIsDisplayed] = useState(false);
  const [storefront, setStorefront] = useState('IN');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.coupons.list({ page, limit: PAGE_SIZE });
      setCoupons(res.data || []);
      setTotal(res.total ?? (res.data || []).length);
    } catch (err) {
      toast(err.message || 'Failed to load coupons', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadedOnce.current = true;
    }
  }, [toast, page]);

  useEffect(() => { load(); }, [load]);

  async function createCoupon(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.coupons.create({
        code: code.trim().toUpperCase(),
        discountPercent: Number(discountPercent),
        expiresAt: expiresAt || null,
        maxGlobalUses: maxGlobalUses || null,
        maxUsesPerUser: maxUsesPerUser || null,
        minOrderAmount: minOrderAmount || 0,
        isDisplayed,
        storefront,
      });
      setCode('');
      setDiscountPercent('');
      setExpiresAt('');
      setMaxGlobalUses('');
      setMaxUsesPerUser('');
      setMinOrderAmount('');
      setIsDisplayed(false);
      setStorefront('IN');
      toast('Coupon created', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Failed to create coupon', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c) {
    try {
      await api.coupons.update(c.id, { isActive: !c.isActive });
      // Disabling also unpublishes server-side, so a coupon can never be
      // advertised on checkout while the apply step would refuse it.
      toast(
        c.isActive
          ? (c.isDisplayed ? 'Coupon disabled and removed from checkout' : 'Coupon deactivated')
          : 'Coupon activated',
        'info',
      );
      load();
    } catch (err) {
      toast(err.message || 'Failed to update coupon', 'error');
    }
  }

  async function toggleDisplayed(c) {
    if (!c.isDisplayed && !window.confirm(
      `Show "${c.code}" on the checkout page? Every visitor buying an eligible template will see this code.`
    )) return;
    try {
      await api.coupons.update(c.id, { isDisplayed: !c.isDisplayed });
      toast(c.isDisplayed ? 'Removed from checkout' : 'Now shown on checkout', 'info');
      load();
    } catch (err) {
      toast(err.message || 'Failed to update coupon', 'error');
    }
  }

  async function changeStorefront(c, storefront) {
    if (storefront === (c.storefront || 'IN')) return;
    try {
      await api.coupons.update(c.id, { storefront });
      toast(`"${c.code}" now applies to ${storefront === 'BOTH' ? 'both storefronts' : storefront === 'INTL' ? 'the international site' : 'India'}`, 'info');
      load();
    } catch (err) {
      toast(err.message || 'Failed to update coupon', 'error');
    }
  }

  async function deleteCoupon(c) {
    if (!window.confirm(`Delete coupon "${c.code}"?`)) return;
    try {
      await api.coupons.remove(c.id);
      toast('Coupon deleted', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Failed to delete coupon', 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Coupons</h1>
          <p className="page-subtitle">Manage coupon codes before support</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Create coupon</span></div>
        <div className="card-body">
          <form className="form-row-3" onSubmit={createCoupon}>
            <div className="form-group">
              <label className="form-label">Coupon Code</label>
              <input className="form-input" value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" required />
            </div>
            <div className="form-group">
              <label className="form-label">Storefront</label>
              <Select className="form-select" value={storefront} onChange={e => setStorefront(e.target.value)}>
                <option value="IN">India only (₹)</option>
                <option value="INTL">International only ($)</option>
                <option value="BOTH">Both</option>
              </Select>
              <p className="form-hint">
                Minimum order is read in that storefront&apos;s own currency, so a code meant
                for rupees must not be let loose on dollar orders.
              </p>
            </div>
            <div className="form-group">
              <label className="form-label">Discount %</label>
              <input className="form-input" type="number" min="1" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} placeholder="10" required />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry Date (optional)</label>
              <input className="form-input" type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Global Usage Limit (optional)</label>
              <input className="form-input" type="number" min="1" value={maxGlobalUses} onChange={e => setMaxGlobalUses(e.target.value)} placeholder="e.g. 100" />
            </div>
            <div className="form-group">
              <label className="form-label">Per-user Limit (optional)</label>
              <input className="form-input" type="number" min="1" value={maxUsesPerUser} onChange={e => setMaxUsesPerUser(e.target.value)} placeholder="e.g. 1" />
            </div>
            <div className="form-group">
              <label className="form-label">Minimum Order ({storefront === 'INTL' ? 'USD' : 'INR'})</label>
              <input className="form-input" type="number" min="0" value={minOrderAmount} onChange={e => setMinOrderAmount(e.target.value)} placeholder="e.g. 999" />
            </div>
            <div className="form-group">
              <label className="form-label">Show on checkout</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.86rem', color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={isDisplayed} onChange={e => setIsDisplayed(e.target.checked)} />
                Advertise publicly
              </label>
              <p style={{ margin: '5px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Off = the code still works when typed, it just is not shown.
              </p>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
              <Button variant="primary" type="submit" loading={saving}>Add Coupon</Button>
            </div>
          </form>
        </div>
      </div>

      {refreshing && <div className="refresh-bar" />}
      <div className={`table-container${refreshing ? ' is-refreshing' : ''}`}>
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Storefront</th>
                <th>Discount</th>
                <th>Expiry</th>
                <th>Limits</th>
                <th>Min Order</th>
                <th>Status</th>
                <th>Checkout</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id}>
                  <td className="td-primary">{c.code}</td>
                  <td>
                    <Select
                      className="form-select"
                      value={c.storefront || 'IN'}
                      onChange={e => changeStorefront(c, e.target.value)}
                    >
                      <option value="IN">India</option>
                      <option value="INTL">International</option>
                      <option value="BOTH">Both</option>
                    </Select>
                  </td>
                  <td>{c.discountPercent}%</td>
                  <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleString('en-IN') : 'No expiry'}</td>
                  <td>
                    G: {c.maxGlobalUses ?? '∞'} / U: {c.maxUsesPerUser ?? '∞'}
                  </td>
                  {/* Minimum is denominated in the coupon's OWN storefront
                      currency, so an INTL code's figure is dollars, not rupees. */}
                  <td>{formatMoney(c.minOrderAmount || 0, c.storefront === 'INTL' ? 'USD' : 'INR')}</td>
                  <td>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td>
                    <span style={{
                      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
                      color: c.isDisplayed ? 'var(--success, #2e7d4f)' : 'var(--text-muted)',
                    }}>
                      {c.isDisplayed ? 'SHOWN' : 'Hidden'}
                    </span>
                  </td>
                  <td>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                        {c.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!c.isActive && !c.isDisplayed}
                        title={!c.isActive ? 'Enable the coupon before showing it on checkout' : ''}
                        onClick={() => toggleDisplayed(c)}
                      >
                        {c.isDisplayed ? 'Unpublish' : 'Show'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteCoupon(c)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr><td colSpan={10} style={{ color: 'var(--text-muted)' }}>No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Pagination total={total} page={page} limit={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
