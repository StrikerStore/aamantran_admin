import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';
import { getInviteBaseUrl } from '../lib/config';
import { formatCurrency } from '../lib/utils';
import { COMMUNITIES, EVENT_TYPE_GROUPS, LANGUAGES } from '../lib/constants';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

// ── Default function field config ────────────────────────────────────────────
const DEFAULT_FUNCTION_FIELDS = {
  name:         { label: 'Event Name',       enabled: true,  required: true  },
  date:         { label: 'Date',             enabled: true,  required: true  },
  time:         { label: 'Time',             enabled: true,  required: false },
  venueName:    { label: 'Venue',            enabled: true,  required: false },
  venueAddress: { label: 'Venue Address',    enabled: false, required: false },
  venueMapUrl:  { label: 'Google Maps Link', enabled: false, required: false },
  dressCode:    { label: 'Dress Code',       enabled: false, required: false },
};

function emptyPersonRow() {
  return { role: '', label: '', demoName: '', required: false, photo: false };
}

function emptyCustomFieldRow() {
  return { key: '', label: '', type: 'text', demoValue: '', required: false };
}

function emptyMediaSlotRow() {
  return { key: '', label: '', type: 'photo', multiple: false, max: 4, accept: '', allowUrl: true, demoFiles: [], pendingDemoUploads: [] };
}

