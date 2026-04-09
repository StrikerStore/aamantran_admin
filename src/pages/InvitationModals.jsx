import { useState, useEffect, useRef, useMemo } from 'react';
import { api } from '../lib/api';
import { computeFunctionSortOrders, resolveMapFieldsForRow, formatLatLngHint } from '../lib/functionFormHelpers';
import { formatCurrency } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fnEnabled(schema, k) {
  if (k === 'name' || k === 'date') return true;
  return !schema?.functionFields || schema.functionFields[k]?.enabled !== false;
}

function buildFnPayload(functions, toast) {
  for (let i = 0; i < functions.length; i++) {
    if (!String(functions[i].name || '').trim()) { toast(`Function ${i + 1}: name required`, 'error'); return null; }
    if (!functions[i].date) { toast(`Function ${i + 1}: date required`, 'error'); return null; }
  }
  const sr = computeFunctionSortOrders(functions);
  if (sr.error) { toast(sr.error, 'error'); return null; }
  const out = [];
  for (let i = 0; i < functions.length; i++) {
    const fn = functions[i], m = resolveMapFieldsForRow(fn);
    if (m.error) { toast(`Function ${i + 1}: ${m.error}`, 'error'); return null; }
    out.push({ name: fn.name, date: fn.date, startTime: fn.startTime || undefined, venueName: fn.venueName || undefined, venueAddress: fn.venueAddress || undefined, dressCode: String(fn.dressCode || '').trim() || undefined, sortOrder: sr.orders[i], venueLat: m.venueLat, venueLng: m.venueLng, venueMapUrl: m.venueMapUrl });
  }
  return out;
}

function deriveBrideGroom(people, fallbackBride, fallbackGroom) {
  return {
    bride: people.find(p => p.role === 'bride')?.name || fallbackBride || people[0]?.name || '',
    groom: people.find(p => p.role === 'groom')?.name || fallbackGroom || people[1]?.name || '',
  };
}

function personPayload(people, schema) {
  return people.filter(p => p.name?.trim()).map((p, i) => ({ role: p.role, name: p.name, photoUrl: p.photoUrl || null, sortOrder: i }));
}

function cfPayload(customFields, schema) {
  return customFields.filter(c => c.value?.trim()).map(c => ({
    key: c.key, value: c.value, type: schema?.customFields?.find(s => s.key === c.key)?.type || 'text',
  }));
}

// ── Shared sub-components ────────────────────────────────────────────────────

const CARD = { background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 10, border: '1px solid var(--border-subtle)' };
const PLUS = { width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border-gold)', background: 'var(--bg-surface)', color: 'var(--gold)', fontSize: '1.35rem', fontWeight: 500, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' };
const SEC = { fontSize: '0.85rem', fontWeight: 600 };
const HINT = { fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 };

function normalizeMediaSlots(fullSchema) {
  const list = fullSchema?.mediaSlots;
  if (!Array.isArray(list) || list.length === 0) return null;
  return list
    .filter((s) => s && String(s.key || '').trim())
    .map((s) => ({
      key: String(s.key).trim(),
      label: s.label || s.key,
      type: s.type === 'music' ? 'music' : s.type === 'video' ? 'video' : 'photo',
      multiple: !!s.multiple,
      max: typeof s.max === 'number' && s.max > 0 ? s.max : s.multiple ? 24 : 1,
      accept:
        typeof s.accept === 'string' && s.accept
          ? s.accept
          : s.type === 'music'
            ? 'audio/*'
            : s.type === 'video'
              ? 'video/*'
              : 'image/*',
      allowUrl: s.allowUrl !== false,
    }));
}

