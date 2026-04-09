import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function Coupons() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [code, setCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [maxGlobalUses, setMaxGlobalUses] = useState('');
  const [maxUsesPerUser, setMaxUsesPerUser] = useState('');
  const [minOrderAmount, setMinOrderAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useLayoutEffect(() => { setTopbarTitle('Coupons'); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.coupons.list();
      setCoupons(res.data || []);
    } catch (err) {
      toast(err.message || 'Failed to load coupons', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      });
      setCode('');
      setDiscountPercent('');
      setExpiresAt('');
      setMaxGlobalUses('');
      setMaxUsesPerUser('');
      setMinOrderAmount('');
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
      toast(c.isActive ? 'Coupon deactivated' : 'Coupon activated', 'info');
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
              <label className="form-label">Minimum Order (INR)</label>
              <input className="form-input" type="number" min="0" value={minOrderAmount} onChange={e => setMinOrderAmount(e.target.value)} placeholder="e.g. 999" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
              <Button variant="primary" type="submit" loading={saving}>Add Coupon</Button>
            </div>
          </form>
        </div>
      </div>

      <div className="table-container">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Expiry</th>
                <th>Limits</th>
                <th>Min Order</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map(c => (
                <tr key={c.id}>
                  <td className="td-primary">{c.code}</td>
                  <td>{c.discountPercent}%</td>
                  <td>{c.expiresAt ? new Date(c.expiresAt).toLocaleString('en-IN') : 'No expiry'}</td>
                  <td>
                    G: {c.maxGlobalUses ?? '∞'} / U: {c.maxUsesPerUser ?? '∞'}
                  </td>
                  <td>INR {((c.minOrderAmount || 0) / 100).toLocaleString('en-IN')}</td>
                  <td>{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString('en-IN')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(c)}>
                        {c.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteCoupon(c)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr><td colSpan={9} style={{ color: 'var(--text-muted)' }}>No coupons yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
