import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

const STARS = [1, 2, 3, 4, 5];

const BLANK_FORM = { templateId: '', rating: 5, coupleNames: '', location: '', reviewText: '' };

export default function Reviews() {
  const toast = useToast();

  const [loading, setLoading]           = useState(true);
  const [reviews, setReviews]           = useState([]);
  const [total, setTotal]               = useState(0);
  const [hiddenFilter, setHiddenFilter] = useState('');

  const [templates, setTemplates] = useState([]);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(BLANK_FORM);
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  useLayoutEffect(() => { setTopbarTitle('Reviews'); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (hiddenFilter !== '') params.hidden = hiddenFilter;
      const res = await api.reviews.list(params);
      setReviews(res.reviews || []);
      setTotal(res.total || 0);
    } catch (err) {
      toast(err.message || 'Failed to load reviews', 'error');
    } finally {
      setLoading(false);
    }
  }, [hiddenFilter, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.templates.list({ limit: 200 })
      .then(r => setTemplates(r.data || []))
      .catch(() => {});
  }, []);

  function handlePhotoChange(e) {
    const file = e.target.files?.[0] || null;
    setPhotoFile(file);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function clearPhoto() {
    setPhotoFile(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetForm() {
    setForm(BLANK_FORM);
    clearPhoto();
  }

  async function toggleVisibility(r) {
    try {
      if (r.isHidden) {
        await api.reviews.show(r.id);
        toast('Review is now visible', 'success');
      } else {
        await api.reviews.hide(r.id);
        toast('Review hidden from public', 'info');
      }
      load();
    } catch (err) {
      toast(err.message || 'Failed to update review', 'error');
    }
  }

  async function deleteReview(r) {
    if (!window.confirm('Delete this review permanently?')) return;
    try {
      await api.reviews.remove(r.id);
      toast('Review deleted', 'success');
      load();
    } catch (err) {
      toast(err.message || 'Failed to delete review', 'error');
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!form.templateId) return toast('Please select a template', 'error');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('templateId', form.templateId);
      fd.append('rating', String(form.rating));
      if (form.coupleNames) fd.append('coupleNames', form.coupleNames);
      if (form.location)    fd.append('location',    form.location);
      if (form.reviewText)  fd.append('reviewText',  form.reviewText);
      if (photoFile)        fd.append('couplePhoto',  photoFile);

      await api.reviews.create(fd);
      toast('Review added', 'success');
      resetForm();
      setShowForm(false);
      load();
    } catch (err) {
      toast(err.message || 'Failed to add review', 'error');
    } finally {
      setSaving(false);
    }
  }

  function field(key) {
    return e => setForm(f => ({ ...f, [key]: e.target.value }));
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Reviews</h1>
          <p className="page-subtitle">{total} total review{total !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="form-input"
            style={{ width: 160 }}
            value={hiddenFilter}
            onChange={e => setHiddenFilter(e.target.value)}
          >
            <option value="">All reviews</option>
            <option value="false">Visible only</option>
            <option value="true">Hidden only</option>
          </select>
          <Button variant="primary" onClick={() => { setShowForm(v => !v); if (showForm) resetForm(); }}>
            {showForm ? 'Cancel' : '+ Add Review'}
          </Button>
        </div>
      </div>

      {/* Add review form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">Add review (admin)</span></div>
          <div className="card-body">
            <form className="form-row-3" onSubmit={submitReview}>
              <div className="form-group">
                <label className="form-label">Template *</label>
                <select className="form-input" value={form.templateId} onChange={field('templateId')} required>
                  <option value="">Select template…</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Rating *</label>
                <select className="form-input" value={form.rating} onChange={field('rating')}>
                  {STARS.map(s => <option key={s} value={s}>{s} ★</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Couple Names</label>
                <input className="form-input" placeholder="e.g. Priya & Arjun" value={form.coupleNames} onChange={field('coupleNames')} />
              </div>

              <div className="form-group">
                <label className="form-label">Location</label>
                <input className="form-input" placeholder="e.g. Mumbai" value={form.location} onChange={field('location')} />
              </div>

              {/* Couple photo upload */}
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="form-label">Couple Photo (optional)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="preview"
                      style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }}
                    />
                  ) : (
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'var(--surface-2, #f3f4f6)',
                      border: '2px dashed var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, color: 'var(--text-muted)',
                    }}>👤</div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      style={{ display: 'none' }}
                      onChange={handlePhotoChange}
                    />
                    <Button type="button" size="sm" variant="ghost" onClick={() => fileInputRef.current?.click()}>
                      {photoFile ? 'Change photo' : 'Upload photo'}
                    </Button>
                    {photoFile && (
                      <Button type="button" size="sm" variant="ghost" onClick={clearPhoto}>
                        Remove
                      </Button>
                    )}
                  </div>
                  {photoFile && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {photoFile.name}
                    </span>
                  )}
                </div>
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Review Text</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Write the review…"
                  value={form.reviewText}
                  onChange={field('reviewText')}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
                <Button variant="primary" type="submit" loading={saving}>Save Review</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reviews table */}
      <div className="table-container">
        {loading ? (
          <div className="spinner-wrap"><div className="spinner" /></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Template</th>
                <th>Rating</th>
                <th>Couple</th>
                <th>Review</th>
                <th>Source</th>
                <th>Status</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map(r => (
                <tr key={r.id} style={{ opacity: r.isHidden ? 0.5 : 1 }}>
                  <td className="td-primary">
                    {r.template?.name || '—'}
                    {r.template?.slug && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {r.template.slug}
                      </span>
                    )}
                  </td>
                  <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {r.couplePhotoUrl && (
                        <img
                          src={r.couplePhotoUrl}
                          alt=""
                          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      )}
                      <div>
                        <div>{r.coupleNames || '—'}</div>
                        {r.location && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.location}</div>}
                        {r.user && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{r.user.username}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ maxWidth: 280 }}>
                    <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.reviewText || <em style={{ color: 'var(--text-muted)' }}>No text</em>}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99,
                      background: r.isAdminCreated ? 'var(--accent-light, #e8f4fd)' : 'var(--surface-2, #f5f5f5)',
                      color: r.isAdminCreated ? 'var(--accent, #2563eb)' : 'var(--text-muted)',
                    }}>
                      {r.isAdminCreated ? 'Admin' : 'Customer'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99,
                      background: r.isHidden ? '#fef2f2' : '#f0fdf4',
                      color: r.isHidden ? '#b91c1c' : '#15803d',
                    }}>
                      {r.isHidden ? 'Hidden' : 'Visible'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="ghost" onClick={() => toggleVisibility(r)}>
                        {r.isHidden ? 'Show' : 'Hide'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => deleteReview(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ color: 'var(--text-muted)' }}>No reviews found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
