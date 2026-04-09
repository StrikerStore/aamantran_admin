import { useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';
import { COMMUNITIES, ALL_EVENT_TYPES } from '../lib/constants';
import { formatCurrency, formatDate } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { Pagination } from '../components/ui/Pagination';

// Colour map for event category chips
const CATEGORY_COLORS = {
  'Wedding':         { bg: 'rgba(184,145,46,0.10)',  border: 'rgba(184,145,46,0.35)',  color: '#9a7020' },
  'Engagement':      { bg: 'rgba(184,145,46,0.10)',  border: 'rgba(184,145,46,0.35)',  color: '#9a7020' },
  'Reception':       { bg: 'rgba(184,145,46,0.10)',  border: 'rgba(184,145,46,0.35)',  color: '#9a7020' },
  'Sangeet':         { bg: 'rgba(184,145,46,0.10)',  border: 'rgba(184,145,46,0.35)',  color: '#9a7020' },
  'Haldi':           { bg: 'rgba(230,180,0,0.12)',   border: 'rgba(230,180,0,0.35)',   color: '#8a6600' },
  'Mehendi':         { bg: 'rgba(80,140,60,0.10)',   border: 'rgba(80,140,60,0.35)',   color: '#3a7020' },
  'Nikah':           { bg: 'rgba(20,140,120,0.10)',  border: 'rgba(20,140,120,0.35)',  color: '#0a7060' },
  'Anand Karaj':     { bg: 'rgba(220,140,20,0.10)',  border: 'rgba(220,140,20,0.35)',  color: '#8a5500' },
  'Thread Ceremony': { bg: 'rgba(120,80,200,0.10)',  border: 'rgba(120,80,200,0.35)',  color: '#6040a0' },
  'Naming Ceremony': { bg: 'rgba(60,120,220,0.10)',  border: 'rgba(60,120,220,0.35)',  color: '#2060a0' },
  'Griha Pravesh':   { bg: 'rgba(200,80,60,0.10)',   border: 'rgba(200,80,60,0.35)',   color: '#903020' },
  'Birthday':        { bg: 'rgba(220,80,160,0.10)',  border: 'rgba(220,80,160,0.35)',  color: '#a03070' },
  'First Birthday':  { bg: 'rgba(220,80,160,0.12)',  border: 'rgba(220,80,160,0.4)',   color: '#a03070' },
  'Baby Shower':     { bg: 'rgba(80,160,220,0.10)',  border: 'rgba(80,160,220,0.35)',  color: '#2070a0' },
  'House Warming':   { bg: 'rgba(200,120,60,0.10)',  border: 'rgba(200,120,60,0.35)',  color: '#904020' },
  'Anniversary':     { bg: 'rgba(180,60,100,0.10)',  border: 'rgba(180,60,100,0.35)',  color: '#802040' },
  'Retirement':      { bg: 'rgba(100,100,120,0.10)', border: 'rgba(100,100,120,0.35)', color: '#404060' },
};

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function Templates() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [templates, setTemplates] = useState([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [community, setCommunity] = useState('');
  const [eventType, setEventType] = useState('');
  const [status,    setStatus]    = useState('');
  const [confirm,   setConfirm]   = useState(null);

  useLayoutEffect(() => { setTopbarTitle('Templates'); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.templates.list({
        community: community || undefined,
        eventType: eventType || undefined,
        status:    status    || undefined,
        page,
        limit: 20,
      });
      setTemplates(res.data);
      setTotal(res.total);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [community, eventType, status, page, toast]);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(tpl) {
    try {
      if (tpl.isActive) { await api.templates.draft(tpl.id); toast('Moved to Draft', 'info'); }
      else              { await api.templates.publish(tpl.id); toast('Published', 'success'); }
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  async function handleDelete() {
    try {
      await api.templates.remove(confirm.id);
      toast(`"${confirm.name}" deleted`, 'success');
      setConfirm(null);
      load();
    } catch (err) { toast(err.message, 'error'); }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Templates</h1>
          <p className="page-subtitle">{total} template{total !== 1 ? 's' : ''} total</p>
        </div>
        <Button variant="primary" icon={<IconPlus />} onClick={() => navigate('/templates/new')}>
          Add Template
        </Button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select className="filter-select" value={community} onChange={e => { setCommunity(e.target.value); setPage(1); }}>
          <option value="">All communities</option>
          {COMMUNITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select className="filter-select" value={eventType} onChange={e => { setEventType(e.target.value); setPage(1); }}>
          <option value="">All event types</option>
          {ALL_EVENT_TYPES.map(et => <option key={et.id} value={et.id}>{et.label}</option>)}
        </select>

        <select className="filter-select" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Table */}
      <div className="table-container">
        {loading ? (
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
                <th>Event Categories</th>
                <th>Languages</th>
                <th>Price</th>
                <th>GST %</th>
                <th>Buyers</th>
                <th>Status</th>
                <th>Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {templates.map(t => (
                <tr key={t.id} className="clickable" onClick={() => navigate(`/templates/${t.id}/edit`)}>
                  {/* Thumbnail + name */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {(t.desktopThumbnailUrl || t.thumbnailUrl) ? (
                        <img src={resolvePublicUrl(t.desktopThumbnailUrl || t.thumbnailUrl)} alt={t.name}
                          style={{ width: 44, height: 52, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-subtle)', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 52, borderRadius: 6, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1.1rem', color: 'var(--text-muted)' }}>
                          🖼
                        </div>
                      )}
                      <div>
                        <div className="td-primary">{t.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.slug}</div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          {t.desktopThumbnailUrl || t.thumbnailUrl ? '🖥️' : '—'} {t.mobileThumbnailUrl ? '📱' : ''}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Community */}
                  <td style={{ textTransform: 'capitalize' }}>{t.community}</td>

                  {/* Event Categories */}
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
                      {(t.bestFor || '').split(', ').filter(Boolean).map(cat => {
                        const style = CATEGORY_COLORS[cat] || { bg: 'var(--bg-elevated)', border: 'var(--border-default)', color: 'var(--text-secondary)' };
                        return (
                          <span key={cat} style={{
                            fontSize: '0.7rem', padding: '2px 8px', borderRadius: 4,
                            background: style.bg, border: `1px solid ${style.border}`,
                            color: style.color, whiteSpace: 'nowrap', fontWeight: 500,
                          }}>
                            {cat}
                          </span>
                        );
                      })}
                      {!t.bestFor && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>}
                    </div>
                  </td>

                  {/* Languages */}
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(t.languages || 'en').split(', ').filter(Boolean).map(lang => (
                        <span key={lang} style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                          {lang}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Price */}
                  <td>
                    <div className="td-primary">{formatCurrency(t.price)}</div>
                    {t.originalPrice && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        {formatCurrency(t.originalPrice)}
                      </div>
                    )}
                  </td>
                  <td>{t.gstPercent ?? 0}%</td>

                  <td>{t.buyerCount}</td>
                  <td><Badge status={t.isActive ? 'active' : 'draft'} /></td>
                  <td>{formatDate(t.createdAt)}</td>

                  {/* Actions */}
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Button size="sm" variant="ghost" onClick={() => toggleActive(t)}>
                        {t.isActive ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setConfirm({ id: t.id, name: t.name })}>
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

      <div style={{ marginTop: 16 }}>
        <Pagination total={total} page={page} limit={20} onPageChange={setPage} />
      </div>

      {confirm && (
        <ConfirmModal
          title="Delete Template"
          message={`Delete "${confirm.name}"? This cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}