function AdminMediaSlotCard({ userId, eventId, slot, slotItems, refreshMedia, onRemoveRequest, toast }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  async function uploadFile(file, cap) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('slotKey', slot.key);
    fd.append('type', slot.type);
    if (cap) fd.append('caption', cap);
    await api.users.uploadEventMedia(userId, eventId, fd);
  }

  async function onPickFiles(e) {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    if (!files.length) return;
    const toAdd = slot.multiple ? files : files.slice(0, 1);
    const room = slot.max - slotItems.length;
    if (room <= 0) {
      toast('This section is full — remove an item first', 'error');
      return;
    }
    const batch = toAdd.slice(0, room);
    setBusy(true);
    try {
      for (const f of batch) {
        await uploadFile(f, caption.trim() || undefined);
        await refreshMedia();
      }
      toast('Uploaded!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addUrl() {
    if (!url.trim()) {
      toast('Enter a URL or upload a file', 'error');
      return;
    }
    if (slotItems.length >= slot.max) {
      toast('This section is full — remove an item first', 'error');
      return;
    }
    setBusy(true);
    try {
      await api.users.uploadEventMedia(userId, eventId, {
        slotKey: slot.key,
        type: slot.type,
        url: url.trim(),
        caption: caption.trim() || undefined,
      });
      setUrl('');
      setCaption('');
      await refreshMedia();
      toast('Saved!', 'success');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ ...CARD, marginBottom: 10 }}>
      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>{slot.label}</div>
      <p style={{ ...HINT, marginBottom: 8 }}>
        {slot.multiple ? `Up to ${slot.max} files.` : 'Single file — new upload replaces the previous one.'}
      </p>
      {slotItems.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          {slotItems.map((m) => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                <span style={{ fontWeight: 600 }}>{m.type}</span>
                {m.caption ? ` — ${m.caption}` : ''}
                <div style={{ color: 'var(--text-muted)' }}>{m.url}</div>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveRequest(m)} style={{ color: 'var(--red)', flexShrink: 0 }}>Remove</Button>
            </div>
          ))}
        </div>
      )}
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label className="form-label">Upload from device</label>
        <input
          type="file"
          className="form-input"
          accept={slot.accept}
          multiple={slot.multiple}
          disabled={busy || slotItems.length >= slot.max}
          onChange={onPickFiles}
        />
      </div>
      {slot.allowUrl && (
        <div className="form-group" style={{ marginBottom: 8 }}>
          <label className="form-label">Or paste URL</label>
          <input className="form-input" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} disabled={busy || slotItems.length >= slot.max} />
        </div>
      )}
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label className="form-label">Caption (optional)</label>
        <input className="form-input" value={caption} onChange={(e) => setCaption(e.target.value)} disabled={busy} />
      </div>
      {slot.allowUrl && (
        <Button type="button" size="sm" variant="primary" disabled={busy || slotItems.length >= slot.max} onClick={addUrl}>
          {busy ? '…' : 'Add from URL'}
        </Button>
      )}
    </div>
  );
}

function PeopleFields({ schema, people, updPerson, brideName, setBN, groomName, setGN }) {
  if (schema?.people?.length) {
    return schema.people.map(sp => {
      const p = people.find(x => x.role === sp.role) || { name: '', photoUrl: '' };
      return (<div key={sp.role} style={CARD}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>{sp.label || sp.role} {sp.required && <span className="req">*</span>}</div>
        <div className="form-row">
          <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Name</label>
            <input className="form-input" value={p.name} onChange={e => updPerson(sp.role, 'name', e.target.value)} placeholder={sp.label || sp.role} /></div>
          {sp.photo && <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Photo URL</label>
            <input className="form-input" value={p.photoUrl || ''} onChange={e => updPerson(sp.role, 'photoUrl', e.target.value)} placeholder="https://..." /></div>}
        </div></div>);
    });
  }
  return (<div className="form-row">
    <div className="form-group"><label className="form-label">Host / Person 1</label><input className="form-input" value={brideName} onChange={e => setBN(e.target.value)} placeholder="Optional" /></div>
    <div className="form-group"><label className="form-label">Host / Person 2</label><input className="form-input" value={groomName} onChange={e => setGN(e.target.value)} placeholder="Optional" /></div>
  </div>);
}

