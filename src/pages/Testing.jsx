import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Pagination } from '../components/ui/Pagination';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';
import { getInviteBaseUrl } from '../lib/config';
import { COMMUNITIES } from '../lib/constants';
import { formatCurrency } from '../lib/utils';

const AUTOPUBLISH_KEY = 'aam_testing_autopublish';

/** Small labelled value with a copy button — used for the credentials. */
function CopyField({ label, value, mono = true }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <code style={{
          flex: 1, padding: '7px 10px', borderRadius: 'var(--r-sm)',
          background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          fontSize: '0.82rem', color: 'var(--text-primary)', wordBreak: 'break-all',
        }}>
          {value}
        </code>
        <Button size="sm" variant="ghost" onClick={() => {
          navigator.clipboard.writeText(value).then(
            () => toast(`${label} copied`, 'success'),
            () => toast('Could not copy to clipboard', 'error'),
          );
        }}>
          Copy
        </Button>
      </div>
    </div>
  );
}

export default function Testing() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [state,   setState]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(false);

  // Shown once after create/rotate — never retrievable again.
  const [newPassword, setNewPassword] = useState(null);
  const [rotateOpen,  setRotateOpen]  = useState(false);
  const [rotateValue, setRotateValue] = useState('');

  const [confirm, setConfirm] = useState(null);
  const [autoPublish, setAutoPublish] = useState(
    () => localStorage.getItem(AUTOPUBLISH_KEY) === '1'
  );

  // Template picker
  const [templates, setTemplates] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [status,    setStatus]    = useState('');
  const [community, setCommunity] = useState('');
  const [picking,   setPicking]   = useState(true);
  const loadedOnce = useRef(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.testing.status();
      setState(res);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadTemplates = useCallback(async () => {
    if (!loadedOnce.current) setPicking(true);
    try {
      const res = await api.templates.list({
        status:    status    || undefined,
        community: community || undefined,
        page,
        limit: 20,
      });
      setTemplates(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setPicking(false);
      loadedOnce.current = true;
    }
  }, [status, community, page, toast]);

  useEffect(() => { loadStatus(); },    [loadStatus]);
  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  useEffect(() => {
    localStorage.setItem(AUTOPUBLISH_KEY, autoPublish ? '1' : '0');
  }, [autoPublish]);

  async function run(fn, successMsg) {
    setBusy(true);
    try {
      const res = await fn();
      if (successMsg) toast(successMsg, 'success');
      await loadStatus();
      return res;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const res = await run(() => api.testing.ensureAccount(), 'Test account ready');
    if (res?.generatedPassword) setNewPassword(res.generatedPassword);
  }

  async function handleRotate() {
    const res = await run(
      () => api.testing.rotatePassword(rotateValue || undefined),
      'Password rotated — existing sessions signed out',
    );
    setRotateOpen(false);
    setRotateValue('');
    if (res?.generatedPassword) setNewPassword(res.generatedPassword);
  }

  async function handleLoad() {
    const tpl = confirm?.template;
    setConfirm(null);
    await run(
      () => api.testing.loadTemplate({
        templateId:   tpl.id,
        renderSource: 'draft',
        publish:      autoPublish,
      }),
      `"${tpl.name}" loaded into the test account`,
    );
  }

  async function handleOpenAsUser() {
    setBusy(true);
    try {
      const res = await api.testing.session();
      // Fragment, not query string: never sent to the server, never in a Referer.
      window.open(`${res.dashboardUrl}/#session=${encodeURIComponent(res.token)}`, '_blank', 'noreferrer');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="spinner-wrap"><div className="spinner" /></div>;
  }

  const provisioned = state?.provisioned;
  const event       = state?.event;
  const urls        = state?.urls || {};
  const inviteBase  = getInviteBaseUrl();

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Testing</h1>
          <p className="page-subtitle">
            Load one template at a time into the master test account — drafts included, no payment
          </p>
        </div>
      </div>

      {/* ── Account ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">Test Account</span>
          {provisioned && <Badge status="active" />}
        </div>

        {!provisioned ? (
          <div className="empty-state">
            <div className="empty-icon">🧪</div>
            <div className="empty-text">No test account yet</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '8px 0 16px' }}>
              Creates <code>{state?.config?.username}</code> with a generated password,
              shown once.
            </p>
            <Button variant="primary" loading={busy} onClick={handleCreate}>
              Create test account
            </Button>
          </div>
        ) : (
          <div className="card-body">
            <CopyField label="Username" value={state.user.username} />
            <CopyField label="Email"    value={state.user.email} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <Button variant="primary" loading={busy} onClick={handleOpenAsUser}>
                Open user app as test account
              </Button>
              <Button variant="secondary" onClick={() => setRotateOpen(true)}>
                Rotate password
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/users/${state.user.id}`)}>
                Admin user detail →
              </Button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 12, lineHeight: 1.6 }}>
              The password is stored hashed and is never retrievable — rotate it if you
              lose it. Rotating also signs out any session left open elsewhere.
            </p>
          </div>
        )}
      </div>

      {/* ── Current state ───────────────────────────────────────── */}
      {provisioned && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Currently Loaded</span>
            {event && <Badge status={event.isPublished ? 'published' : 'unpublished'} />}
          </div>

          {!event ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-text">No template loaded</div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
                Pick one below. Loading wipes the current test invitation completely.
              </p>
            </div>
          ) : (
            <div className="card-body">
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 18 }}>
                {event.template?.thumbnailUrl && (
                  <img
                    src={resolvePublicUrl(event.template.thumbnailUrl)}
                    alt=""
                    style={{ width: 56, height: 56, borderRadius: 'var(--r-sm)', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="td-primary" style={{ fontSize: '1rem' }}>{event.template?.name}</span>
                    <Badge status={event.template?.isActive ? 'active' : 'draft'} />
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 3 }}>
                    {event.template?.slug}
                  </div>
                </div>
              </div>

              {/* Render source — the lever that makes ZIP re-uploads show up on refresh */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 6 }}>
                  Render source
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    size="sm"
                    variant={event.renderSource === 'draft' ? 'primary' : 'secondary'}
                    onClick={() => event.renderSource !== 'draft' && run(() => api.testing.repin('draft'), 'Now rendering the live draft')}
                  >
                    Draft bundle
                  </Button>
                  <Button
                    size="sm"
                    variant={event.renderSource === 'current' ? 'primary' : 'secondary'}
                    onClick={() => event.renderSource !== 'current' && run(() => api.testing.repin('current'), 'Now rendering the published snapshot')}
                  >
                    {event.versionNumber ? `v${event.versionNumber} snapshot` : 'Published snapshot'}
                  </Button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8, lineHeight: 1.6 }}>
                  {event.renderSource === 'draft'
                    ? 'Re-upload the template ZIP and just refresh the invite — no reload needed.'
                    : 'Pinned to a frozen version. Switch to Draft to see in-progress ZIP uploads.'}
                </p>
              </div>

              <CopyField label="Invite URL" value={`${inviteBase}/i/${event.slug}`} />

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                {event.isPublished ? (
                  <Button variant="secondary" onClick={() => window.open(urls.invite, '_blank', 'noreferrer')}>
                    Open invite
                  </Button>
                ) : (
                  <Button variant="primary" loading={busy} onClick={() => run(() => api.testing.setPublished(true), 'Invitation published')}>
                    Publish now
                  </Button>
                )}
                <Button variant="secondary" onClick={() => window.open(urls.preview, '_blank', 'noreferrer')}>
                  Open preview
                </Button>
                <Button variant="secondary" onClick={() => window.open(urls.userDashboard, '_blank', 'noreferrer')}>
                  Open in wizard
                </Button>
                {event.isPublished && (
                  <Button variant="ghost" loading={busy} onClick={() => run(() => api.testing.setPublished(false), 'Invitation unpublished')}>
                    Unpublish
                  </Button>
                )}
                <Button variant="danger" onClick={() => setConfirm({ reset: true })}>
                  Clear test event
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Template picker ─────────────────────────────────────── */}
      {provisioned && (
        <>
          <div className="page-header" style={{ marginTop: 8 }}>
            <div className="page-header-left">
              <h2 className="card-title" style={{ fontSize: '1.05rem' }}>Load a template</h2>
              <p className="page-subtitle" style={{ marginTop: 2 }}>
                Drafts are included — loading one never makes it public
              </p>
            </div>
          </div>

          <div className="filters-bar">
            <Select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </Select>

            <Select className="filter-select" value={community} onChange={e => { setCommunity(e.target.value); setPage(1); }}>
              <option value="">All communities</option>
              {COMMUNITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>

            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer', marginLeft: 'auto' }}>
              <input
                type="checkbox"
                checked={autoPublish}
                onChange={e => setAutoPublish(e.target.checked)}
              />
              Publish on load
            </label>
          </div>

          <div className="table-container">
            {picking ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : templates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <div className="empty-text">No templates found</div>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Template</th>
                    <th>Community</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map(t => {
                    const isLoaded = event?.template?.id === t.id;
                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {t.thumbnailUrl && (
                              <img
                                src={resolvePublicUrl(t.thumbnailUrl)}
                                alt=""
                                style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                              />
                            )}
                            <div className="td-primary">{t.name}</div>
                          </div>
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{t.community}</td>
                        <td>{formatCurrency(t.price)}</td>
                        <td><Badge status={t.isActive ? 'active' : 'draft'} /></td>
                        <td>
                          {isLoaded ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              ● in test
                            </span>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => setConfirm({ template: t })}>
                              Load
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ marginTop: 16 }}>
            <Pagination total={total} page={page} limit={20} onPageChange={setPage} />
          </div>
        </>
      )}

      {/* ── Modals ──────────────────────────────────────────────── */}
      {newPassword && (
        <Modal
          title="Save this password now"
          onClose={() => setNewPassword(null)}
          footer={<button className="btn btn-primary" onClick={() => setNewPassword(null)}>Done</button>}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 14 }}>
            This is shown once and cannot be retrieved later. Store it in your password
            manager — if you lose it, rotate to get a new one.
          </p>
          <CopyField label="Password" value={newPassword} />
        </Modal>
      )}

      {rotateOpen && (
        <Modal
          title="Rotate test password"
          onClose={() => setRotateOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setRotateOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRotate}>Rotate</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 14 }}>
            Leave blank to generate a strong password. Any session currently signed in as
            the test account will be signed out immediately.
          </p>
          <input
            className="form-input"
            type="text"
            placeholder="Leave blank to generate"
            value={rotateValue}
            onChange={e => setRotateValue(e.target.value)}
          />
        </Modal>
      )}

      {confirm?.template && (
        <ConfirmModal
          title="Load into test account"
          icon="🧨"
          confirmText="Load"
          confirmVariant="danger"
          message={`Load "${confirm.template.name}" into the test account? This permanently deletes the current test invitation along with its guests, RSVPs, wishes, photos and planning data.`}
          onConfirm={handleLoad}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm?.reset && (
        <ConfirmModal
          title="Clear test event"
          icon="🧹"
          confirmText="Clear"
          message="Delete the current test invitation and all its data? The account stays; only the invitation is removed."
          onConfirm={async () => {
            setConfirm(null);
            await run(() => api.testing.reset(), 'Test event cleared');
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
