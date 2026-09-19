import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

/**
 * Which gateway each storefront charges through.
 *
 * India has both a PayU merchant account and a Razorpay account; the global site
 * has Razorpay only, because PayU never issued an international account. Either
 * site can be pointed at either gateway — but only at one it actually has
 * credentials for, which is why an option can be shown greyed out with the env
 * vars that would enable it.
 *
 * Two things this page has to say plainly, because neither is guessable:
 *   * changing this affects NEW orders only — an order already taken keeps its
 *     own gateway, and its refunds go back the way the money came;
 *   * the server caches the setting for up to a minute per instance, so a
 *     change is not always instant on every server.
 */

const SITES = {
  IN: { title: 'India — aamantran.online', note: 'Charges in ₹, with GST.' },
  INTL: { title: 'Global — aamantranglobal.com', note: 'Charges in $, no GST (export of services).' },
};

const GATEWAY_LABEL = { payu: 'PayU', razorpay: 'Razorpay' };

export default function PaymentSettings() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');   // the storefront being saved
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.settings.getGateway();
      setData(res.data);
    } catch (err) {
      toast(err.message || 'Failed to load payment settings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function choose(storefront, gateway) {
    if (saving) return;
    const site = data.storefronts.find(s => s.storefront === storefront);
    if (site.chosen === gateway) return;

    if (!window.confirm(
      `Charge ${storefront === 'INTL' ? 'aamantranglobal.com' : 'aamantran.online'} through ` +
      `${GATEWAY_LABEL[gateway]} from now on?\n\n` +
      `New orders only. Orders already placed keep their own gateway, including for refunds.`
    )) return;

    setSaving(storefront);
    try {
      const res = await api.settings.updateGateway({ storefront, gateway });
      setData(res.data);
      toast(`${storefront === 'INTL' ? 'Global site' : 'India'} now charges through ${GATEWAY_LABEL[gateway]}`, 'success');
    } catch (err) {
      toast(err.message || 'Could not change the gateway', 'error');
    } finally {
      setSaving('');
    }
  }

  if (loading) {
    return <div className="empty-state"><div className="empty-text">Loading payment settings…</div></div>;
  }
  if (!data) {
    return (
      <div className="empty-state">
        <div className="empty-text">Could not load payment settings</div>
        <Button variant="secondary" onClick={load}>Try again</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Payment Settings</h1>
          <p className="page-subtitle">
            Which gateway takes the money on each storefront
          </p>
        </div>
      </div>

      {data.storefronts.map(site => (
        <div className="card" style={{ marginBottom: 20 }} key={site.storefront}>
          <div className="card-header">
            <span className="card-title">{SITES[site.storefront].title}</span>
            <span className="card-title" style={{ opacity: 0.7, fontWeight: 400 }}>
              {SITES[site.storefront].note}
            </span>
          </div>
          <div className="card-body">
            {!site.configured && (
              <div style={{ marginBottom: 14, padding: '10px 12px', borderLeft: '3px solid var(--rose, #e05260)', background: 'rgba(224,82,96,0.06)' }}>
                <strong>Orders on this site are being refused.</strong>{' '}
                {GATEWAY_LABEL[site.chosen]} is selected but not configured on the server
                {site.missing ? <> — set <code>{site.missing}</code></> : null}. Nothing is
                sent to the other gateway instead: an order settles where you chose, or not at all.
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {site.options.map(option => {
                const active = site.chosen === option.gateway;
                return (
                  <button
                    type="button"
                    key={option.gateway}
                    onClick={() => option.configured && choose(site.storefront, option.gateway)}
                    disabled={!option.configured || saving === site.storefront}
                    aria-pressed={active}
                    style={{
                      flex: '1 1 220px',
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: 10,
                      cursor: option.configured ? 'pointer' : 'not-allowed',
                      border: active ? '2px solid var(--gold, #b8860b)' : '1px solid var(--border, #e5e0d8)',
                      background: active ? 'rgba(184,134,11,0.07)' : 'transparent',
                      opacity: option.configured ? 1 : 0.55,
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>
                      {GATEWAY_LABEL[option.gateway]}
                      {active && <span style={{ marginLeft: 8, fontWeight: 500, fontSize: '0.85em' }}>· in use</span>}
                      {site.isDefault && active && <span style={{ marginLeft: 6, opacity: 0.6, fontWeight: 400, fontSize: '0.8em' }}>(default)</span>}
                    </div>
                    <div style={{ fontSize: '0.85em', opacity: 0.75 }}>
                      {option.configured
                        ? (option.gateway === 'razorpay'
                            ? 'Cards, UPI and net banking. The only gateway that can take international cards.'
                            : 'Cards, UPI and net banking on the India merchant account.')
                        : <>Not configured — set <code>{option.missing}</code></>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <div className="card">
        <div className="card-header"><span className="card-title">What changing this does</span></div>
        <div className="card-body">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li><strong>New orders only.</strong> Every order stores the gateway that took it, and its refund goes back the same way. Nothing already sold is affected.</li>
            <li><strong>It can take up to a minute.</strong> Each server remembers the setting for 60 seconds, so with more than one server running, an order in the next minute may still use the previous gateway.</li>
            <li><strong>A gateway you have no keys for cannot be chosen.</strong> Saving one would make every order on that site fail, so it is refused here instead.</li>
            <li><strong>Template upgrades are not affected.</strong> Balance payments for a design swap are priced in rupees and always go through PayU India.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