function CFFields({ schema, customFields, updCF }) {
  const fields = schema?.customFields;
  if (!fields?.length && !customFields?.length) return null;
  const list = fields?.length ? fields : customFields.map(c => ({ key: c.key, label: c.key, type: 'text', required: false }));
  return (<>
    <hr className="divider" style={{ margin: '16px 0' }} />
    <div style={{ marginBottom: 8 }}><span style={SEC}>Custom Fields</span></div>
    {list.map(sf => {
      const cf = customFields.find(c => c.key === sf.key) || { value: '' };
      return (<div key={sf.key} className="form-group" style={{ marginBottom: 10 }}>
        <label className="form-label">{sf.label || sf.key} {sf.required && <span className="req">*</span>}</label>
        {sf.type === 'textarea' || sf.type === 'html'
          ? <textarea className="form-textarea" rows={3} value={cf.value} onChange={e => updCF(sf.key, e.target.value)} placeholder={sf.label || sf.key} />
          : <input className="form-input" type={sf.type === 'number' ? 'number' : 'text'} value={cf.value} onChange={e => updCF(sf.key, e.target.value)} placeholder={sf.label || sf.key} />}
      </div>);
    })}
  </>);
}

function FnBlock({ functions, setFns, schema, withPartial, mkRow }) {
  const ins = i => setFns(p => { const m = Math.max(...p.map(f => Number(f.sortOrder) || 0), -1); const n = [...p]; n.splice(i + 1, 0, mkRow(m + 1)); return n; });
  const rm = i => setFns(p => p.length <= 1 ? p : p.filter((_, j) => j !== i));
  const upd = (i, k, v) => setFns(p => p.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const en = k => fnEnabled(schema, k);
  return functions.map((fn, i) => (
    <div key={fn.id || fn._cid || i} style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Function {i + 1}</span>
        {functions.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => rm(i)} style={{ color: 'var(--red)' }}>Remove</Button>}
      </div>
      <div className="form-row">
        <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Name</label>
          <input className="form-input" value={fn.name} onChange={e => upd(i, 'name', e.target.value)} placeholder="e.g. Wedding ceremony" /></div>
        <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Date</label>
          <input className="form-input" type="date" value={fn.date ? String(fn.date).split('T')[0] : ''} onChange={e => upd(i, 'date', e.target.value)} /></div>
      </div>
      {(en('venueName') || en('venueAddress')) && <div className="form-row">
        {en('venueName') && <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Venue</label><input className="form-input" value={fn.venueName || ''} onChange={e => upd(i, 'venueName', e.target.value)} /></div>}
        {en('venueAddress') && <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Address</label><input className="form-input" value={fn.venueAddress || ''} onChange={e => upd(i, 'venueAddress', e.target.value)} /></div>}
      </div>}
      {(en('time') || en('dressCode')) && <div className="form-row">
        {en('time') && <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Time</label><input className="form-input" value={fn.startTime || ''} onChange={e => upd(i, 'startTime', e.target.value)} placeholder="7:00 PM" /></div>}
        {en('dressCode') && <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Dress code</label><input className="form-input" value={fn.dressCode || ''} onChange={e => upd(i, 'dressCode', e.target.value)} /></div>}
      </div>}
      <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Sort order</label>
        <input className="form-input" type="number" min={0} step={1} value={fn.sortOrder === '' || fn.sortOrder == null ? '' : String(fn.sortOrder)}
          onChange={e => { const v = e.target.value; upd(i, 'sortOrder', v === '' ? '' : (Number.isNaN(parseInt(v, 10)) ? '' : parseInt(v, 10))); }} placeholder="Auto (0, 1, 2…)" /></div>
      <div className="form-group" style={{ marginBottom: 8 }}><label className="form-label">Google Maps link</label>
        <input className="form-input" value={fn.mapsInput || ''} onChange={e => upd(i, 'mapsInput', e.target.value)} placeholder="maps.app.goo.gl/… or 19.076, 72.877" /></div>
      {withPartial && <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', cursor: 'pointer' }}>
        <input type="checkbox" checked={!!fn.includePartial} onChange={e => upd(i, 'includePartial', e.target.checked)} /> Include in <strong>partial</strong> invitation
      </label>}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border-subtle)' }}>
        <button type="button" onClick={() => ins(i)} style={PLUS}>+</button>
      </div>
    </div>
  ));
}

