import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';
import { getLandingUrl } from '../lib/config';
import './BlogEditor.css';

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
                <img src={coverUrl} alt="Cover" loading="lazy" decoding="async" />
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

