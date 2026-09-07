import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { formatCurrency, formatMoney, debounce } from '../lib/utils';

/**
 * The two numbers that price the whole international catalogue.
 *
 * Nothing here is a per-template price. Admins keep maintaining the INR price on
 * each template; the dollar price is derived from it as
 * `INR / usdInrRate * multiplier`, rounded up to the next whole $10 minus a
 * cent. Changing either number below repositions every template at once, which
 * is why this page insists on showing what it would do before it does it.
 *
 * The preview is not decoration. Because prices round to a $10 tier, most rate
 * edits change nothing at all — every rate from 90 to 99 leaves a INR 2,999
 * template at $99.99 — and then one rupee further moves it a whole tier. Without
 * the before/after table there is no way to tell those two cases apart.
 */
export default function PricingSettings() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(null);

  const [usdInrRate, setUsdInrRate] = useState('');
  const [multiplier, setMultiplier] = useState('');

  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.settings.getPricing();
      const d = res.data || {};
      setCurrent(d);
      setUsdInrRate(String(d.usdInrRate ?? ''));
      setMultiplier(String(d.defaultMarkupMultiplier ?? ''));
    } catch (err) {
      toast(err.message || 'Failed to load pricing settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // Debounced so typing a rate does not fire a query per keystroke; the preview
  // reads the whole active catalogue.
  const runPreview = useRef(
    debounce(async (rate, mult) => {
      if (!rate || !mult) return;
      setPreviewing(true);
      setPreviewError('');
      try {
        const res = await api.settings.previewPricing({
          usdInrRate: rate,
          defaultMarkupMultiplier: mult,
        });
        setPreview(res.data);
      } catch (err) {
        setPreview(null);
        setPreviewError(err.message || 'Could not preview these values');
      } finally {
        setPreviewing(false);
      }
    }, 400)
  ).current;

  useEffect(() => {
    if (!loading) runPreview(usdInrRate, multiplier);
  }, [usdInrRate, multiplier, loading, runPreview]);

  const dirty = current && (
    String(current.usdInrRate) !== String(usdInrRate) ||
    String(current.defaultMarkupMultiplier) !== String(multiplier)
  );
  const changedCount = preview ? preview.changedCount : 0;

  async function save(e) {
    e.preventDefault();
    if (changedCount > 0 && !window.confirm(
      `This changes the international price of ${changedCount} template${changedCount === 1 ? '' : 's'}. ` +
      `Prices move a full $10 tier at a time. Continue?`
    )) return;

    setSaving(true);
    try {
      const res = await api.settings.updatePricing({
        usdInrRate: Number(usdInrRate),
        defaultMarkupMultiplier: Number(multiplier),
      });
      setCurrent(res.data);
      toast('Pricing updated — the storefront picks this up immediately', 'success');
    } catch (err) {
      toast(err.message || 'Failed to save pricing settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="empty-state"><div className="empty-text">Loading pricing settings…</div></div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Pricing Settings</h1>
          <p className="page-subtitle">
            One USD rate and one default multiplier price every template on aamantranglobal.com
          </p>
        </div>
      </div>

      {current?.usingFallback && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--rose, #e05260)' }}>
          <div className="card-body">
            <strong>These values are not saved yet.</strong> The storefront is running on built-in
            fallbacks. Save below to store them.
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Global pricing inputs</span></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">USD rate (₹ per $1)</label>
                <input
                  className="form-input"
                  type="number" min="1" max="1000" step="0.01"
                  value={usdInrRate}
                  onChange={e => setUsdInrRate(e.target.value)}
                  required
                />
                <p className="form-hint">Your reference rate, not a live feed. Update it when you choose to.</p>
              </div>

              <div className="form-group">
                <label className="form-label">Default multiplier</label>
                <input
                  className="form-input"
                  type="number" min="0.1" max="20" step="0.01"
                  value={multiplier}
                  onChange={e => setMultiplier(e.target.value)}
                  required
                />
                <p className="form-hint">
                  Applied to every template without its own multiplier. A straight conversion
                  (1.0) would sell abroad at the India price.
                </p>
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button variant="primary" type="submit" loading={saving} disabled={saving || !dirty}>
                  {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
                </Button>
              </div>
            </div>

            <p className="form-hint" style={{ marginTop: 4 }}>
              USD price = INR price ÷ rate × multiplier, rounded up to the next $10 minus a cent.
              Existing orders are never repriced — each one stores the rate and multiplier it was
              sold at.
            </p>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {dirty ? 'What this change would do' : 'Current international prices'}
          </span>
          <span className="card-title" style={{ opacity: 0.7, fontWeight: 400 }}>
            {previewing ? 'calculating…'
              : preview ? (changedCount === 0
                  ? 'no prices change'
                  : `${changedCount} of ${preview.templates.length} change`)
              : ''}
          </span>
        </div>
        <div className="card-body">
          {previewError && <div className="empty-state"><div className="empty-text">{previewError}</div></div>}

          {!previewError && preview && preview.templates.length === 0 && (
            <div className="empty-state"><div className="empty-text">No active templates to price</div></div>
          )}

          {!previewError && preview && preview.templates.length > 0 && (
            <>
              {dirty && changedCount === 0 && (
                <p className="form-hint" style={{ marginBottom: 12 }}>
                  Nothing moves at these values. Prices sit on $10 tiers, so ordinary rate
                  changes are absorbed without any price shifting.
                </p>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Template</th>
                      <th>India price</th>
                      <th>Multiplier</th>
                      <th>{dirty ? 'USD now' : 'USD price'}</th>
                      {dirty && <th>USD after</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.templates.map(t => (
                      <tr key={t.id}>
                        <td className="td-primary">{t.name}</td>
                        <td>{formatCurrency(t.price)}</td>
                        <td>
                          {t.usesDefaultMultiplier
                            ? <span style={{ opacity: 0.6 }}>default</span>
                            : Number(t.markupMultiplier)}
                        </td>
                        <td>{formatMoney(t.priceUsdBefore, 'USD')}</td>
                        {dirty && (
                          <td style={t.changed ? { fontWeight: 700 } : { opacity: 0.6 }}>
                            {formatMoney(t.priceUsdAfter, 'USD')}
                            {t.changed && (
                              <span style={{ marginLeft: 6, fontSize: '0.85em' }}>
                                {t.priceUsdAfter > t.priceUsdBefore ? '▲' : '▼'}
                              </span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