// ── AdminInviteModal (schema-driven generation form) ─────────────────────────

export function AdminInviteModal({ userId, user, onClose, onSuccess }) {
  const toast = useToast();
  const payments = user.payments || [];
  const has = payments.length > 0;
  const [templates, setTemplates] = useState([]);
  const [paymentId, setPaymentId] = useState(has ? payments[0].id : '');
  const [templateId, setTplId] = useState('');
  const [schema, setSchema] = useState(null);
  const [people, setPeople] = useState([]);
  const [customFields, setCF] = useState([]);
  const [brideName, setBN] = useState('');
  const [groomName, setGN] = useState('');
  const [eventType, setET] = useState('wedding');
  const [community, setCom] = useState('universal');
  const [language, setLang] = useState('en');
  const [slugFull, setSF] = useState('');
  const [slugSubset, setSS] = useState('');
  const [functions, setFns] = useState([{ name: '', date: new Date().toISOString().slice(0, 10), startTime: '', venueName: '', venueAddress: '', dressCode: '', sortOrder: 0, mapsInput: '', includePartial: true }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!has) api.templates.list({ status: 'active', limit: 200 }).then(r => { setTemplates(r.data || []); if (r.data?.[0]) setTplId(r.data[0].id); }).catch(e => toast(e.message, 'error')); }, [has]); // eslint-disable-line

  useEffect(() => {
    let tplId = templateId;
    if (has && paymentId) { const pay = payments.find(p => p.id === paymentId); tplId = pay?.templateId || ''; }
    if (!tplId) { setSchema(null); setPeople([]); setCF([]); return; }
    api.templates.get(tplId).then(res => {
      const fs = res.data?.fieldSchema || null;
      setSchema(fs);
      setPeople(fs?.people?.length ? fs.people.map(p => ({ role: p.role, name: '', photoUrl: '' })) : []);
      setCF(fs?.customFields?.length ? fs.customFields.map(c => ({ key: c.key, value: '' })) : []);
    }).catch(() => setSchema(null));
  }, [paymentId, templateId, has]); // eslint-disable-line

  const updP = (role, k, v) => setPeople(prev => { const i = prev.findIndex(p => p.role === role); if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; } return [...prev, { role, name: '', photoUrl: '', [k]: v }]; });
  const updCF = (key, v) => setCF(prev => { const i = prev.findIndex(c => c.key === key); if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], value: v }; return n; } return [...prev, { key, value: v }]; });

  async function handleSubmit() {
    if (has && !paymentId) { toast('Select a purchase', 'error'); return; }
    if (!has && !templateId) { toast('Select a template', 'error'); return; }
    if (schema?.people?.length) for (const sp of schema.people) { if (sp.required && !people.find(p => p.role === sp.role)?.name?.trim()) { toast(`${sp.label || sp.role} is required`, 'error'); return; } }
    if (schema?.customFields?.length) for (const sf of schema.customFields) { if (sf.required && !customFields.find(c => c.key === sf.key)?.value?.trim()) { toast(`${sf.label || sf.key} is required`, 'error'); return; } }
    const fnP = buildFnPayload(functions, toast);
    if (!fnP) return;
    const subIdx = []; functions.forEach((fn, i) => { if (fn.includePartial) subIdx.push(i); });
    if (subIdx.length < 1) { toast('Select at least one function for the partial invitation', 'error'); return; }
    const d = deriveBrideGroom(people, brideName, groomName);
    setSaving(true);
    try {
      await api.users.generateInvites(userId, {
        ...(has ? { paymentId } : { templateId }), brideName: d.bride.trim() || undefined, groomName: d.groom.trim() || undefined,
        eventType, community, language, ...(slugFull.trim() ? { slugFull: slugFull.trim() } : {}), ...(slugSubset.trim() ? { slugSubset: slugSubset.trim() } : {}),
        functions: fnP, subsetFunctionIndices: subIdx, people: personPayload(people, schema), customFields: cfPayload(customFields, schema),
      });
      onSuccess();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  const mkRow = (so) => ({ name: '', date: new Date().toISOString().slice(0, 10), startTime: '', venueName: '', venueAddress: '', dressCode: '', sortOrder: so, mapsInput: '', includePartial: true });

  return (
    <Modal title="Invitation generation form" size="lg" onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" loading={saving} onClick={handleSubmit}>Create two invitations</Button>
    </>}>
      <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 16 }}>
        Creates two invitations: one with <strong>all</strong> functions, one with only the checked &quot;partial&quot; ones.
      </p>
      {has ? (
        <div className="form-group"><label className="form-label">Purchase (template source)</label>
          <select className="form-select" value={paymentId} onChange={e => setPaymentId(e.target.value)}>{payments.map(p => <option key={p.id} value={p.id}>{p.template?.name || 'Template'} — {formatCurrency(p.amount)} — {p.status}</option>)}</select></div>
      ) : (
        <div className="form-group"><label className="form-label">Template</label>
          <select className="form-select" value={templateId} onChange={e => setTplId(e.target.value)}>{templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.community}</option>)}</select>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>No purchases — pick an active template.</p></div>
      )}
      <div className="form-row-3">
        <div className="form-group"><label className="form-label">Event type</label><input className="form-input" value={eventType} onChange={e => setET(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Community</label>
          <select className="form-select" value={community} onChange={e => setCom(e.target.value)}>{['hindu', 'muslim', 'sikh', 'christian', 'jain', 'parsi', 'universal'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Language</label>
          <select className="form-select" value={language} onChange={e => setLang(e.target.value)}>{['en', 'hi', 'gu', 'ur', 'pa', 'mr', 'kn', 'te', 'ml', 'ta'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">URL slug — full (optional)</label><input className="form-input" value={slugFull} onChange={e => setSF(e.target.value)} placeholder="Auto" /></div>
        <div className="form-group"><label className="form-label">URL slug — partial (optional)</label><input className="form-input" value={slugSubset} onChange={e => setSS(e.target.value)} placeholder="Auto" /></div>
      </div>
      <hr className="divider" style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 8 }}><span style={SEC}>People</span></div>
      <PeopleFields schema={schema} people={people} updPerson={updP} brideName={brideName} setBN={setBN} groomName={groomName} setGN={setGN} />
      <CFFields schema={schema} customFields={customFields} updCF={updCF} />
      <hr className="divider" style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 8 }}><span style={SEC}>Functions / events</span></div>
      <p style={HINT}>Sort order must be unique. Paste Google Maps share link for directions.</p>
      <FnBlock functions={functions} setFns={setFns} schema={schema} withPartial mkRow={mkRow} />
    </Modal>
  );
}

