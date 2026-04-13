import { useState, useEffect, useLayoutEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { ConfirmModal } from '../components/ui/Modal';

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title-slot');
  if (el) el.textContent = t;
}

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState(null);
  
  const [form, setForm] = useState({ name: '', type: 'bg_music', file: null });
  const toast = useToast();

  useLayoutEffect(() => { setTopbarTitle('Assets'); }, []);

  async function loadAssets() {
    setLoading(true);
    try {
      const res = await api.assets.list();
      setAssets(res.assets || []);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.file) {
      toast('Please provide a name and file', 'error');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name.trim());
      fd.append('type', form.type);
      fd.append('file', form.file);

      await api.assets.upload(fd);
      toast('Uploaded successfully!', 'success');
      setForm({ name: '', type: 'bg_music', file: null });
      document.getElementById('file-upload-input').value = '';
      loadAssets();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingAsset) return;
    try {
      await api.assets.remove(deletingAsset.id);
      toast('Asset deleted', 'success');
      setDeletingAsset(null);
      loadAssets();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Global Assets</h1>
          <p className="page-subtitle">Manage platform-wide assets (like background music) that users can pick from.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Upload New Asset</h3>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
            <label className="form-label">Asset Name</label>
            <input 
              className="form-input" 
              placeholder="e.g., Traditional Shehnai" 
              value={form.name} 
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ width: 150, margin: 0 }}>
            <label className="form-label">Type</label>
            <select 
              className="form-select" 
              value={form.type} 
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            >
              <option value="bg_music">Background Music</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: 1, minWidth: 200, margin: 0 }}>
            <label className="form-label">File</label>
            <input 
              id="file-upload-input"
              type="file" 
              className="form-input" 
              onChange={e => setForm(f => ({ ...f, file: e.target.files?.[0] || null }))}
              accept={form.type === 'bg_music' ? 'audio/*' : '*'}
            />
          </div>
          <div style={{ alignSelf: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Preview</th>
              <th width="80">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4">Loading...</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan="4">No assets uploaded yet.</td></tr>
            ) : assets.map(a => (
              <tr key={a.id}>
                <td style={{ fontWeight: 500 }}>{a.name}</td>
                <td><span className="badge badge-gray">{a.type}</span></td>
                <td>
                  {a.type === 'bg_music' ? (
                    <audio controls src={a.url} style={{ height: 32 }} />
                  ) : (
                    <a href={a.url} target="_blank" rel="noreferrer">View</a>
                  )}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm" onClick={() => setDeletingAsset(a)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deletingAsset && (
        <ConfirmModal
          title="Delete Asset"
          message={`Are you sure you want to delete "${deletingAsset.name}"?`}
          confirmText="Delete"
          confirmStyle="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletingAsset(null)}
        />
      )}
    </div>
  );
}
