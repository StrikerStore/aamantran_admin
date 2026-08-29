import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

/**
 * Template Lab accounts — credentials for external template developers.
 *
 * These are contractors, not staff: they never receive an admin token, and the
 * Lab they sign into can only reach /api/dev/*. Issuing and revoking access is
 * therefore a normal admin task rather than a shell one.
 *
 * Passwords are shown exactly once. The hash is all that is stored, so a lost
 * password is rotated, never looked up.
 */

/** Labelled value with a copy button — used for the one-time credentials. */
function CopyField({ label, value }) {
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
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
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

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Developers() {
  const toast = useToast();

  const [state, setState]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy]       = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', handle: '', email: '', password: '', templateLimit: '' });

  // Shown once after create/rotate — never retrievable again.
  const [issued, setIssued] = useState(null);
  const [rotateFor, setRotateFor] = useState(null);
  const [rotateValue, setRotateValue] = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try {
      setState(await api.developers.list());
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function run(fn, msg) {
    setBusy(true);
    try {
      const res = await fn();
      if (msg) toast(msg, 'success');
      await load();
      return res;
    } catch (err) {
      toast(err.message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    const res = await run(
      () => api.developers.create({
        name:   form.name,
        handle: form.handle,
        email:  form.email,
        ...(form.password ? { password: form.password } : {}),
        ...(form.templateLimit ? { templateLimit: Number(form.templateLimit) } : {}),
      }),
      'Developer account created',
    );
    if (!res) return;
    setCreateOpen(false);
    setForm({ name: '', handle: '', email: '', password: '', templateLimit: '' });
    setIssued({
      title:    'Developer account created',
      handle:   res.developer.handle,
      password: res.generatedPassword,
      labUrl:   res.labUrl,
      inviteUrl: res.inviteUrl,
    });
  }

  async function handleRotate() {
    const handle = rotateFor;
    const res = await run(
      () => api.developers.rotatePassword(handle, rotateValue || undefined),
      'Password rotated — any open Lab session is signed out',
    );
    setRotateFor(null);
    setRotateValue('');
    if (res) {
      setIssued({ title: 'New password', handle, password: res.generatedPassword, labUrl: state?.labUrl });
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  const developers = state?.developers || [];

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Template Developers</h1>
          <p className="page-subtitle">
            Lab accounts for external template developers — upload and test only, no admin access
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          Add developer
        </Button>
      </div>

      <div className="table-container">
        {developers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧑‍💻</div>
            <div className="empty-text">No developer accounts yet</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
              Create one to give an external developer access to the Template Lab at{' '}
              <code>{state?.labUrl}</code>.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Developer</th>
                <th>Sandbox invite</th>
                <th>Templates</th>
                <th>Last login</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {developers.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="td-primary">{d.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {d.handle} · {d.email}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.76rem' }}>
                    /i/lab-{d.handle}
                  </td>
                  <td>{d.templateCount} / {d.templateLimit}</td>
                  <td style={{ fontSize: '0.82rem' }}>{formatDate(d.lastLoginAt)}</td>
                  <td>
                    <Badge status={d.isActive ? 'active' : 'draft'} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setRotateFor(d.handle)}>
                        Rotate password
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => run(
                          () => api.developers.setActive(d.handle, !d.isActive),
                          d.isActive ? `${d.handle} disabled` : `${d.handle} re-enabled`,
                        )}
                      >
                        {d.isActive ? 'Disable' : 'Enable'}
                      </Button>
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirm(d)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 14, lineHeight: 1.7 }}>
        Disabling takes effect immediately — access is re-checked on every request, not when the
        token expires. Sandbox templates never appear in the catalogue, the store or checkout, and
        their invitations are excluded from all analytics.
      </p>

      {/* ── Create ──────────────────────────────────────────────── */}
      {createOpen && (
        <Modal
          title="Add developer"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={handleCreate}>Create</button>
            </>
          }
        >
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              placeholder="Arjun Sharma"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Handle</label>
            <input
              className="form-input"
              placeholder="arjun"
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 5, lineHeight: 1.6 }}>
              Becomes their permanent invite link — <code>/i/lab-{form.handle || 'handle'}</code>.
              Letters, digits and dashes; it cannot be changed later.
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              placeholder="dev@studio.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="text"
              placeholder="Leave blank to generate a strong one"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Template limit</label>
            <input
              className="form-input"
              type="number"
              min="1"
              placeholder="10"
              value={form.templateLimit}
              onChange={(e) => setForm({ ...form, templateLimit: e.target.value })}
            />
          </div>
        </Modal>
      )}

      {/* ── Rotate ──────────────────────────────────────────────── */}
      {rotateFor && (
        <Modal
          title={`Rotate password — ${rotateFor}`}
          onClose={() => { setRotateFor(null); setRotateValue(''); }}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setRotateFor(null); setRotateValue(''); }}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={handleRotate}>Rotate</button>
            </>
          }
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 14 }}>
            Leave blank to generate a strong password. Any Lab session this developer has open
            will be signed out immediately.
          </p>
          <input
            className="form-input"
            type="text"
            placeholder="Leave blank to generate"
            value={rotateValue}
            onChange={(e) => setRotateValue(e.target.value)}
          />
        </Modal>
      )}

      {/* ── One-time credentials ────────────────────────────────── */}
      {issued && (
        <Modal
          title={issued.title}
          onClose={() => setIssued(null)}
          footer={<button className="btn btn-primary" onClick={() => setIssued(null)}>Done</button>}
        >
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: 14 }}>
            The password is shown once and cannot be retrieved later. Send these to the developer
            now — if it is lost, rotate to issue a new one.
          </p>
          <CopyField label="Lab URL"  value={issued.labUrl} />
          <CopyField label="Handle"   value={issued.handle} />
          <CopyField label="Password" value={issued.password} />
          {issued.inviteUrl && <CopyField label="Their sandbox invite" value={issued.inviteUrl} />}
        </Modal>
      )}

      {/* ── Delete ──────────────────────────────────────────────── */}
      {confirm && (
        <ConfirmModal
          title="Delete developer"
          icon="🗑️"
          confirmText="Delete"
          confirmVariant="danger"
          message={
            `Delete "${confirm.name}" (${confirm.handle})? This removes their account, their `
            + `${confirm.templateCount} sandbox template(s) and their test invitation. `
            + `Uploaded files are left in storage.`
          }
          onConfirm={async () => {
            const handle = confirm.handle;
            setConfirm(null);
            await run(() => api.developers.remove(handle), `${handle} deleted`);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
