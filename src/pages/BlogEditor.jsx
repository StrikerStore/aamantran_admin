import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';
import { getLandingUrl } from '../lib/config';

function slugify(str) {
  return str
    .toString().toLowerCase().trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function BlogEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef(null);

  const [form, setForm] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    metaTitle: '',
    metaDescription: '',
    tags: '',
    author: 'Aamantran Team',
  });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [existingCover, setExistingCover] = useState(null);
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [showPreview, setShowPreview] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Load existing post
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const post = await api.blog.get(id);
        setForm({
          title: post.title || '',
          slug: post.slug || '',
          excerpt: post.excerpt || '',
          content: post.content || '',
          metaTitle: post.metaTitle || '',
          metaDescription: post.metaDescription || '',
          tags: post.tags || '',
          author: post.author || 'Aamantran Team',
        });
        setStatus(post.status || 'draft');
        setExistingCover(post.coverImageUrl || null);
        setSlugTouched(true);
      } catch (e) {
        toast.error(e.message);
        navigate('/blog');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    // Auto-slugify title when slug hasn't been manually edited
    if (name === 'title' && !slugTouched) {
      setForm(f => ({ ...f, slug: slugify(value) }));
    }
  }

  function handleSlugChange(e) {
    setSlugTouched(true);
    setForm(f => ({ ...f, slug: e.target.value }));
  }

  function handleCoverChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  function removeCover() {
    setCoverFile(null);
    setCoverPreview(null);
    setExistingCover(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function buildFormData() {
    const fd = new FormData();
    fd.append('title', form.title);
    fd.append('slug', form.slug);
    fd.append('excerpt', form.excerpt);
    fd.append('content', form.content);
    fd.append('metaTitle', form.metaTitle);
    fd.append('metaDescription', form.metaDescription);
    fd.append('tags', form.tags);
    fd.append('author', form.author);
    if (coverFile) fd.append('coverImage', coverFile);
    return fd;
  }

  async function handleSave() {
    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.content.trim()) return toast.error('Content is required');

    setSaving(true);
    try {
      const fd = buildFormData();
      if (isEdit) {
        // Updating never changes status — a published post stays published,
        // so this is how edits go live without unpublishing first.
        await api.blog.update(id, fd);
        toast.success(status === 'published'
          ? 'Post updated — changes are now live'
          : 'Draft saved');
      } else {
        const post = await api.blog.create(fd);
        toast.success('Draft saved');
        navigate(`/blog/${post.id}/edit`, { replace: true });
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!isEdit) {
      // Save first, then publish
      if (!form.title.trim() || !form.content.trim()) return toast.error('Title and content are required');
      setSaving(true);
      try {
        const fd = buildFormData();
        const post = await api.blog.create(fd);
        await api.blog.publish(post.id);
        toast.success('Post published!');
        navigate(`/blog/${post.id}/edit`, { replace: true });
        setStatus('published');
      } catch (e) {
        toast.error(e.message);
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      // Save changes first, then publish
      const fd = buildFormData();
      await api.blog.update(id, fd);
      await api.blog.publish(id);
      setStatus('published');
      toast.success('Post published!');
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function handleUnpublish() {
    if (!isEdit) return;
    try {
      await api.blog.unpublish(id);
      setStatus('draft');
      toast.success('Post unpublished');
    } catch (e) {
      toast.error(e.message);
    }
  }

  const coverUrl = coverPreview || (existingCover ? resolvePublicUrl(existingCover) : null);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

  return (
    <div className="be-page">
      <style>{editorStyles}</style>

      {/* Header */}
      <div className="be-header">
        <div className="be-header-left">
          <button className="be-back" onClick={() => navigate('/blog')} title="Back to blog">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div>
            <h1 className="be-page-title">{isEdit ? 'Edit Post' : 'New Post'}</h1>
            {isEdit && (
              <span className={`blog-badge ${status}`}>
                {status === 'published' ? 'Published' : 'Draft'}
              </span>
            )}
          </div>
        </div>
        <div className="be-header-actions">
          {isEdit && status === 'published' ? (
            <>
              <a
                className="be-btn be-btn-ghost"
                href={`${getLandingUrl()}/blog/${form.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                View live ↗
              </a>
              <button className="be-btn be-btn-warning" onClick={handleUnpublish} disabled={saving}>
                Unpublish
              </button>
              <button className="be-btn be-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Updating…' : 'Update Post'}
              </button>
            </>
          ) : (
            <>
              <button className="be-btn be-btn-secondary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="be-btn be-btn-primary" onClick={handlePublish} disabled={saving}>
                {saving ? 'Publishing…' : 'Publish'}
              </button>
            </>
          )}
        </div>
      </div>
      {isEdit && status === 'published' && (
        <p className="be-live-note">
          This post is live. Editing and clicking <strong>Update Post</strong> pushes your changes to the site — no need to unpublish first.
        </p>
      )}

      <div className="be-grid">
        {/* Main column */}
        <div className="be-main">
          {/* Title */}
          <div className="be-field">
            <label className="be-label">Title</label>
            <input
              className="be-input"
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="Your blog post title"
            />
          </div>

          {/* Slug */}
          <div className="be-field">
            <label className="be-label">
              Slug
              <span className="be-label-hint">URL: /blog/{form.slug || '…'}</span>
            </label>
            <input
              className="be-input be-input-mono"
              name="slug"
              value={form.slug}
              onChange={handleSlugChange}
              placeholder="auto-generated-from-title"
            />
          </div>

          {/* Content */}
          <div className="be-field">
            <div className="be-content-header">
              <label className="be-label" style={{ margin: 0 }}>Content (Markdown)</label>
              <button
                className={`be-preview-toggle ${showPreview ? 'active' : ''}`}
                onClick={() => setShowPreview(p => !p)}
              >
                {showPreview ? 'Edit' : 'Preview'}
              </button>
            </div>
            {showPreview ? (
              <div
                className="be-preview-pane"
                dangerouslySetInnerHTML={{ __html: simpleMarkdown(form.content) }}
              />
            ) : (
              <textarea
                className="be-textarea"
                name="content"
                value={form.content}
                onChange={handleChange}
                rows={20}
                placeholder="Write your blog post in markdown…"
              />
            )}
          </div>

          {/* Excerpt */}
          <div className="be-field">
            <label className="be-label">Excerpt</label>
            <textarea
              className="be-textarea"
              name="excerpt"
              value={form.excerpt}
              onChange={handleChange}
              rows={3}
              placeholder="A short summary shown on the blog index page"
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="be-sidebar">
          {/* Cover Image */}
          <div className="be-card">
            <h3 className="be-card-title">Cover Image</h3>
            {coverUrl ? (
              <div className="be-cover-preview">
                <img src={coverUrl} alt="Cover" />
                <button className="be-cover-remove" onClick={removeCover} title="Remove">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ) : (
              <div
                className="be-cover-dropzone"
                onClick={() => fileRef.current?.click()}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span>Click to upload</span>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleCoverChange}
              style={{ display: 'none' }}
            />
            {coverUrl && (
              <button className="be-btn be-btn-sm" onClick={() => fileRef.current?.click()} style={{ marginTop: 8, width: '100%' }}>
                Replace Image
              </button>
            )}
          </div>

          {/* SEO Fields */}
          <div className="be-card">
            <h3 className="be-card-title">SEO</h3>
            <div className="be-field">
              <label className="be-label-sm">Meta Title</label>
              <input
                className="be-input be-input-sm"
                name="metaTitle"
                value={form.metaTitle}
                onChange={handleChange}
                placeholder="Override page title for search engines"
              />
            </div>
            <div className="be-field">
              <label className="be-label-sm">Meta Description</label>
              <textarea
                className="be-textarea be-textarea-sm"
                name="metaDescription"
                value={form.metaDescription}
                onChange={handleChange}
                rows={3}
                placeholder="Override description for search engines"
              />
            </div>
          </div>

          {/* Tags & Author */}
          <div className="be-card">
            <h3 className="be-card-title">Details</h3>
            <div className="be-field">
              <label className="be-label-sm">Tags</label>
              <input
                className="be-input be-input-sm"
                name="tags"
                value={form.tags}
                onChange={handleChange}
                placeholder="wedding, tips, invitations"
              />
              <span className="be-hint">Comma-separated</span>
            </div>
            <div className="be-field">
              <label className="be-label-sm">Author</label>
              <input
                className="be-input be-input-sm"
                name="author"
                value={form.author}
                onChange={handleChange}
                placeholder="Aamantran Team"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Simple markdown → HTML (no external dep) ── */
function simpleMarkdown(md) {
  if (!md) return '<p style="color:var(--text-muted)">Nothing to preview</p>';
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headers
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    // Bold/Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0" />')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Unordered lists
    .replace(/^[\-\*]\s+(.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Blockquote
    .replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />');

  // Wrap in paragraphs
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  return html;
}

/* ── Scoped styles ── */
const editorStyles = `
.be-page { max-width: 1200px; margin: 0 auto; }

.be-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 24px; flex-wrap: wrap; gap: 12px;
}
.be-header-left { display: flex; align-items: center; gap: 12px; }
.be-back {
  width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border-subtle);
  background: var(--bg-surface); cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); transition: all var(--t-fast);
}
.be-back:hover { background: var(--bg-elevated); color: var(--gold); }
.be-page-title { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); margin: 0; }

.blog-badge {
  font-size: .7rem; font-weight: 600; padding: 2px 10px; border-radius: 20px;
  text-transform: capitalize; display: inline-block; margin-top: 4px;
}
.blog-badge.published { background: var(--mint-soft); color: var(--mint-deep); }
.blog-badge.draft { background: var(--lemon-soft); color: var(--lemon-deep); }

.be-header-actions { display: flex; gap: 8px; }
.be-btn {
  padding: 8px 18px; border-radius: var(--r-sm); font-size: .82rem; font-weight: 600;
  border: none; cursor: pointer; transition: all var(--t-fast);
}
.be-btn:disabled { opacity: .5; pointer-events: none; }
.be-btn-primary { background: var(--gold); color: #fff; }
.be-btn-primary:hover { filter: brightness(1.08); }
.be-btn-secondary { background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-default); }
.be-btn-secondary:hover { background: var(--bg-elevated); border-color: var(--gold); }
.be-btn-warning { background: var(--peach-soft); color: var(--peach-deep); }
.be-btn-warning:hover { filter: brightness(.96); }
.be-btn-ghost {
  background: transparent; color: var(--text-secondary);
  border: 1px solid var(--border-default); text-decoration: none;
  display: inline-flex; align-items: center;
}
.be-btn-ghost:hover { border-color: var(--gold); color: var(--gold); }
.be-live-note {
  margin: -12px 0 20px; padding: 10px 14px; border-radius: var(--r-sm);
  background: var(--mint-soft); color: var(--mint-deep);
  font-size: .8rem; line-height: 1.5;
}
.be-btn-sm { padding: 5px 12px; font-size: .78rem; border-radius: 8px; background: var(--bg-elevated); color: var(--text-secondary); border: 1px solid var(--border-subtle); cursor: pointer; }
.be-btn-sm:hover { border-color: var(--gold); color: var(--gold); }

.be-grid { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
@media (max-width: 900px) { .be-grid { grid-template-columns: 1fr; } }

.be-main { display: flex; flex-direction: column; gap: 4px; }
.be-sidebar { display: flex; flex-direction: column; gap: 16px; }

.be-field { margin-bottom: 14px; }
.be-label { display: block; font-size: .78rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 6px; }
.be-label-hint { float: right; font-weight: 400; color: var(--text-muted); font-size: .72rem; font-family: monospace; }
.be-label-sm { display: block; font-size: .74rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px; }
.be-hint { display: block; font-size: .7rem; color: var(--text-muted); margin-top: 3px; }

.be-input {
  width: 100%; padding: 10px 14px; border-radius: var(--r-sm); font-size: .88rem;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary);
  transition: border-color var(--t-fast); box-sizing: border-box;
}
.be-input:focus { outline: none; border-color: var(--gold); }
.be-input-mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: .82rem; }
.be-input-sm { padding: 7px 10px; font-size: .82rem; }

.be-textarea {
  width: 100%; padding: 10px 14px; border-radius: var(--r-sm); font-size: .88rem;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary);
  resize: vertical; font-family: inherit; transition: border-color var(--t-fast); box-sizing: border-box;
  line-height: 1.6;
}
.be-textarea:focus { outline: none; border-color: var(--gold); }
.be-textarea-sm { padding: 7px 10px; font-size: .82rem; }

.be-content-header {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
}
.be-preview-toggle {
  padding: 4px 14px; border-radius: 20px; font-size: .75rem; font-weight: 600;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-secondary);
  cursor: pointer; transition: all var(--t-fast);
}
.be-preview-toggle.active { background: var(--gold); color: #fff; border-color: var(--gold); }
.be-preview-toggle:hover:not(.active) { border-color: var(--gold); }

.be-preview-pane {
  min-height: 300px; padding: 20px; border-radius: var(--r-sm); border: 1px solid var(--border-default);
  background: var(--bg-surface); font-size: .9rem; line-height: 1.7; color: var(--text-primary);
}
.be-preview-pane h1, .be-preview-pane h2, .be-preview-pane h3, .be-preview-pane h4 { margin: 20px 0 8px; color: var(--text-primary); }
.be-preview-pane h1 { font-size: 1.6rem; } .be-preview-pane h2 { font-size: 1.3rem; } .be-preview-pane h3 { font-size: 1.1rem; }
.be-preview-pane strong { font-weight: 700; }
.be-preview-pane code { background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px; font-size: .85em; }
.be-preview-pane pre { background: var(--bg-elevated); padding: 16px; border-radius: 8px; overflow-x: auto; }
.be-preview-pane pre code { background: transparent; padding: 0; }
.be-preview-pane blockquote { border-left: 3px solid var(--gold); padding-left: 14px; color: var(--text-secondary); margin: 12px 0; }
.be-preview-pane hr { border: none; border-top: 1px solid var(--border-default); margin: 20px 0; }
.be-preview-pane ul, .be-preview-pane ol { padding-left: 24px; }
.be-preview-pane a { color: var(--gold); }

.be-card {
  background: var(--bg-surface); border-radius: var(--r-md); padding: 18px;
  box-shadow: var(--shadow-sm);
}
.be-card-title { font-size: .88rem; font-weight: 700; color: var(--text-primary); margin: 0 0 14px; }

.be-cover-preview { position: relative; border-radius: 10px; overflow: hidden; }
.be-cover-preview img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
.be-cover-remove {
  position: absolute; top: 8px; right: 8px; width: 28px; height: 28px;
  border-radius: 50%; background: rgba(0,0,0,.6); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; color: #fff;
  transition: background var(--t-fast);
}
.be-cover-remove:hover { background: var(--red); }

.be-cover-dropzone {
  border: 2px dashed var(--border-default); border-radius: 10px;
  padding: 30px 20px; text-align: center; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  transition: border-color var(--t-fast); color: var(--text-muted); font-size: .82rem;
}
.be-cover-dropzone:hover { border-color: var(--gold); }
`;
