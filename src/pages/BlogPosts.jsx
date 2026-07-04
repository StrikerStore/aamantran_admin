import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';

const STATUS_TABS = [
  { key: '',          label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft',     label: 'Drafts' },
];

export default function BlogPosts() {
  const navigate = useNavigate();
  const toast = useToast();
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.blog.list({ page, limit: 20, ...(status ? { status } : {}) });
      setPosts(res.posts || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(post) {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(post.id);
    try {
      await api.blog.remove(post.id);
      toast.success('Post deleted');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  }

  async function handleTogglePublish(post) {
    try {
      if (post.status === 'published') {
        await api.blog.unpublish(post.id);
        toast.success('Post unpublished');
      } else {
        await api.blog.publish(post.id);
        toast.success('Post published');
      }
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="blog-page">
      <style>{blogStyles}</style>

      <div className="blog-header">
        <div>
          <h1 className="blog-title">Blog Posts</h1>
          <p className="blog-subtitle">{total} post{total !== 1 ? 's' : ''}</p>
        </div>
        <button className="blog-btn blog-btn-primary" onClick={() => navigate('/blog/new')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Post
        </button>
      </div>

      {/* Status tabs */}
      <div className="blog-tabs">
        {STATUS_TABS.map(t => (
          <button
            key={t.key}
            className={`blog-tab ${status === t.key ? 'active' : ''}`}
            onClick={() => { setStatus(t.key); setPage(1); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Posts table */}
      {loading ? (
        <div className="blog-loading">Loading…</div>
      ) : posts.length === 0 ? (
        <div className="blog-empty">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
          </svg>
          <p>No posts yet. Create your first blog post!</p>
        </div>
      ) : (
        <div className="blog-table-wrap">
          <table className="blog-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}></th>
                <th>Title</th>
                <th>Status</th>
                <th>Tags</th>
                <th>Date</th>
                <th style={{ width: 180 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id}>
                  <td>
                    {post.coverImageUrl ? (
                      <img
                        src={resolvePublicUrl(post.coverImageUrl)}
                        alt=""
                        className="blog-cover-thumb"
                      />
                    ) : (
                      <div className="blog-cover-placeholder">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className="blog-title-link"
                      onClick={() => navigate(`/blog/${post.id}/edit`)}
                    >
                      {post.title}
                    </span>
                    {post.slug && <span className="blog-slug">/{post.slug}</span>}
                  </td>
                  <td>
                    <span className={`blog-badge ${post.status}`}>
                      {post.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td>
                    <span className="blog-tags-cell">
                      {post.tags ? post.tags.split(',').slice(0, 3).map(t => t.trim()).join(', ') : '—'}
                    </span>
                  </td>
                  <td className="blog-date-cell">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : new Date(post.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    }
                  </td>
                  <td>
                    <div className="blog-actions">
                      <button
                        className="blog-action-btn"
                        title="Edit"
                        onClick={() => navigate(`/blog/${post.id}/edit`)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        className="blog-action-btn"
                        title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                        onClick={() => handleTogglePublish(post)}
                      >
                        {post.status === 'published' ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                      <button
                        className="blog-action-btn danger"
                        title="Delete"
                        onClick={() => handleDelete(post)}
                        disabled={deleting === post.id}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="blog-pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

/* ── Scoped styles ── */
const blogStyles = `
.blog-page { max-width: 1100px; margin: 0 auto; }
.blog-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.blog-title { font-size: 1.55rem; font-weight: 700; color: var(--text-primary); margin: 0; }
.blog-subtitle { font-size: .85rem; color: var(--text-muted); margin: 2px 0 0; }

.blog-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 9px 18px; border-radius: var(--r-sm); font-size: .85rem; font-weight: 600;
  border: none; cursor: pointer; transition: all var(--t-fast);
}
.blog-btn-primary {
  background: var(--gold); color: #fff;
}
.blog-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }

.blog-tabs {
  display: flex; gap: 4px; margin-bottom: 16px;
  background: var(--bg-elevated); border-radius: var(--r-sm); padding: 4px; width: fit-content;
}
.blog-tab {
  padding: 6px 16px; border-radius: 8px; font-size: .82rem; font-weight: 500;
  border: none; background: transparent; color: var(--text-secondary); cursor: pointer;
  transition: all var(--t-fast);
}
.blog-tab.active { background: var(--gold); color: #fff; }
.blog-tab:not(.active):hover { background: var(--bg-overlay); }

.blog-loading, .blog-empty {
  text-align: center; padding: 60px 20px; color: var(--text-muted);
}
.blog-empty svg { margin-bottom: 12px; opacity: .5; }
.blog-empty p { margin: 0; }

.blog-table-wrap {
  background: var(--bg-surface); border-radius: var(--r-md);
  box-shadow: var(--shadow-sm); overflow: hidden;
}
.blog-table { width: 100%; border-collapse: collapse; }
.blog-table th {
  font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;
  color: var(--text-muted); padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border-subtle);
}
.blog-table td {
  padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); vertical-align: middle;
  font-size: .85rem; color: var(--text-primary);
}
.blog-table tr:last-child td { border-bottom: none; }
.blog-table tr:hover { background: var(--bg-elevated); }

.blog-cover-thumb {
  width: 42px; height: 42px; border-radius: 8px; object-fit: cover;
  border: 1px solid var(--border-subtle);
}
.blog-cover-placeholder {
  width: 42px; height: 42px; border-radius: 8px;
  background: var(--bg-elevated); display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--border-subtle);
}

.blog-title-link {
  font-weight: 600; color: var(--text-primary); cursor: pointer;
  transition: color var(--t-fast);
}
.blog-title-link:hover { color: var(--gold); }
.blog-slug { display: block; font-size: .75rem; color: var(--text-muted); margin-top: 2px; }

.blog-badge {
  font-size: .72rem; font-weight: 600; padding: 3px 10px; border-radius: 20px;
  text-transform: capitalize;
}
.blog-badge.published { background: var(--mint-soft); color: var(--mint-deep); }
.blog-badge.draft { background: var(--lemon-soft); color: var(--lemon-deep); }

.blog-tags-cell { font-size: .8rem; color: var(--text-secondary); }
.blog-date-cell { font-size: .8rem; color: var(--text-secondary); white-space: nowrap; }

.blog-actions { display: flex; gap: 6px; }
.blog-action-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-subtle);
  background: var(--bg-surface); cursor: pointer; display: flex; align-items: center; justify-content: center;
  color: var(--text-secondary); transition: all var(--t-fast);
}
.blog-action-btn:hover { background: var(--bg-elevated); color: var(--gold); border-color: var(--gold); }
.blog-action-btn.danger:hover { color: var(--red); border-color: var(--red); }
.blog-action-btn:disabled { opacity: .4; pointer-events: none; }

.blog-pagination {
  display: flex; align-items: center; justify-content: center; gap: 16px;
  margin-top: 20px; font-size: .85rem; color: var(--text-secondary);
}
.blog-pagination button {
  padding: 6px 14px; border-radius: 8px; border: 1px solid var(--border-default);
  background: var(--bg-surface); cursor: pointer; font-size: .82rem; color: var(--text-primary);
  transition: all var(--t-fast);
}
.blog-pagination button:hover:not(:disabled) { background: var(--bg-elevated); border-color: var(--gold); }
.blog-pagination button:disabled { opacity: .4; cursor: default; }
`;