// ── EditEventModal (schema-driven edit form) ─────────────────────────────────

export function EditEventModal({ userId, event: ev, onClose, onSuccess }) {
  const toast = useToast();
  const cidRef = useRef(0);
  const nextCid = () => { cidRef.current += 1; return `new-${cidRef.current}`; };
  const schema = useMemo(() => {
    const fs = ev.template?.fieldSchema ?? null;
    if (fs == null) return null;
    if (typeof fs === 'string') {
      try { return JSON.parse(fs); } catch { return null; }
    }
    return fs;
  }, [ev.template?.fieldSchema]);

  const [brideName, setBN] = useState(ev.brideName || '');
  const [groomName, setGN] = useState(ev.groomName || '');
  const [eventType, setET] = useState(ev.eventType || 'wedding');
  const [community, setCom] = useState(ev.community || 'universal');
  const [slug, setSlug] = useState(ev.slug || '');
  const [language, setLang] = useState(ev.language || 'en');
  const [instagramUrl, setInstagramUrl] = useState(ev.instagramUrl || '');
  const [socialYoutubeUrl, setSocialYoutubeUrl] = useState(ev.socialYoutubeUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(ev.websiteUrl || '');
  const [rsvpEnabled, setRsvpEnabled] = useState(ev.rsvpEnabled !== false);
  const [guestNotesEnabled, setGuestNotesEnabled] = useState(ev.guestNotesEnabled !== false);
  const [people, setPeople] = useState(() => {
    if (schema?.people?.length) {
      return schema.people.map(sp => {
        const x = ev.people?.find(p => p.role === sp.role);
        return { role: sp.role, name: x?.name || '', photoUrl: x?.photoUrl || '' };
      });
    }
    return ev.people?.length ? ev.people.map(p => ({ role: p.role, name: p.name, photoUrl: p.photoUrl || '' })) : [];
  });
  const [customFields, setCF] = useState(() => {
    if (schema?.customFields?.length) {
      return schema.customFields.map(sf => {
        const x = ev.customFields?.find(cf => cf.fieldKey === sf.key);
        return { key: sf.key, value: x?.fieldValue || '' };
      });
    }
    return ev.customFields?.length ? ev.customFields.map(cf => ({ key: cf.fieldKey, value: cf.fieldValue || '' })) : [];
  });
  const [functions, setFns] = useState(() => {
    if (ev.functions?.length) return ev.functions.map(f => ({ ...f, mapsInput: (f.venueMapUrl && String(f.venueMapUrl).trim()) || formatLatLngHint(f.venueLat, f.venueLng), dressCode: f.dressCode || '', sortOrder: typeof f.sortOrder === 'number' ? f.sortOrder : Number(f.sortOrder) || 0 }));
    return [{ _cid: nextCid(), name: '', date: new Date().toISOString().slice(0, 10), venueName: '', venueAddress: '', dressCode: '', sortOrder: 0, mapsInput: '', startTime: '' }];
  });
  const [saving, setSaving] = useState(false);

  const [media, setMedia] = useState(() => ev.media || []);
  const [deletingMedia, setDeletingMedia] = useState(null);
  const [admMediaForm, setAdmMediaForm] = useState({ type: 'photo', url: '', caption: '', file: null });
  const [savingAdmMedia, setSavingAdmMedia] = useState(false);

  const normalizedSlots = useMemo(() => normalizeMediaSlots(schema), [schema]);

  useEffect(() => {
    setMedia(ev.media || []);
  }, [ev.id, ev.media]);

  useEffect(() => {
    setInstagramUrl(ev.instagramUrl || '');
    setSocialYoutubeUrl(ev.socialYoutubeUrl || '');
    setWebsiteUrl(ev.websiteUrl || '');
    setRsvpEnabled(ev.rsvpEnabled !== false);
    setGuestNotesEnabled(ev.guestNotesEnabled !== false);
  }, [ev.id, ev.instagramUrl, ev.socialYoutubeUrl, ev.websiteUrl, ev.rsvpEnabled, ev.guestNotesEnabled]);

  async function refreshAdminMedia() {
    const r = await api.users.get(userId);
    const found = r.data?.events?.find((e) => e.id === ev.id);
    if (found?.media) setMedia(found.media);
  }

  async function removeAdminMedia(mid) {
    await api.users.deleteEventMedia(userId, ev.id, mid);
    await refreshAdminMedia();
    setDeletingMedia(null);
  }

  async function addAdminLegacyMedia() {
    if (admMediaForm.file) {
      setSavingAdmMedia(true);
      try {
        const fd = new FormData();
        fd.append('file', admMediaForm.file);
        fd.append('type', admMediaForm.type);
        if (String(admMediaForm.caption || '').trim()) fd.append('caption', String(admMediaForm.caption).trim());
        await api.users.uploadEventMedia(userId, ev.id, fd);
        setAdmMediaForm({ type: 'photo', url: '', caption: '', file: null });
        await refreshAdminMedia();
        toast('Media added', 'success');
      } catch (err) { toast(err.message, 'error'); } finally { setSavingAdmMedia(false); }
      return;
    }
    if (!String(admMediaForm.url || '').trim()) { toast('Choose a file or enter a URL', 'error'); return; }
    setSavingAdmMedia(true);
    try {
      await api.users.uploadEventMedia(userId, ev.id, {
        type: admMediaForm.type,
        url: String(admMediaForm.url).trim(),
        caption: String(admMediaForm.caption || '').trim() || undefined,
      });
      setAdmMediaForm({ type: 'photo', url: '', caption: '', file: null });
      await refreshAdminMedia();
      toast('Media added', 'success');
    } catch (err) { toast(err.message, 'error'); } finally { setSavingAdmMedia(false); }
  }

  const updP = (role, k, v) => setPeople(prev => { const i = prev.findIndex(p => p.role === role); if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], [k]: v }; return n; } return [...prev, { role, name: '', photoUrl: '', [k]: v }]; });
  const updCF = (key, v) => setCF(prev => { const i = prev.findIndex(c => c.key === key); if (i >= 0) { const n = [...prev]; n[i] = { ...n[i], value: v }; return n; } return [...prev, { key, value: v }]; });

  async function handle() {
    const fnP = buildFnPayload(functions, toast);
    if (!fnP) return;
    const bodyFns = functions.map((fn, i) => ({ ...(fn.id ? { id: fn.id } : {}), ...fnP[i] }));
    const d = deriveBrideGroom(people, brideName, groomName);
    setSaving(true);
    try {
      await api.users.updateEventData(userId, {
        eventId: ev.id, brideName: d.bride, groomName: d.groom, eventType, community, slug, language,
        instagramUrl: instagramUrl.trim() || null,
        socialYoutubeUrl: socialYoutubeUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        rsvpEnabled,
        guestNotesEnabled,
        functions: bodyFns, people: personPayload(people, schema), customFields: cfPayload(customFields, schema),
      });
      onSuccess();
    } catch (err) { toast(err.message, 'error'); } finally { setSaving(false); }
  }

  const mkRow = (so) => ({ _cid: nextCid(), name: '', date: new Date().toISOString().slice(0, 10), venueName: '', venueAddress: '', dressCode: '', sortOrder: so, mapsInput: '', startTime: '' });

  return (
    <Modal title="Edit invitation data" size="lg" onClose={onClose} footer={<>
      <Button variant="secondary" onClick={onClose}>Cancel</Button>
      <Button variant="primary" loading={saving} onClick={handle}>Save changes</Button>
    </>}>
      <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>Edit the invitation data. Admin can edit even if names are frozen.</p>
      <div style={{ marginBottom: 8 }}><span style={SEC}>People</span></div>
      <PeopleFields schema={schema} people={people} updPerson={updP} brideName={brideName} setBN={setBN} groomName={groomName} setGN={setGN} />
      <hr className="divider" style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 8 }}><span style={SEC}>Social links & guest features</span></div>
      <p style={HINT}>Icons and layout come from the template; hosts set URLs and toggles here.</p>
      <div className="form-group">
        <label className="form-label">Instagram URL</label>
        <input className="form-input" type="url" value={instagramUrl} onChange={(e) => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/…" />
      </div>
      <div className="form-group">
        <label className="form-label">YouTube URL</label>
        <input className="form-input" type="url" value={socialYoutubeUrl} onChange={(e) => setSocialYoutubeUrl(e.target.value)} placeholder="https://youtube.com/…" />
      </div>
      <div className="form-group">
        <label className="form-label">Website</label>
        <input className="form-input" type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://…" />
      </div>
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={rsvpEnabled} onChange={(e) => setRsvpEnabled(e.target.checked)} />
          RSVP enabled on invite
        </label>
      </div>
      <div className="form-group">
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={guestNotesEnabled} onChange={(e) => setGuestNotesEnabled(e.target.checked)} />
          Guest notes / wishes enabled
        </label>
      </div>
      <CFFields schema={schema} customFields={customFields} updCF={updCF} />
      <hr className="divider" style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 8 }}><span style={SEC}>Photos & music</span></div>
      <p style={HINT}>Uploads apply immediately (no need to press Save). Sections follow the template <strong>Media slots</strong> in the template editor.</p>
      {normalizedSlots ? (
        <>
          {normalizedSlots.map((slot) => (
            <AdminMediaSlotCard
              key={slot.key}
              userId={userId}
              eventId={ev.id}
              slot={slot}
              slotItems={media.filter((m) => m.slotKey === slot.key).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))}
              refreshMedia={refreshAdminMedia}
              onRemoveRequest={(m) => setDeletingMedia(m)}
              toast={toast}
            />
          ))}
          {media.some((m) => !m.slotKey) && (
            <div style={{ ...CARD, marginTop: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Earlier uploads (no section)</div>
              {media.filter((m) => !m.slotKey).map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}><strong>{m.type}</strong><div style={{ color: 'var(--text-muted)' }}>{m.url}</div></div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDeletingMedia(m)} style={{ color: 'var(--red)' }}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={CARD}>
          <p style={{ ...HINT, marginBottom: 10 }}>This template has no media slots yet — use the simple form below, or add <code>mediaSlots</code> in the template field schema.</p>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={admMediaForm.type} onChange={(e) => setAdmMediaForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="photo">Photo</option>
                <option value="music">Music</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">File</label>
              <input
                type="file"
                className="form-input"
                accept={admMediaForm.type === 'music' ? 'audio/*' : admMediaForm.type === 'video' ? 'video/*' : 'image/*'}
                onChange={(e) => setAdmMediaForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Or URL</label>
            <input className="form-input" placeholder="https://..." value={admMediaForm.url} onChange={(e) => setAdmMediaForm((f) => ({ ...f, url: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Caption (optional)</label>
            <input className="form-input" value={admMediaForm.caption} onChange={(e) => setAdmMediaForm((f) => ({ ...f, caption: e.target.value }))} />
          </div>
          <Button type="button" size="sm" variant="primary" loading={savingAdmMedia} onClick={addAdminLegacyMedia}>Add media</Button>
          {media.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {media.map((m) => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}><strong>{m.type}</strong>{m.slotKey ? ` (${m.slotKey})` : ''}<div style={{ color: 'var(--text-muted)' }}>{m.url}</div></div>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setDeletingMedia(m)} style={{ color: 'var(--red)' }}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <hr className="divider" style={{ margin: '16px 0' }} />
      <div className="form-row">
        <div className="form-group"><label className="form-label">Event type</label><input className="form-input" value={eventType} onChange={e => setET(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Community</label>
          <select className="form-select" value={community} onChange={e => setCom(e.target.value)}>{['hindu', 'muslim', 'sikh', 'christian', 'jain', 'parsi', 'universal'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">URL slug</label><input className="form-input" value={slug} onChange={e => setSlug(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Language</label>
          <select className="form-select" value={language} onChange={e => setLang(e.target.value)}>{['en', 'hi', 'gu', 'ur', 'pa', 'mr', 'kn', 'te', 'ml', 'ta'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}</select></div>
      </div>
      <hr className="divider" style={{ margin: '16px 0' }} />
      <div style={{ marginBottom: 12 }}><span style={SEC}>Functions / events</span></div>
      <p style={HINT}>Add or remove functions; saving replaces the list. Sort order must be unique.</p>
      <FnBlock functions={functions} setFns={setFns} schema={schema} withPartial={false} mkRow={mkRow} />
      {deletingMedia && (
        <ConfirmModal
          title="Remove media"
          message="Remove this media item from the invitation?"
          onConfirm={() => removeAdminMedia(deletingMedia.id)}
          onCancel={() => setDeletingMedia(null)}
        />
      )}
    </Modal>
  );
}
