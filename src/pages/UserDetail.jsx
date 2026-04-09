import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getInviteBaseUrl } from '../lib/config';
import {
  computeFunctionSortOrders,
  resolveMapFieldsForRow,
  formatLatLngHint,
} from '../lib/functionFormHelpers';
import { formatCurrency, formatDate } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { AdminInviteModal, EditEventModal } from './InvitationModals';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function UserDetail() {
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [phoneEdit, setPhoneEdit] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [pwModal, setPwModal] = useState(false);
  const [swapModal, setSwapModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [freezeConfirm, setFreezeConfirm] = useState(null);
  const [inviteGenOpen, setInviteGenOpen] = useState(false);
  const [swapPairedOpen, setSwapPairedOpen] = useState(false);

  useLayoutEffect(() => { setTopbarTitle('User Detail'); }, []);

  const load = () => {
    setLoading(true);
    api.users.get(id)
      .then((res) => {
        setUser(res.data);
        setPhoneEdit(res.data.phone || '');
      })
      .catch((err) => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line

  const pairedInviteSets = useMemo(
    () => partitionEvents(user?.events || []).pairs,
    [user?.events],
  );
  const hasPairedInvite = pairedInviteSets.length > 0;

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await api.users.updateProfile(id, { phone: phoneEdit.trim() || null });
      setUser((u) => ({ ...u, ...res.data }));
      toast('Account details saved', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;
  if (!user) return <div className="empty-state"><div className="empty-text">User not found</div></div>;

  return (
    <div>
      <div className="breadcrumb">
        <a href="#" onClick={(e) => { e.preventDefault(); navigate('/users'); }}>Users</a>
        <span className="breadcrumb-sep">›</span>
        <span>{user.username || user.email}</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{user.username || user.email}</h1>
          <p className="page-subtitle">{user.email} · Joined {formatDate(user.createdAt)}</p>
        </div>
        <Button variant="secondary" onClick={() => setPwModal(true)}>Update password</Button>
      </div>

      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 20, maxWidth: 820 }}>
        Manage account details, purchased templates, and invitations. Template upgrades that cost more than their current purchase send a Razorpay payment link by email; cheaper or same-price swaps apply immediately.
      </p>

      {/* Account — username, email, phone in one row */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><span className="card-title">Account</span></div>
        <div style={{ padding: '16px 24px 20px' }}>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">Username (login)</label>
              <input className="form-input" value={user.username || '—'} readOnly disabled style={{ opacity: 0.85 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={user.email} readOnly disabled style={{ opacity: 0.85 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={phoneEdit} onChange={(e) => setPhoneEdit(e.target.value)} placeholder="Mobile" />
            </div>
          </div>
          <Button variant="primary" size="sm" loading={savingProfile} onClick={saveProfile}>Save account details</Button>
        </div>
      </div>

      {/* Templates purchased — swap is per invitation below */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header"><span className="card-title">Templates</span></div>
        <p style={{ padding: '12px 24px 0', fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: 820 }}>
          Templates this user has purchased. For a <strong>paired</strong> full + partial set, use <strong>Change paired template</strong> under Invitations (updates both at once). For other invitations, use <strong>Change template</strong> on that invite. If the new template costs more, a payment link is emailed to the user.
        </p>
        {!user.payments?.length ? (
          <div style={{ padding: '20px 24px 24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>No template purchases yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', padding: '8px 0 16px' }}>
            <table>
              <thead>
                <tr><th>Template</th><th>Amount</th><th>Status</th><th>Date</th></tr>
              </thead>
              <tbody>
                {user.payments.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => navigate(`/transactions/${p.id}`)}>
                    <td className="td-primary">{p.template?.name || '—'}</td>
                    <td>{formatCurrency(p.amount)}</td>
                    <td><Badge status={p.status} /></td>
                    <td>{formatDate(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invitations — admin form + paired links + standalone */}
      <div className="card" style={{ marginBottom: 32 }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span className="card-title">Invitations</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              disabled={hasPairedInvite}
              title={hasPairedInvite ? 'This user already has a full + partial pair. Remove or archive those events in the database if you must create another pair.' : ''}
              onClick={() => setInviteGenOpen(true)}
            >
              Invitation generation form
            </Button>
            {hasPairedInvite && (
              <Button variant="secondary" size="sm" onClick={() => setSwapPairedOpen(true)}>
                Change paired template
              </Button>
            )}
          </div>
        </div>
        <div style={{ padding: '0 24px 16px', fontSize: '0.86rem', color: 'var(--text-muted)', maxWidth: 900 }}>
          Use <strong>Invitation generation form</strong> once to create a full + partial pair (disabled after a pair exists). Use <strong>Change paired template</strong> to switch the template on <strong>both</strong> invites together. The couple gets two guest links; other standalone invitations stay below.
        </div>
        <InvitationsBody
          userId={id}
          events={user.events}
          onEdit={(ev) => setEditModal(ev)}
          onSwap={(ev) => setSwapModal(ev)}
          onFreeze={(evId) => setFreezeConfirm(evId)}
          toast={toast}
          onRefresh={load}
        />
      </div>

      {user.tickets?.length > 0 && (
        <div className="card" style={{ marginBottom: 32 }}>
          <div className="card-header"><span className="card-title">Support Tickets</span></div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr><th>Subject</th><th>Status</th><th>Opened</th></tr>
              </thead>
              <tbody>
                {user.tickets.map((t) => (
                  <tr key={t.id} className="clickable" onClick={() => navigate(`/tickets/${t.id}`)}>
                    <td className="td-primary">{t.subject}</td>
                    <td><Badge status={t.status} /></td>
                    <td>{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pwModal && (
        <ResetPasswordModal userId={id} onClose={() => setPwModal(false)} onSuccess={() => { setPwModal(false); toast('Password updated', 'success'); }} />
      )}
      {swapModal && (
        <SwapTemplateModal
          userId={id}
          event={swapModal}
          onClose={() => setSwapModal(null)}
          onSuccess={(msg) => { setSwapModal(null); load(); toast(msg || 'Done', 'success'); }}
        />
      )}
      {editModal && (
        <EditEventModal userId={id} event={editModal} onClose={() => setEditModal(null)} onSuccess={() => { setEditModal(null); load(); toast('Invitation updated', 'success'); }} />
      )}
      {freezeConfirm && (
        <ConfirmModal
          title="Freeze names"
          message="Once frozen, only an admin can change host names on this invitation. Continue?"
          confirmText="Freeze names"
          confirmVariant="warning"
          onConfirm={async () => {
            try {
              await api.users.freezeNames(id, freezeConfirm);
              setFreezeConfirm(null);
              toast('Names frozen', 'info');
              load();
            } catch (err) { toast(err.message, 'error'); }
          }}
          onCancel={() => setFreezeConfirm(null)}
        />
      )}
      {inviteGenOpen && (
        <AdminInviteModal
          userId={id}
          user={user}
          onClose={() => setInviteGenOpen(false)}
          onSuccess={() => { setInviteGenOpen(false); load(); toast('Two invitations created', 'success'); }}
        />
      )}
      {swapPairedOpen && (
        <SwapPairedTemplateModal
          userId={id}
          pairs={pairedInviteSets}
          onClose={() => setSwapPairedOpen(false)}
          onSuccess={(msg) => { setSwapPairedOpen(false); load(); toast(msg || 'Done', 'success'); }}
        />
      )}
    </div>
  );
}

function partitionEvents(events) {
  if (!events?.length) return { pairs: [], standalone: [] };
  const map = new Map();
  const standalone = [];
  for (const ev of events) {
    if (ev.invitePairId) {
      if (!map.has(ev.invitePairId)) map.set(ev.invitePairId, []);
      map.get(ev.invitePairId).push(ev);
    } else standalone.push(ev);
  }
  const pairs = [];
  for (const arr of map.values()) {
    const full = arr.find((e) => e.inviteScope === 'full');
    const subset = arr.find((e) => e.inviteScope === 'subset');
    if (full && subset) pairs.push({ pairId: full.invitePairId, full, subset });
    else {
      for (const e of arr) standalone.push(e);
    }
  }
  return { pairs, standalone };
}

function FunctionChips({ functions }) {
  if (!functions?.length) {
    return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No functions yet</span>;
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {functions.map((fn) => (
        <span
          key={fn.id}
          style={{
            fontSize: '0.76rem',
            color: 'var(--text-secondary)',
            background: 'var(--bg-base)',
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid var(--border-subtle)',
          }}
        >
          {fn.name}
        </span>
      ))}
    </div>
  );
}

function PublishInviteButton({ userId, eventId, isPublished, onDone, toast }) {
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    try {
      await api.users.updateEventData(userId, { eventId, isPublished: !isPublished });
      toast(isPublished ? 'Invitation unpublished' : 'Invitation published', 'success');
      onDone();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Button
      size="sm"
      variant={isPublished ? 'ghost' : 'primary'}
      loading={loading}
      onClick={(e) => { e.stopPropagation(); toggle(); }}
    >
      {isPublished ? 'Unpublish' : 'Publish'}
    </Button>
  );
}

function PairedLinkCell({ label, slug, liveUrl, userId, eventId, isPublished, toast }) {
  const [loadingPreview, setLoadingPreview] = useState(false);
  function copy(u) {
    navigator.clipboard.writeText(u).then(() => toast('Link copied', 'success')).catch(() => toast('Could not copy', 'error'));
  }
  async function fetchPreviewUrl() {
    const r = await api.users.getEventPreviewToken(userId, eventId);
    return r.previewUrl;
  }
  async function openPreview() {
    setLoadingPreview(true);
    try {
      const url = await fetchPreviewUrl();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  }
  async function copyPreview() {
    setLoadingPreview(true);
    try {
      const url = await fetchPreviewUrl();
      await navigator.clipboard.writeText(url);
      toast('Preview link copied (valid 24h)', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  }
  return (
    <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
        Slug: <code className="mono" style={{ fontSize: '0.76rem' }}>/{slug}</code>
      </div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Guest (live)</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', flex: '1 1 160px', color: 'var(--gold)' }}>{liveUrl}</code>
        <Button size="sm" variant="ghost" onClick={() => copy(liveUrl)}>Copy</Button>
        {isPublished ? (
          <a href={liveUrl} target="_blank" rel="noreferrer"><Button size="sm">Open ↗</Button></a>
        ) : (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Draft</span>
        )}
      </div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Draft preview</div>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.45 }}>
        Signed link (24h). Required when the invite is unpublished.
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="sm" variant="secondary" loading={loadingPreview} onClick={openPreview}>Open preview ↗</Button>
        <Button size="sm" variant="ghost" loading={loadingPreview} onClick={copyPreview}>Copy preview link</Button>
      </div>
    </div>
  );
}

function PairedInvitesBlock({ userId, full, subset, onEdit, onFreeze, toast, onRefresh }) {
  const base = getInviteBaseUrl();
  const fullLive = `${base}/i/${full.slug}`;
  const subLive = `${base}/i/${subset.slug}`;
  const namesFrozen = full.namesAreFrozen || subset.namesAreFrozen;

  return (
    <div
      style={{
        margin: '0 24px 24px',
        padding: 20,
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-elevated)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Shared identity */}
      <div style={{ marginBottom: 18, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
          PAIRED INVITATIONS
        </div>
        <div style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {(full.brideName || '—')} &amp; {(full.groomName || '—')}
        </div>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6, maxWidth: 720, lineHeight: 1.5 }}>
          Same template and couple; <strong>two separate guest URLs</strong> — one lists every function you added, the other only the ones marked for the partial invite.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--gold)', background: 'rgba(184,145,46,0.12)', padding: '4px 10px', borderRadius: 6, fontWeight: 600 }}>
            Full + partial pair
          </span>
          {namesFrozen && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-overlay)', padding: '4px 10px', borderRadius: 6 }}>
              Names frozen (one or both)
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 10 }}>
          {full.template?.name}
          {' · '}
          <span style={{ textTransform: 'capitalize' }}>{full.eventType || 'event'}</span>
        </div>
      </div>

      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12, maxWidth: 720 }}>
        Template changes for this pair are done with <strong>Change paired template</strong> in the Invitations header (applies to full and partial together).
      </p>

      {/* Actions — grouped per invite */}
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
        ACTIONS PER INVITE
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <div style={{ padding: 14, borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Full invitation</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>All functions</div>
            </div>
            <Badge status={full.isPublished ? 'active' : 'draft'} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => onEdit(full)}>Edit data</Button>
            <PublishInviteButton
              userId={userId}
              eventId={full.id}
              isPublished={full.isPublished}
              onDone={onRefresh}
              toast={toast}
            />
            {!full.namesAreFrozen && (
              <Button size="sm" variant="ghost" onClick={() => onFreeze(full.id)}>Freeze names</Button>
            )}
          </div>
        </div>
        <div style={{ padding: 14, borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Partial invitation</div>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 2 }}>Selected functions only</div>
            </div>
            <Badge status={subset.isPublished ? 'active' : 'draft'} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <Button size="sm" variant="secondary" onClick={() => onEdit(subset)}>Edit data</Button>
            <PublishInviteButton
              userId={userId}
              eventId={subset.id}
              isPublished={subset.isPublished}
              onDone={onRefresh}
              toast={toast}
            />
            {!subset.namesAreFrozen && (
              <Button size="sm" variant="ghost" onClick={() => onFreeze(subset.id)}>Freeze names</Button>
            )}
          </div>
        </div>
      </div>

      {/* Links — side by side for comparison */}
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
        GUEST LINKS
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <PairedLinkCell
          label="FULL — ALL EVENTS"
          slug={full.slug}
          liveUrl={fullLive}
          userId={userId}
          eventId={full.id}
          isPublished={full.isPublished}
          toast={toast}
        />
        <PairedLinkCell
          label="PARTIAL — SELECTED EVENTS"
          slug={subset.slug}
          liveUrl={subLive}
          userId={userId}
          eventId={subset.id}
          isPublished={subset.isPublished}
          toast={toast}
        />
      </div>

      {/* Functions — explicit comparison */}
      <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 10 }}>
        FUNCTIONS ON EACH INVITE
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Full invite includes</div>
          <FunctionChips functions={full.functions} />
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Partial invite includes</div>
          <FunctionChips functions={subset.functions} />
        </div>
      </div>
    </div>
  );
}

function InvitationsBody({ userId, events, onEdit, onSwap, onFreeze, toast, onRefresh }) {
  const { pairs, standalone } = partitionEvents(events);
  const empty = pairs.length === 0 && standalone.length === 0;
  if (empty) {
    return (
      <div style={{ padding: '16px 24px 28px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        No invitations yet. Use <strong>Invitation generation form</strong> above, or after checkout the couple can create one from the dashboard.
      </div>
    );
  }
  return (
    <div>
      {pairs.map(({ pairId, full, subset }) => (
        <PairedInvitesBlock
          key={pairId}
          userId={userId}
          full={full}
          subset={subset}
          onEdit={onEdit}
          onFreeze={onFreeze}
          toast={toast}
          onRefresh={onRefresh}
        />
      ))}
      {standalone.map((ev) => (
        <EventCard
          key={ev.id}
          userId={userId}
          event={ev}
          onEdit={() => onEdit(ev)}
          onSwap={() => onSwap(ev)}
          onFreeze={() => onFreeze(ev.id)}
          toast={toast}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

function EventCard({ userId, event: ev, subtitle, onEdit, onSwap, onFreeze, toast, onRefresh }) {
  const base = getInviteBaseUrl();
  const liveUrl = `${base}/i/${ev.slug}`;
  const [loadingPreview, setLoadingPreview] = useState(false);

  function copy(u) {
    navigator.clipboard.writeText(u).then(() => toast('Link copied', 'success')).catch(() => toast('Could not copy', 'error'));
  }
  async function openPreview() {
    setLoadingPreview(true);
    try {
      const r = await api.users.getEventPreviewToken(userId, ev.id);
      window.open(r.previewUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  }
  async function copyPreview() {
    setLoadingPreview(true);
    try {
      const r = await api.users.getEventPreviewToken(userId, ev.id);
      await navigator.clipboard.writeText(r.previewUrl);
      toast('Preview link copied (valid 24h)', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoadingPreview(false);
    }
  }

  const typeLabel = ev.eventType || 'event';

  return (
    <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
            {(ev.brideName || '—')} &amp; {(ev.groomName || '—')}
            {ev.namesAreFrozen && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-overlay)', padding: '2px 8px', borderRadius: 4 }}>Names frozen</span>
            )}
            {subtitle && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--gold)', background: 'rgba(184,145,46,0.12)', padding: '2px 8px', borderRadius: 4 }}>{subtitle}</span>
            )}
            {!subtitle && ev.inviteScope === 'full' && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-overlay)', padding: '2px 8px', borderRadius: 4 }}>All functions</span>
            )}
            {!subtitle && ev.inviteScope === 'subset' && (
              <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-overlay)', padding: '2px 8px', borderRadius: 4 }}>Partial invite</span>
            )}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {ev.template?.name} · <span style={{ textTransform: 'capitalize' }}>{typeLabel}</span> · /{ev.slug} ·{' '}
            <Badge status={ev.isPublished ? 'active' : 'draft'} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button size="sm" variant="secondary" onClick={onEdit}>Edit invitation data</Button>
          <Button size="sm" variant="secondary" onClick={onSwap}>Change template</Button>
          <PublishInviteButton
            userId={userId}
            eventId={ev.id}
            isPublished={ev.isPublished}
            onDone={onRefresh}
            toast={toast}
          />
          {!ev.namesAreFrozen && <Button size="sm" variant="ghost" onClick={onFreeze}>Freeze names</Button>}
        </div>
      </div>

      <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 }}>FINAL GUEST LINK (published)</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <code style={{ fontSize: '0.78rem', wordBreak: 'break-all', flex: '1 1 200px' }}>{liveUrl}</code>
          <Button size="sm" variant="ghost" onClick={() => copy(liveUrl)}>Copy</Button>
          {ev.isPublished ? (
            <a href={liveUrl} target="_blank" rel="noreferrer"><Button size="sm">Open invite ↗</Button></a>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Not published — use Publish above or the couple dashboard</span>
          )}
        </div>
        <div style={{ marginTop: 10, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Draft preview (signed link, 24h):{' '}
          <Button size="sm" variant="secondary" loading={loadingPreview} onClick={openPreview} style={{ marginRight: 6 }}>Open ↗</Button>
          <Button size="sm" variant="ghost" loading={loadingPreview} onClick={copyPreview}>Copy link</Button>
        </div>
      </div>

      {ev.functions?.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ev.functions.map((fn) => (
            <span key={fn.id} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', background: 'var(--bg-elevated)', padding: '3px 10px', borderRadius: 4, border: '1px solid var(--border-subtle)' }}>
              {fn.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ResetPasswordModal({ userId, onClose, onSuccess }) {
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  async function handle() {
    setSaving(true);
    try {
      await api.users.resetPassword(userId, pw);
      onSuccess();
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Update password" onClose={onClose} footer={(
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={handle} disabled={pw.length < 8}>Save password</Button>
      </>
    )}
    >
      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Sets a new password for this user&apos;s couple dashboard login. Minimum 8 characters.
      </p>
      <div className="form-group">
        <label className="form-label">New password</label>
        <input className="form-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
      </div>
    </Modal>
  );
}

function SwapTemplateModal({ userId, event, onClose, onSuccess }) {
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.templates.list({ status: 'active', limit: 200 })
      .then((r) => setTemplates(r.data))
      .catch((err) => toast(err.message, 'error'));
  }, []); // eslint-disable-line

  const currentPrice = event.template?.price ?? 0;
  const picked = templates.find((t) => t.id === selected);
  const delta = picked ? picked.price - currentPrice : null;
  const needsPayment = picked && delta !== null && delta > 0;
  const primaryLabel = !picked ? 'Continue' : needsPayment ? 'Email payment link' : 'Switch template now';

  async function handle() {
    setSaving(true);
    try {
      const res = await api.users.swapTemplate(userId, { eventId: event.id, newTemplateId: selected });
      let msg = res.message
        || (res.status === 'swapped' ? 'Template updated. No extra charge.' : 'Payment link emailed to user.');
      if (res.usedPlaceholderLink) {
        msg += ' Placeholder pay link was used — set Razorpay keys and TEMPLATE_SWAP_PLACEHOLDER_PAY_URL for production.';
      }
      onSuccess(msg);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Change template" onClose={onClose} footer={(
      <>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={handle} disabled={!selected}>{primaryLabel}</Button>
      </>
    )}
    >
      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Current template: <strong>{event.template?.name}</strong> ({formatCurrency(currentPrice)}). Pick a new template below.
      </p>
      <div className="form-group">
        <label className="form-label">New template</label>
        <select className="form-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.community} — {formatCurrency(t.price)}</option>
          ))}
        </select>
      </div>
      {picked && delta !== null && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)', fontSize: '0.86rem' }}>
          {delta <= 0 && (
            <span>The new template is the same price or cheaper — <strong>swap applies immediately</strong> with no payment.</span>
          )}
          {delta > 0 && (
            <span>
              Price difference: <strong>{formatCurrency(delta)}</strong>. Click <strong>Email payment link</strong> to email them a Razorpay checkout link. After payment, the webhook switches their invite to the new template. If Razorpay is not configured, a placeholder link is emailed instead (template will not switch until a real payment is recorded).
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}

function SwapPairedTemplateModal({ userId, pairs, onClose, onSuccess }) {
  const [invitePairId, setInvitePairId] = useState(() => pairs[0]?.pairId ?? '');
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('');
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.templates.list({ status: 'active', limit: 200 })
      .then((r) => setTemplates(r.data))
      .catch((err) => toast(err.message, 'error'));
  }, []); // eslint-disable-line

  useEffect(() => {
    const first = pairs[0]?.pairId;
    if (!first) return;
    setInvitePairId((current) => (pairs.some((p) => p.pairId === current) ? current : first));
  }, [pairs]);

  const pair = pairs.find((p) => p.pairId === invitePairId) || pairs[0];
  const full = pair?.full;
  const currentPrice = full?.template?.price ?? 0;
  const picked = templates.find((t) => t.id === selected);
  const delta = picked ? picked.price - currentPrice : null;
  const needsPayment = picked && delta !== null && delta > 0;
  const primaryLabel = !picked ? 'Continue' : needsPayment ? 'Email payment link' : 'Switch both now';

  async function handle() {
    if (!invitePairId || !selected) return;
    setSaving(true);
    try {
      const res = await api.users.swapPairedTemplate(userId, { invitePairId, newTemplateId: selected });
      let msg = res.message
        || (res.status === 'swapped'
          ? 'Template updated on both full and partial invitations.'
          : 'Payment link emailed to the user.');
      if (res.usedPlaceholderLink) {
        msg += ' Placeholder pay link — configure Razorpay for live checkout.';
      }
      onSuccess(msg);
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  if (!pair || !full) {
    return (
      <Modal title="Change paired template" onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
        <p style={{ color: 'var(--text-muted)' }}>No paired invitations found.</p>
      </Modal>
    );
  }

  return (
    <Modal
      title="Change paired template"
      onClose={onClose}
      footer={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handle} disabled={!selected}>{primaryLabel}</Button>
        </>
      )}
    >
      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Updates the template on <strong>both</strong> the full and partial guest links for this pair. Current template:{' '}
        <strong>{full.template?.name}</strong> ({formatCurrency(currentPrice)}).
      </p>
      {pairs.length > 1 && (
        <div className="form-group">
          <label className="form-label">Paired set</label>
          <select className="form-select" value={invitePairId} onChange={(e) => setInvitePairId(e.target.value)}>
            {pairs.map((p) => (
              <option key={p.pairId} value={p.pairId}>
                {(p.full.brideName || '—')} &amp; {(p.full.groomName || '—')} · /{p.full.slug} + /{p.subset.slug}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">New template</label>
        <select className="form-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Select…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} — {t.community} — {formatCurrency(t.price)}</option>
          ))}
        </select>
      </div>
      {picked && delta !== null && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-elevated)', fontSize: '0.86rem' }}>
          {delta <= 0 && (
            <span>Same price or cheaper — <strong>both invitations switch immediately</strong> with no payment.</span>
          )}
          {delta > 0 && (
            <span>
              Price difference: <strong>{formatCurrency(delta)}</strong> (one payment covers <strong>both</strong> invites). A Razorpay link will be emailed; after payment, both update automatically.
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}

