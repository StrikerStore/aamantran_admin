import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { resolvePublicUrl } from '../lib/resolvePublicUrl';
import './BlogPosts.css';

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
  const [refreshing, setRefreshing] = useState(false);
  const loadedOnce = useRef(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    if (loadedOnce.current) setRefreshing(true); else setLoading(true);
    try {
      const res = await api.blog.list({ page, limit: 20, ...(status ? { status } : {}) });
      setPosts(res.posts || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadedOnce.current = true;
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

      {/* Posts table — rows stay visible while a tab/page change loads */}
      {refreshing && <div className="refresh-bar" />}
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
        <div className={`blog-table-wrap${refreshing ? ' is-refreshing' : ''}`}>
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
                <tr
                  key={post.id}
                  className="blog-row"
                  onClick={() => navigate(`/blog/${post.id}/edit`)}
                >
                  <td>
                    {post.coverImageUrl ? (
                      <img
                        src={resolvePublicUrl(post.coverImageUrl)}
                        alt=""
                        className="blog-cover-thumb"
                        width="42"
                        height="42"
                        loading="lazy"
                        decoding="async"
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
                    <span className="blog-title-link">{post.title}</span>
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
                        onClick={(e) => { e.stopPropagation(); navigate(`/blog/${post.id}/edit`); }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button
                        className="blog-action-btn"
                        title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                        onClick={(e) => { e.stopPropagation(); handleTogglePublish(post); }}
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
                        onClick={(e) => { e.stopPropagation(); handleDelete(post); }}
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