/** Same normalization as buildFieldSchema media slot keys */
function normalizeMediaSlotKey(key) {
  return String(key || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function makePendingUploadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function emptyDemoFunctionRow(sortOrder = 0) {
  return { name: '', date: '', time: '', venueName: '', venueAddress: '', venueMapUrl: '', dressCode: '', sortOrder };
}

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

// ── Helpers to humanize role names ───────────────────────────────────────────
function humanizeRole(role) {
  if (!role) return '';
  return role
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default function TemplateForm() {
  const navigate  = useNavigate();
  const toast     = useToast();
  const { id }    = useParams();
  const isEdit    = Boolean(id);

  const zipRef          = useRef(null);
  const desktopThumbRef = useRef(null);
  const mobileThumbRef  = useRef(null);
  const pendingDemoObjectUrlsRef = useRef(new Set());

  // ── Section 1: Template metadata ──
  const [slug,          setSlug]          = useState('');
  const [name,          setName]          = useState('');
  const [community,     setCommunity]     = useState('hindu');
  const [bestFor,       setBestFor]       = useState([]);
  const [languages,     setLanguages]     = useState(['en']);
  const [style,         setStyle]         = useState('');
  const [colourPalette, setColourPalette] = useState('');
  const [animations,    setAnimations]    = useState('');
  const [price,         setPrice]         = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [gstPercent,    setGstPercent]    = useState('0');
  const [aboutText,     setAboutText]     = useState('');
  const [zipFile,       setZipFile]       = useState(null);
  const [existingZipMeta, setExistingZipMeta] = useState(null);
  const [desktopThumbFile,    setDesktopThumbFile]    = useState(null);
  const [mobileThumbFile,     setMobileThumbFile]     = useState(null);
  const [desktopThumbPreview, setDesktopThumbPreview] = useState(null);
  const [mobileThumbPreview,  setMobileThumbPreview]  = useState(null);
  const [desktopThumbFallback, setDesktopThumbFallback] = useState(null);
  const [mobileThumbFallback, setMobileThumbFallback] = useState(null);

  // ── Section 2: Field Schema (people, custom fields, function fields) ──
  const [people, setPeople]               = useState([]);
  const [customFields, setCustomFields]   = useState([]);
  const [mediaSlots, setMediaSlots]       = useState([]);
  const [functionFields, setFunctionFields] = useState({ ...DEFAULT_FUNCTION_FIELDS });

  // ── Section 3: Demo data (values for preview) ──
  const [demoFunctions, setDemoFunctions] = useState([emptyDemoFunctionRow(0)]);
  const [demoLanguage, setDemoLanguage]   = useState('en');
  const [demoPhotoUrls, setDemoPhotoUrls] = useState('');
  const [demoMusicUrl, setDemoMusicUrl]   = useState('');

  const [loading, setLoading] = useState(isEdit);
  const [saving,  setSaving]  = useState(false);
  const [demoUrl, setDemoUrl] = useState(null);

  useLayoutEffect(() => {
    setTopbarTitle(isEdit ? 'Edit Template' : 'Add Template');
  }, [isEdit]);

  useEffect(() => () => {
    pendingDemoObjectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    pendingDemoObjectUrlsRef.current.clear();
  }, []);

  // ── Load existing template for edit ──
  useEffect(() => {
    if (!isEdit) return;
    api.templates.get(id).then(res => {
      const t = res.data;
      setSlug(t.slug || '');
      setName(t.name);
      setCommunity(t.community);
      setBestFor(t.bestFor ? t.bestFor.split(', ').filter(Boolean) : []);
      setLanguages(t.languages ? t.languages.split(', ').filter(Boolean) : ['en']);
      setStyle(t.style || '');
      setColourPalette(t.colourPalette || '');
      setAnimations(t.animations || '');
      setPrice(String(t.price / 100));
      setOriginalPrice(t.originalPrice ? String(t.originalPrice / 100) : '');
      setGstPercent(String(t.gstPercent ?? 0));
      setAboutText(t.aboutText || '');
      if (t.folderPath) {
        setExistingZipMeta({
          folderPath: t.folderPath,
          updatedAt: t.updatedAt || t.createdAt || null,
          desktopEntryFile: t.desktopEntryFile || null,
          mobileEntryFile: t.mobileEntryFile || null,
        });
      }
      if (t.desktopThumbnailUrl || t.thumbnailUrl) {
        setDesktopThumbPreview(resolvePublicUrl(t.desktopThumbnailUrl || t.thumbnailUrl));
        setDesktopThumbFallback(
          t.thumbnailUrl && t.thumbnailUrl !== t.desktopThumbnailUrl ? resolvePublicUrl(t.thumbnailUrl) : null
        );
      }
      if (t.mobileThumbnailUrl || t.desktopThumbnailUrl || t.thumbnailUrl) {
        setMobileThumbPreview(resolvePublicUrl(t.mobileThumbnailUrl || t.desktopThumbnailUrl || t.thumbnailUrl));
        setMobileThumbFallback(
          (t.desktopThumbnailUrl && t.desktopThumbnailUrl !== t.mobileThumbnailUrl ? resolvePublicUrl(t.desktopThumbnailUrl) : null) ||
          (t.thumbnailUrl && t.thumbnailUrl !== t.mobileThumbnailUrl ? resolvePublicUrl(t.thumbnailUrl) : null) ||
          null
        );
      }

      // Load fieldSchema if exists
      const fs = t.fieldSchema;
      if (fs) {
        if (Array.isArray(fs.people) && fs.people.length) {
          const demoPeople = t.demoData?.people || [];
          setPeople(fs.people.map(p => {
            const dp = demoPeople.find(d => d.role === p.role);
            return { role: p.role, label: p.label || '', required: !!p.required, photo: !!p.photo, demoName: dp?.name || '' };
          }));
        }
        if (Array.isArray(fs.customFields) && fs.customFields.length) {
          const demoCf = t.demoData?.customFields || [];
          setCustomFields(fs.customFields.map(cf => {
            const dc = demoCf.find(d => d.key === cf.key);
            return { key: cf.key, label: cf.label || '', type: cf.type || 'text', required: !!cf.required, demoValue: dc?.value || '' };
          }));
        }
        if (fs.functionFields) {
          setFunctionFields(prev => {
            const merged = { ...prev };
            for (const [k, v] of Object.entries(fs.functionFields)) {
              if (merged[k]) merged[k] = { ...merged[k], ...v };
            }
            return merged;
          });
        }
        if (Array.isArray(fs.mediaSlots) && fs.mediaSlots.length) {
          const demoMedia = t.demoData?.mediaSlotDemoUrls || {};
          setMediaSlots(fs.mediaSlots.map((s) => ({
            key: s.key || '',
            label: s.label || '',
            type: s.type === 'music' ? 'music' : s.type === 'video' ? 'video' : 'photo',
            multiple: !!s.multiple,
            max: s.max != null ? Number(s.max) : (s.multiple ? 6 : 1),
            accept: s.accept || '',
            allowUrl: s.allowUrl !== false,
            demoFiles: Array.isArray(demoMedia[s.key]) ? demoMedia[s.key] : (demoMedia[s.key] ? [demoMedia[s.key]] : []),
            pendingDemoUploads: [],
          })));
        } else {
          setMediaSlots([]);
        }
      } else if (t.demoData) {
        // Backward compat: auto-populate people from old brideName/groomName
        const autoPeople = [];
        if (t.demoData.brideName) autoPeople.push({ role: 'bride', label: 'Bride Name', demoName: t.demoData.brideName, required: true, photo: false });
        if (t.demoData.groomName) autoPeople.push({ role: 'groom', label: 'Groom Name', demoName: t.demoData.groomName, required: true, photo: false });
        if (autoPeople.length) setPeople(autoPeople);
      }

      // Load demo functions
      if (t.demoData?.functions?.length) {
        setDemoFunctions(t.demoData.functions.map(fn => ({
          name: fn.name, date: fn.date, time: fn.time,
          venueName: fn.venueName || '', venueAddress: fn.venueAddress || '',
          venueMapUrl: fn.venueMapUrl || '', dressCode: fn.dressCode || '', sortOrder: fn.sortOrder,
        })));
      }
      if (t.demoData) {
        setDemoLanguage(t.demoData.language || 'en');
        setDemoPhotoUrls(Array.isArray(t.demoData.photoUrls) ? t.demoData.photoUrls.join(', ') : '');
        setDemoMusicUrl(t.demoData.musicUrl || '');
      }
    }).catch(err => toast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, [id, isEdit, toast]);

  // ── People helpers ──
  function addPerson()       { setPeople(prev => [...prev, emptyPersonRow()]); }
  function removePerson(i)   { setPeople(prev => prev.filter((_, idx) => idx !== i)); }
  function updatePerson(i, key, val) {
    setPeople(prev => prev.map((p, idx) => {
      if (idx !== i) return p;
      const updated = { ...p, [key]: val };
      // Auto-fill label from role if label is empty
      if (key === 'role' && !p.label) updated.label = humanizeRole(val);
      return updated;
    }));
  }

  // ── Custom field helpers ──
  function addCustomField()       { setCustomFields(prev => [...prev, emptyCustomFieldRow()]); }
  function removeCustomField(i)   { setCustomFields(prev => prev.filter((_, idx) => idx !== i)); }

  function addMediaSlot()         { setMediaSlots(prev => [...prev, emptyMediaSlotRow()]); }
  function removeMediaSlot(i) {
    setMediaSlots((prev) => {
      const row = prev[i];
      row?.pendingDemoUploads?.forEach((p) => revokePendingDemoPreview(p.objectUrl));
      return prev.filter((_, idx) => idx !== i);
    });
  }
  function updateMediaSlot(i, key, val) {
    setMediaSlots(prev => prev.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  }
  function revokePendingDemoPreview(url) {
    if (!url) return;
    URL.revokeObjectURL(url);
    pendingDemoObjectUrlsRef.current.delete(url);
  }
  function removePendingDemoUpload(slotIndex, pendingId) {
    setMediaSlots(prev => prev.map((row, idx) => {
      if (idx !== slotIndex) return row;
      const pendingDemoUploads = (row.pendingDemoUploads || []).filter((p) => {
        if (p.id === pendingId) {
          revokePendingDemoPreview(p.objectUrl);
          return false;
        }
        return true;
      });
      return { ...row, pendingDemoUploads };
    }));
  }
  function updateCustomField(i, key, val) {
    setCustomFields(prev => prev.map((cf, idx) => {
      if (idx !== i) return cf;
      const updated = { ...cf, [key]: val };
      if (key === 'key' && !cf.label) updated.label = humanizeRole(val);
      return updated;
    }));
  }

  // ── Function field toggle ──
  function toggleFunctionField(key, prop) {
    setFunctionFields(prev => ({
      ...prev,
      [key]: { ...prev[key], [prop]: !prev[key][prop] },
    }));
  }

  // ── Demo function helpers ──
  function addDemoFunction() {
    const maxSo = Math.max(...demoFunctions.map(f => f.sortOrder || 0), -1);
    setDemoFunctions(prev => [...prev, emptyDemoFunctionRow(maxSo + 1)]);
  }
  function removeDemoFunction(i) {
    setDemoFunctions(prev => prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i));
  }
  function updateDemoFunction(i, key, val) {
    setDemoFunctions(prev => prev.map((fn, idx) => idx === i ? { ...fn, [key]: val } : fn));
  }

  function toggleBestFor(item) {
    setBestFor(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item]);
  }
  function toggleLanguage(code) {
    setLanguages(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  }
  function handleDesktopThumbChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setDesktopThumbFile(file);
    setDesktopThumbPreview(URL.createObjectURL(file));
    setDesktopThumbFallback(null);
  }
  function handleMobileThumbChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setMobileThumbFile(file);
    setMobileThumbPreview(URL.createObjectURL(file));
    setMobileThumbFallback(null);
  }
  async function handleDeleteDesktopThumb(e) {
    e.stopPropagation();
    if (isEdit && id && desktopThumbPreview && !desktopThumbPreview.startsWith('blob:')) {
      try {
        await api.templates.deleteThumbnail(id, 'desktop');
      } catch (err) {
        toast(err.message || 'Failed to delete thumbnail', 'error');
        return;
      }
    }
    setDesktopThumbFile(null);
    setDesktopThumbPreview(null);
    setDesktopThumbFallback(null);
    if (desktopThumbRef.current) desktopThumbRef.current.value = '';
  }
  async function handleDeleteMobileThumb(e) {
    e.stopPropagation();
    if (isEdit && id && mobileThumbPreview && !mobileThumbPreview.startsWith('blob:')) {
      try {
        await api.templates.deleteThumbnail(id, 'mobile');
      } catch (err) {
        toast(err.message || 'Failed to delete thumbnail', 'error');
        return;
      }
    }
    setMobileThumbFile(null);
    setMobileThumbPreview(null);
    setMobileThumbFallback(null);
    if (mobileThumbRef.current) mobileThumbRef.current.value = '';
  }

  // ── Build payloads ──
  function buildFieldSchema() {
    return {
      people: people.filter(p => p.role).map(p => ({
        role: p.role, label: p.label || humanizeRole(p.role), required: !!p.required, photo: !!p.photo,
      })),
      customFields: customFields.filter(cf => cf.key).map(cf => ({
        key: cf.key, label: cf.label || humanizeRole(cf.key), type: cf.type || 'text', required: !!cf.required,
      })),
      mediaSlots: mediaSlots.filter((s) => String(s.key || '').trim()).map((s) => ({
        key: String(s.key).trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        label: s.label || s.key,
        type: s.type === 'music' ? 'music' : s.type === 'video' ? 'video' : 'photo',
        multiple: !!s.multiple,
        max: Math.max(1, Number(s.max) || (s.multiple ? 6 : 1)),
        ...(String(s.accept || '').trim() ? { accept: String(s.accept).trim() } : {}),
        allowUrl: s.allowUrl !== false,
      })),
      functionFields: { ...functionFields },
    };
  }

  function buildDemoPayload() {
    const bridePerson = people.find(p => p.role === 'bride');
    const groomPerson = people.find(p => p.role === 'groom');
    const photoUrls = demoPhotoUrls.split(',').map(s => s.trim()).filter(Boolean);

    // Build media slot demo URL map { ganesh: ["https://..."], background_music: ["https://..."] }
    const mediaSlotDemoUrls = {};
    mediaSlots.forEach(s => {
      if (s.key && s.demoFiles?.length) mediaSlotDemoUrls[s.key] = s.demoFiles;
    });

    return {
      bride_name:    bridePerson?.demoName || '',
      groom_name:    groomPerson?.demoName || '',
      wedding_date:  demoFunctions[0]?.date || '',
      venue_name:    demoFunctions[0]?.venueName || '',
      venue_address: demoFunctions[0]?.venueAddress || '',
      language:      demoLanguage,
      photo_urls:    photoUrls,
      music_url:     demoMusicUrl || null,
      media_slot_demo_urls: mediaSlotDemoUrls,
      people: people.filter(p => p.role).map(p => ({
        role: p.role, name: p.demoName || '', photo_url: '',
      })),
      custom_fields: customFields.filter(cf => cf.key).map(cf => ({
        key: cf.key, value: cf.demoValue || '',
      })),
      functions: demoFunctions.map((fn, i) => ({
        name: fn.name || `Event ${i + 1}`,
        date: fn.date,
        time: fn.time || '',
        venue_name: fn.venueName || '',
        venue_address: fn.venueAddress || '',
        venue_map_url: fn.venueMapUrl || '',
        dress_code: fn.dressCode || '',
        sort_order: fn.sortOrder ?? i,
      })),
      field_schema: buildFieldSchema(),
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (languages.length === 0) { toast('Select at least one language', 'error'); return; }

    setSaving(true);
    try {
      const demoPayload = buildDemoPayload();

      if (isEdit) {
        const fd = new FormData();
        fd.append('name',         name);
        fd.append('community',    community);
        fd.append('bestFor',      bestFor.join(', '));
        fd.append('languages',    languages.join(', '));
        fd.append('style',        style);
        fd.append('colourPalette', colourPalette);
        fd.append('animations',   animations);
        fd.append('price',        String(Math.round(Number(price) * 100)));
        fd.append('originalPrice', originalPrice ? String(Math.round(Number(originalPrice) * 100)) : '');
        fd.append('gstPercent',   String(Math.max(0, Number(gstPercent || 0))));
        fd.append('aboutText',    aboutText);
        if (desktopThumbFile) fd.append('desktopThumbnailImage', desktopThumbFile);
        if (mobileThumbFile) fd.append('mobileThumbnailImage', mobileThumbFile);

        await api.templates.update(id, fd);
        await api.templates.updateDemoData(id, demoPayload);

        if (zipFile) {
          const zfd = new FormData();
          zfd.append('templateZip', zipFile);
          await api.templates.updateFiles(id, zfd);
        }
        toast('Template updated', 'success');
        navigate('/templates');
      } else {
        if (!zipFile) { toast('Please upload a template ZIP file', 'error'); setSaving(false); return; }
        if (!desktopThumbFile || !mobileThumbFile) {
          toast('Please upload both desktop and mobile thumbnail images', 'error');
          setSaving(false);
          return;
        }
        for (const row of mediaSlots) {
          if ((row.pendingDemoUploads || []).length && !normalizeMediaSlotKey(row.key)) {
            toast('Set a key on every media slot that has demo files to upload', 'error');
            setSaving(false);
            return;
          }
        }

        const fd = new FormData();
        fd.append('name',         name);
        fd.append('community',    community);
        fd.append('bestFor',      bestFor.join(', '));
        fd.append('languages',    languages.join(', '));
        fd.append('style',        style);
        fd.append('colourPalette', colourPalette);
        fd.append('animations',   animations);
        fd.append('price',        String(Math.round(Number(price) * 100)));
        if (originalPrice) fd.append('originalPrice', String(Math.round(Number(originalPrice) * 100)));
        fd.append('gstPercent',   String(Math.max(0, Number(gstPercent || 0))));
        fd.append('aboutText',    aboutText);
        fd.append('demoData',     JSON.stringify(demoPayload));
        fd.append('templateZip',  zipFile);
        if (desktopThumbFile) fd.append('desktopThumbnailImage', desktopThumbFile);
        if (mobileThumbFile) fd.append('mobileThumbnailImage', mobileThumbFile);

        const res = await api.templates.create(fd);
        const tplId = res.data?.id;
        let demoMediaErr = null;
        if (tplId) {
          try {
            for (const row of mediaSlots) {
              const slotKey = normalizeMediaSlotKey(row.key);
              if (!slotKey || !(row.pendingDemoUploads || []).length) continue;
              for (const p of row.pendingDemoUploads) {
                const mfd = new FormData();
                mfd.append('file', p.file);
                mfd.append('slotKey', slotKey);
                await api.templates.uploadDemoMedia(tplId, mfd);
              }
            }
          } catch (err) {
            demoMediaErr = err;
          }
        }
        mediaSlots.forEach((s) => s.pendingDemoUploads?.forEach((p) => revokePendingDemoPreview(p.objectUrl)));
        setMediaSlots((prev) => prev.map((s) => ({ ...s, pendingDemoUploads: [] })));
        setDemoUrl(res.demoUrl);
        if (demoMediaErr) {
          toast(demoMediaErr.message || 'Template created but some demo media failed to upload. Open the template to retry.', 'error');
        } else {
          toast('Template created — review the demo before publishing', 'success');
        }
      }
    } catch (err) {
      toast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setSaving(true);
    try {
      await api.templates.publish(id);
      toast('Template published', 'success');
      navigate('/templates');
    } catch (err) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="spinner-wrap"><div className="spinner" /></div>;

  const sectionCard = { marginBottom: 24 };
  const rowStyle = { background: 'var(--bg-elevated)', borderRadius: 'var(--r-md)', padding: '12px 16px', marginBottom: 10, border: '1px solid var(--border-subtle)' };
  const rowHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 };
  const rowLabel = { fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' };

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div className="breadcrumb">
        <a href="#" onClick={e => { e.preventDefault(); navigate('/templates'); }}>Templates</a>
        <span className="breadcrumb-sep">›</span>
        <span>{isEdit ? 'Edit' : 'Add'} Template</span>
      </div>

      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">{isEdit ? 'Edit Template' : 'New Template'}</h1>
          <p className="page-subtitle">
            {isEdit ? 'Update template metadata, files, and demo data' : 'Fill in all fields then review the demo before publishing'}
          </p>
        </div>
      </div>

      {demoUrl && (
        <div className="alert alert-success" style={{ marginBottom: 24 }}>
          <span>✓</span>
          <div>
            <strong>Template created!</strong> Review the demo before publishing:{' '}
            <a href={demoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--green)', textDecoration: 'underline' }}>{demoUrl}</a>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* ── Template Name + Community ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Template Name</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Template Name <span className="req">*</span></label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Lotus Garden" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Community <span className="req">*</span></label>
                <select className="form-select" value={community} onChange={e => setCommunity(e.target.value)}>
                  {COMMUNITIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Style</label>
                <input className="form-input" value={style} onChange={e => setStyle(e.target.value)} placeholder="e.g. Romantic · Garden" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Images ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Images</span></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Desktop Thumbnail (5:4) {!isEdit && <span className="req">*</span>}</div>
                <div onClick={() => desktopThumbRef.current?.click()} style={{ width: '100%', maxWidth: 280, aspectRatio: '5 / 4', border: `2px dashed ${desktopThumbPreview ? 'var(--green)' : 'var(--border-default)'}`, borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {desktopThumbPreview ? (
                    <>
                      <img src={desktopThumbPreview} alt="Desktop" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          if (desktopThumbFallback && desktopThumbPreview !== desktopThumbFallback) { setDesktopThumbPreview(desktopThumbFallback); setDesktopThumbFallback(null); return; }
                          const cur = e.currentTarget.src || '';
                          if (cur.includes('/desktop-thumbnail')) { setDesktopThumbPreview(cur.replace('/desktop-thumbnail', '/thumbnail')); setDesktopThumbFallback(null); return; }
                          setDesktopThumbPreview(null);
                        }} />
                      <button type="button" onClick={handleDeleteDesktopThumb}
                        style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 999, border: '1px solid rgba(0,0,0,0.18)', background: 'rgba(255,255,255,0.92)', color: '#333', fontSize: 16, lineHeight: '20px', cursor: 'pointer' }}>×</button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 10 }}><div style={{ fontSize: '1.5rem', marginBottom: 6 }}>🖥️</div>Click to upload</div>
                  )}
                </div>
                <input ref={desktopThumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleDesktopThumbChange} />
              </div>
              <div>
                <div className="form-label" style={{ marginBottom: 8 }}>Mobile Thumbnail (9:16) {!isEdit && <span className="req">*</span>}</div>
                <div onClick={() => mobileThumbRef.current?.click()} style={{ width: '100%', maxWidth: 180, aspectRatio: '9 / 16', border: `2px dashed ${mobileThumbPreview ? 'var(--green)' : 'var(--border-default)'}`, borderRadius: 'var(--r-md)', overflow: 'hidden', cursor: 'pointer', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {mobileThumbPreview ? (
                    <>
                      <img src={mobileThumbPreview} alt="Mobile" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          if (mobileThumbFallback && mobileThumbPreview !== mobileThumbFallback) { setMobileThumbPreview(mobileThumbFallback); setMobileThumbFallback(null); return; }
                          const cur = e.currentTarget.src || '';
                          if (cur.includes('/mobile-thumbnail')) { setMobileThumbPreview(cur.replace('/mobile-thumbnail', '/thumbnail')); setMobileThumbFallback(null); return; }
                          setMobileThumbPreview(null);
                        }} />
                      <button type="button" onClick={handleDeleteMobileThumb}
                        style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: 999, border: '1px solid rgba(0,0,0,0.18)', background: 'rgba(255,255,255,0.92)', color: '#333', fontSize: 16, lineHeight: '20px', cursor: 'pointer' }}>×</button>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: 10 }}><div style={{ fontSize: '1.5rem', marginBottom: 6 }}>📱</div>Click to upload</div>
                  )}
                </div>
                <input ref={mobileThumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleMobileThumbChange} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Cost ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Cost</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Selling Price (₹) <span className="req">*</span></label>
                <input className="form-input" type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)} required placeholder="999" />
                {price && <p className="form-hint">{formatCurrency(Math.round(Number(price) * 100))}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Original Price (₹)</label>
                <input className="form-input" type="number" min="0" step="1" value={originalPrice} onChange={e => setOriginalPrice(e.target.value)} placeholder="1499" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">GST %</label>
                <input className="form-input" type="number" min="0" max="100" step="1" value={gstPercent} onChange={e => setGstPercent(e.target.value)} placeholder="18" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Description ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Description</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Description Text <span className="req">*</span></label>
              <textarea className="form-textarea" rows={3} value={aboutText} onChange={e => setAboutText(e.target.value)} required placeholder="2-3 sentences describing this template..." />
            </div>
          </div>
        </div>

        {/* ── Product Metadata ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Product Metadata</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Event Categories <span className="req">*</span></label>
              {bestFor.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 6 }}>Select at least one category</p>}
              <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden', marginTop: 6 }}>
                {EVENT_TYPE_GROUPS.map((group, gi) => (
                  <div key={group.group} style={{ borderBottom: gi < EVENT_TYPE_GROUPS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ padding: '8px 16px 6px', background: 'var(--bg-elevated)', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{group.group}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px 12px' }}>
                      {group.items.map(item => {
                        const active = bestFor.includes(item.id);
                        return (
                          <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: `1px solid ${active ? 'var(--gold)' : 'var(--border-default)'}`, borderRadius: 'var(--r-sm)', background: active ? 'rgba(184,145,46,0.10)' : 'var(--bg-surface)', cursor: 'pointer', fontSize: '0.84rem', color: active ? 'var(--gold)' : 'var(--text-secondary)', userSelect: 'none' }}>
                            <input type="checkbox" style={{ display: 'none' }} checked={active} onChange={() => toggleBestFor(item.id)} />
                            {active && <span style={{ fontSize: '0.7rem' }}>✓</span>}
                            {item.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Languages Supported <span className="req">*</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                {LANGUAGES.map(({ code, label }) => (
                  <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', border: `1px solid ${languages.includes(code) ? 'var(--blue)' : 'var(--border-default)'}`, borderRadius: 'var(--r-sm)', background: languages.includes(code) ? 'rgba(47,127,212,0.08)' : 'var(--bg-elevated)', cursor: 'pointer', fontSize: '0.84rem', color: languages.includes(code) ? 'var(--blue)' : 'var(--text-secondary)' }}>
                    <input type="checkbox" style={{ display: 'none' }} checked={languages.includes(code)} onChange={() => toggleLanguage(code)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Colour Palette</label>
                <input className="form-input" value={colourPalette} onChange={e => setColourPalette(e.target.value)} placeholder="e.g. Blush pink, mauve, cream" />
              </div>
              <div className="form-group">
                <label className="form-label">Animations</label>
                <input className="form-input" value={animations} onChange={e => setAnimations(e.target.value)} placeholder="e.g. Petal bloom reveal" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Template ZIP ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Template ZIP</span></div>
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Upload ZIP {!isEdit && <span className="req">*</span>}{isEdit && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> (leave blank to keep existing)</span>}</label>
              <div className={`file-drop ${zipFile ? 'has-file' : ''}`} style={{ position: 'relative', paddingRight: zipFile ? 42 : undefined }} onClick={() => zipRef.current?.click()}>
                {zipFile ? `✓ ${zipFile.name} (${(zipFile.size / 1024).toFixed(0)} KB)` : 'Click to upload ZIP (index.html, style.css, script.js, assets/)'}
                {zipFile && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setZipFile(null); if (zipRef.current) zipRef.current.value = ''; }}
                    style={{ position: 'absolute', top: '50%', right: 10, transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 999, border: '1px solid rgba(0,0,0,0.18)', background: 'rgba(255,255,255,0.95)', color: '#333', fontSize: 16, lineHeight: '20px', cursor: 'pointer' }}>×</button>
                )}
              </div>
              {isEdit && !zipFile && existingZipMeta && (
                <div style={{ marginTop: 8, padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)', background: 'var(--bg-elevated)', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>Existing template bundle available</div>
                  <div>Storage folder: <code>{existingZipMeta.folderPath}</code></div>
                  <div>Desktop entry: <code>{existingZipMeta.desktopEntryFile || 'index.html (fallback)'}</code></div>
                  <div>Mobile entry: <code>{existingZipMeta.mobileEntryFile || 'uses desktop/fallback'}</code></div>
                  {existingZipMeta.updatedAt && <div>Last updated: {new Date(existingZipMeta.updatedAt).toLocaleString()}</div>}
                  <div style={{ marginTop: 4 }}>Upload a new ZIP above to replace this bundle.</div>
                </div>
              )}
              <input ref={zipRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => setZipFile(e.target.files[0] || null)} />
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════════
            FIELD SCHEMA — defines what the invitation form will ask for
            ═══════════════════════════════════════════════════════════════════════ */}

        {/* ── People / Roles ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Field Schema — People</span></div>
          <div className="card-body">
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Define the people/roles this template needs. Each role becomes a field in the invitation form.
              The <strong>role</strong> is what your HTML uses (e.g. <code>bride</code> → <code>{'{{bride_name}}'}</code>).
              The <strong>label</strong> is what the admin/user sees in the form.
            </p>
            {people.map((p, i) => (
              <div key={i} style={rowStyle}>
                <div style={rowHeader}>
                  <span style={rowLabel}>Person {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removePerson(i)} style={{ color: 'var(--red)' }}>Remove</Button>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Role (variable name)</label>
                    <input className="form-input" value={p.role} onChange={e => updatePerson(i, 'role', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="bride, groom, host, birthday_person..." />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Form label</label>
                    <input className="form-input" value={p.label} onChange={e => updatePerson(i, 'label', e.target.value)} placeholder="Bride Name, Host Name..." />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Demo name (for preview)</label>
                    <input className="form-input" value={p.demoName} onChange={e => updatePerson(i, 'demoName', e.target.value)} placeholder="Priya, Raj..." />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8, display: 'flex', gap: 20, alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={p.required} onChange={() => updatePerson(i, 'required', !p.required)} /> Required
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={p.photo} onChange={() => updatePerson(i, 'photo', !p.photo)} /> Has photo
                    </label>
                  </div>
                </div>
                {p.role && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    HTML variables: <code>{`{{${p.role}_name}}`}</code>{p.photo && <>, <code>{`{{${p.role}_photo}}`}</code></>}
                  </p>
                )}
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={addPerson} style={{ marginTop: 4 }}>+ Add person</Button>
          </div>
        </div>

        {/* ── Custom Fields ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Field Schema — Custom Fields</span></div>
          <div className="card-body">
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Extra template-specific fields (love story, hashtag, thank-you note, etc.).
              The <strong>key</strong> becomes <code>{'{{key}}'}</code> in your HTML.
            </p>
            {customFields.map((cf, i) => (
              <div key={i} style={rowStyle}>
                <div style={rowHeader}>
                  <span style={rowLabel}>Field {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeCustomField(i)} style={{ color: 'var(--red)' }}>Remove</Button>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Key (variable name)</label>
                    <input className="form-input" value={cf.key} onChange={e => updateCustomField(i, 'key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="love_story, hashtag..." />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Form label</label>
                    <input className="form-input" value={cf.label} onChange={e => updateCustomField(i, 'label', e.target.value)} placeholder="Love Story, Hashtag..." />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Type</label>
                    <select className="form-select" value={cf.type} onChange={e => updateCustomField(i, 'type', e.target.value)}>
                      <option value="text">Text (short)</option>
                      <option value="textarea">Textarea (long)</option>
                      <option value="html">HTML (rich text)</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cf.required} onChange={() => updateCustomField(i, 'required', !cf.required)} /> Required
                    </label>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 4 }}>
                  <label className="form-label">Demo value (for preview)</label>
                  {cf.type === 'textarea' || cf.type === 'html' ? (
                    <textarea className="form-textarea" rows={2} value={cf.demoValue} onChange={e => updateCustomField(i, 'demoValue', e.target.value)} placeholder="Sample content..." />
                  ) : (
                    <input className="form-input" value={cf.demoValue} onChange={e => updateCustomField(i, 'demoValue', e.target.value)} placeholder="Sample value..." />
                  )}
                </div>
                {cf.key && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>HTML variable: <code>{`{{${cf.key}}}`}</code></p>}
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={addCustomField} style={{ marginTop: 4 }}>+ Add custom field</Button>
          </div>
        </div>

        {/* ── Media slots (drives user + admin upload UI) ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Field Schema — Media slots</span></div>
          <div className="card-body">
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Optional. When set, the couple dashboard and admin editor show one block per slot (upload or URL).
              Use stable keys such as <code>ganesh</code>, <code>background_music</code>, <code>couple_carousel</code>, <code>family_photo</code>.
              In HTML you can use <code>{'{{media_slot_url media_slots "ganesh"}}'}</code> or <code>{'{{#each_media_slot media_slots "couple_carousel"}}'}</code>…
            </p>
            {mediaSlots.map((row, i) => (
              <div key={i} style={rowStyle}>
                <div style={rowHeader}>
                  <span style={rowLabel}>Media slot {i + 1}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeMediaSlot(i)} style={{ color: 'var(--red)' }}>Remove</Button>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Key</label>
                    <input className="form-input" value={row.key} onChange={(e) => updateMediaSlot(i, 'key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))} placeholder="ganesh, background_music…" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Label (shown to user)</label>
                    <input className="form-input" value={row.label} onChange={(e) => updateMediaSlot(i, 'label', e.target.value)} placeholder="Ganesh Ji image" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Type</label>
                    <select className="form-select" value={row.type} onChange={(e) => updateMediaSlot(i, 'type', e.target.value)}>
                      <option value="photo">Photo / image</option>
                      <option value="music">Music / audio</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label">Max files</label>
                    <input className="form-input" type="number" min={1} max={99} value={row.max} onChange={(e) => updateMediaSlot(i, 'max', Math.max(1, parseInt(e.target.value, 10) || 1))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group" style={{ marginBottom: 8, flex: 1 }}>
                    <label className="form-label">Accept (optional)</label>
                    <input className="form-input" value={row.accept} onChange={(e) => updateMediaSlot(i, 'accept', e.target.value)} placeholder="image/*, audio/*, video/*" />
                  </div>
                  <div className="form-group" style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={row.multiple} onChange={() => updateMediaSlot(i, 'multiple', !row.multiple)} /> Multiple
                    </label>
                  </div>
                  <div className="form-group" style={{ marginBottom: 8, display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={row.allowUrl} onChange={() => updateMediaSlot(i, 'allowUrl', !row.allowUrl)} /> Allow URL
                    </label>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 4 }}>
                  <label className="form-label">
                    Demo media (for preview)
                    {row.multiple ? ` (${(row.demoFiles?.length || 0) + (row.pendingDemoUploads?.length || 0)}/${row.max})` : ''}
                  </label>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                    {!isEdit
                      ? 'Files are uploaded right after you create the template. Enter the slot key first.'
                      : 'Upload replaces storage immediately; remove to delete from the server.'}
                  </p>
                  {/* Saved demo files (edit only) */}
                  {(row.demoFiles || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {row.demoFiles.map((fileUrl, fi) => (
                        <div key={fi} style={{ position: 'relative', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)', padding: 4, background: 'var(--bg-base)' }}>
                          {row.type === 'photo' || row.type === 'video' ? (
                            <img src={resolvePublicUrl(fileUrl)} alt={`${row.key} demo ${fi + 1}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                          ) : (
                            <div style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', gap: 4 }}>
                              <span style={{ fontSize: '1.4rem' }}>&#9835;</span>
                              <span>Audio</span>
                            </div>
                          )}
                          {isEdit && id && (
                            <button type="button" onClick={async () => {
                              try {
                                await api.templates.deleteDemoMedia(id, row.key, fileUrl);
                                updateMediaSlot(i, 'demoFiles', row.demoFiles.filter((_, j) => j !== fi));
                                toast('Removed', 'success');
                              } catch (err) { toast(err.message, 'error'); }
                            }} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }} title="Remove">&times;</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Staged uploads (create flow — sent after template is created) */}
                  {(row.pendingDemoUploads || []).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                      {(row.pendingDemoUploads || []).map((p) => (
                        <div key={p.id} style={{ position: 'relative', border: '1px dashed var(--border-default)', borderRadius: 'var(--r-sm)', padding: 4, background: 'var(--bg-base)' }}>
                          {row.type === 'photo' ? (
                            <img src={p.objectUrl} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                          ) : row.type === 'video' ? (
                            <video src={p.objectUrl} muted playsInline style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 4, display: 'block' }} />
                          ) : (
                            <div style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', gap: 4 }}>
                              <span style={{ fontSize: '1.4rem' }}>&#9835;</span>
                              <span>Audio</span>
                            </div>
                          )}
                          <button type="button" onClick={() => removePendingDemoUpload(i, p.id)} style={{ position: 'absolute', top: -6, right: -6, background: 'var(--red)', color: '#fff', border: 'none', borderRadius: '50%', width: 20, height: 20, fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }} title="Remove">&times;</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const maxCount = row.multiple ? row.max : 1;
                    const used = (row.demoFiles?.length || 0) + (row.pendingDemoUploads?.length || 0);
                    return used < maxCount;
                  })() && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="file"
                        accept={row.accept || (row.type === 'music' ? 'audio/*' : row.type === 'video' ? 'video/*' : 'image/*')}
                        multiple={row.multiple}
                        onChange={async (e) => {
                          const files = [...(e.target.files || [])];
                          e.target.value = '';
                          if (!files.length) return;
                          const slotKey = normalizeMediaSlotKey(row.key);
                          if (!slotKey) {
                            toast('Enter a slot key before uploading demo media', 'error');
                            return;
                          }
                          const maxCount = row.multiple ? row.max : 1;
                          const used = (row.demoFiles?.length || 0) + (row.pendingDemoUploads?.length || 0);
                          const room = maxCount - used;
                          if (room <= 0) return;
                          const batch = files.slice(0, Math.max(1, room));
                          if (isEdit && id) {
                            const newUrls = [];
                            for (const file of batch) {
                              try {
                                const fd = new FormData();
                                fd.append('file', file);
                                fd.append('slotKey', slotKey);
                                const up = await api.templates.uploadDemoMedia(id, fd);
                                newUrls.push(up.url);
                              } catch (err) { toast(err.message, 'error'); }
                            }
                            if (newUrls.length) {
                              updateMediaSlot(i, 'demoFiles', [...(row.demoFiles || []), ...newUrls]);
                              toast(`Uploaded ${newUrls.length} file(s)`, 'success');
                            }
                          } else {
                            const additions = batch.map((file) => {
                              const objectUrl = URL.createObjectURL(file);
                              pendingDemoObjectUrlsRef.current.add(objectUrl);
                              return { id: makePendingUploadId(), file, objectUrl };
                            });
                            updateMediaSlot(i, 'pendingDemoUploads', [...(row.pendingDemoUploads || []), ...additions]);
                            toast(additions.length > 1 ? `Staged ${additions.length} files — they upload when you create the template` : 'Staged — uploads when you create the template', 'success');
                          }
                        }}
                        style={{ fontSize: '0.84rem' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={addMediaSlot} style={{ marginTop: 4 }}>+ Add media slot</Button>
          </div>
        </div>

        {/* ── Function Fields Config ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Field Schema — Function/Event Fields</span></div>
          <div className="card-body">
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Choose which fields each function/sub-event should have in the invitation form.
              Name and Date are always enabled.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {Object.entries(functionFields).map(([key, cfg]) => {
                const alwaysOn = key === 'name' || key === 'date';
                return (
                  <div key={key} style={{ ...rowStyle, padding: '10px 14px', marginBottom: 0, opacity: !cfg.enabled && !alwaysOn ? 0.5 : 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.86rem', cursor: alwaysOn ? 'default' : 'pointer', fontWeight: 600 }}>
                      <input type="checkbox" checked={cfg.enabled} disabled={alwaysOn} onChange={() => toggleFunctionField(key, 'enabled')} />
                      {cfg.label}
                    </label>
                    {cfg.enabled && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', cursor: 'pointer', marginTop: 4, marginLeft: 24, color: 'var(--text-muted)' }}>
                        <input type="checkbox" checked={cfg.required} onChange={() => toggleFunctionField(key, 'required')} /> Required
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Demo Functions ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Demo Data — Functions</span></div>
          <div className="card-body">
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginBottom: 14 }}>
              Sample functions for the template demo preview. Only enabled fields from above are shown.
            </p>
            {demoFunctions.map((fn, i) => (
              <div key={i} style={rowStyle}>
                <div style={rowHeader}>
                  <span style={rowLabel}>Function {i + 1}</span>
                  {demoFunctions.length > 1 && <Button type="button" size="sm" variant="ghost" onClick={() => removeDemoFunction(i)} style={{ color: 'var(--red)' }}>Remove</Button>}
                </div>
                <div className="form-row">
                  {functionFields.name.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Name</label>
                      <input className="form-input" value={fn.name} onChange={e => updateDemoFunction(i, 'name', e.target.value)} placeholder="Haldi, Wedding..." />
                    </div>
                  )}
                  {functionFields.date.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Date</label>
                      <input className="form-input" type="date" value={fn.date ? fn.date.slice(0, 10) : ''} onChange={e => updateDemoFunction(i, 'date', e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  {functionFields.time.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Time</label>
                      <input className="form-input" value={fn.time} onChange={e => updateDemoFunction(i, 'time', e.target.value)} placeholder="7:00 PM" />
                    </div>
                  )}
                  {functionFields.venueName.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Venue</label>
                      <input className="form-input" value={fn.venueName} onChange={e => updateDemoFunction(i, 'venueName', e.target.value)} placeholder="The Grand Mahal" />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  {functionFields.venueAddress.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Venue Address</label>
                      <input className="form-input" value={fn.venueAddress} onChange={e => updateDemoFunction(i, 'venueAddress', e.target.value)} />
                    </div>
                  )}
                  {functionFields.venueMapUrl.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Google Maps Link</label>
                      <input className="form-input" value={fn.venueMapUrl} onChange={e => updateDemoFunction(i, 'venueMapUrl', e.target.value)} placeholder="https://maps.google.com/..." />
                    </div>
                  )}
                  {functionFields.dressCode.enabled && (
                    <div className="form-group" style={{ marginBottom: 8 }}>
                      <label className="form-label">Dress Code</label>
                      <input className="form-input" value={fn.dressCode} onChange={e => updateDemoFunction(i, 'dressCode', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" size="sm" variant="secondary" onClick={addDemoFunction} style={{ marginTop: 4 }}>+ Add function</Button>
          </div>
        </div>

        {/* ── Other Demo Data ── */}
        <div className="card" style={sectionCard}>
          <div className="card-header"><span className="card-title">Demo Data — Other</span></div>
          <div className="card-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Language</label>
                <select className="form-select" value={demoLanguage} onChange={e => setDemoLanguage(e.target.value)}>
                  {LANGUAGES.map(({ code, label }) => <option key={code} value={code}>{label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Music URL</label>
                <input className="form-input" value={demoMusicUrl} onChange={e => setDemoMusicUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Photo URLs (comma-separated)</label>
              <input className="form-input" value={demoPhotoUrls} onChange={e => setDemoPhotoUrls(e.target.value)} placeholder="https://img1.jpg, https://img2.jpg" />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 40, flexWrap: 'wrap' }}>
          <Button variant="secondary" type="button" onClick={() => navigate('/templates')}>Cancel</Button>
          {isEdit && slug && (
            <Button variant="secondary" type="button" onClick={() => {
              const base = getInviteBaseUrl();
              window.open(`${base}/demo/${slug}`, '_blank');
            }}>Preview Demo</Button>
          )}
          <Button variant="primary" type="submit" loading={saving}>{isEdit ? 'Save Changes' : 'Create Template'}</Button>
          {isEdit && <Button variant="success" type="button" loading={saving} onClick={handlePublish}>Publish Template</Button>}
        </div>
      </form>
    </div>
  );
}
