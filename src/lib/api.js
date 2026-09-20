/** API client — all requests carry the JWT from localStorage */

const PROD_API_ORIGIN = 'https://api.aamantran.online';
const envApi = import.meta.env.VITE_API_URL?.trim?.();
const API_ORIGIN = envApi ? envApi.replace(/\/$/, '') : import.meta.env.PROD ? PROD_API_ORIGIN : '';
/** Full admin API prefix: absolute in production when VITE_API_URL is set, else same-origin /api/v1 (Vite proxy in dev). */
const API_BASE = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '/api/v1';

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body   = body;
  }
}

/* ── GET cache ───────────────────────────────────────────────────────────────
 * Makes back-navigation feel instant instead of re-fetching from scratch.
 *
 * Security constraints this deliberately honours:
 *  - Memory only. Admin payloads (users, transactions, tickets) must never be
 *    written to localStorage/sessionStorage where they outlive the session.
 *  - Bound to the exact token that fetched them. A different admin signing in
 *    gets a different key, so one admin can never read another's cached rows.
 *  - Dropped wholesale on logout, on 401, and after any mutation.
 *  - GET only — never replays a POST/PATCH/DELETE.
 */
const CACHE_TTL_MS = 30_000;
const getCache = new Map();

function cacheKey(token, path, params) {
  return `${token || 'anon'}|${path}|${params ? JSON.stringify(params) : ''}`;
}

export function clearApiCache() {
  getCache.clear();
}

async function request(method, path, { body, multipart = false, params, cache = false, signal } = {}) {
  const token = localStorage.getItem('aam_admin_token');

  const key = cache && method === 'GET' ? cacheKey(token, path, params) : null;
  if (key) {
    const hit = getCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  }

  const url = API_BASE.startsWith('http')
    ? new URL(`${API_BASE}${path}`)
    : new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let fetchBody;
  if (multipart && body instanceof FormData) {
    fetchBody = body;
  } else if (body != null) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url.toString(), { method, headers, body: fetchBody, signal });
  } catch (err) {
    // A superseded request (user kept typing) is not a failure — let callers
    // ignore it rather than flashing a network error toast.
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('Network error — is the backend running?', 0, null);
  }

  const raw = await res.text();
  let json = null;
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      throw new ApiError(`Non-JSON response (${res.status})`, res.status, null);
    }
  }

  if (res.status === 401) {
    const msg = json?.message || 'Session expired — please sign in again.';
    const hadToken = !!localStorage.getItem('aam_admin_token');
    localStorage.removeItem('aam_admin_token');
    clearApiCache(); // never let a revoked session's data survive in memory
    // Only hard-redirect when a session was active (e.g. expired token mid-session).
    // On the login page itself there is no token yet, so just throw and let the
    // form's catch block display the error inline.
    if (hadToken) {
      const next = window.location.pathname + window.location.search;
      window.location.href = next && next !== '/' ? `/?next=${encodeURIComponent(next)}` : '/';
    }
    throw new ApiError(msg, 401, json);
  }

  if (!res.ok) throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json);

  if (key) getCache.set(key, { at: Date.now(), value: json });
  // Any write can invalidate any list, so drop everything rather than guess.
  if (method !== 'GET') clearApiCache();

  return json;
}

/**
 * Downloads a file the API returns as a file, not as JSON.
 *
 * `request` above always parses the body as JSON, and a CSV is not JSON. This
 * also cannot be a plain link: the panel authenticates with a bearer token, and
 * a browser navigation carries no header — so the file is fetched, held as a
 * blob and handed to a temporary link.
 */
async function download(path, params, fallbackName = 'download.csv') {
  const token = localStorage.getItem('aam_admin_token');
  const url = API_BASE.startsWith('http')
    ? new URL(`${API_BASE}${path}`)
    : new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const res = await fetch(url.toString(), { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    // A refusal is JSON even though a success is not, and its message is the
    // whole point — "more than the 10,000-row limit, ask for a shorter range"
    // is useless if the panel only shows the status number.
    const text = await res.text().catch(() => '');
    let body = null;
    if (text) { try { body = JSON.parse(text); } catch { /* not JSON: keep the generic message */ } }
    throw new ApiError(body?.message || `Download failed (${res.status})`, res.status, body);
  }

  // The server names the file; the fallback only applies if the header is missing.
  const disposition = res.headers.get('content-disposition') || '';
  const named = /filename="?([^"]+)"?/.exec(disposition);
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = named ? named[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: revoking immediately can cancel the download in
  // some browsers.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const api = {
  auth: {
    login: (email, password, otp) =>
      request('POST', '/auth/login', { body: { email, password, ...(otp ? { otp } : {}) } }),
  },

  templates: {
    list:          (params)   => request('GET',    '/templates', { params, cache: true }),
    get:           (id)       => request('GET',    `/templates/${id}`, { cache: true }),
    create:        (fd)       => request('POST',   '/templates', { body: fd, multipart: true }),
    update:        (id, fd)   => request('PUT',    `/templates/${id}`, { body: fd, multipart: true }),
    updateFiles:   (id, fd)   => request('PUT',    `/templates/${id}/files`, { body: fd, multipart: true }),
    updateDemoData:(id, body) => request('PUT',    `/templates/${id}/demo-data`, { body }),
    uploadDemoMedia: (id, fd) => request('POST',  `/templates/${id}/demo-media`, { body: fd, multipart: true }),
    deleteDemoMedia: (id, slotKey, url) => request('DELETE', `/templates/${id}/demo-media/${slotKey}`, { body: url ? { url } : undefined }),
    deleteThumbnail: (id, variant) => request('DELETE', `/templates/${id}/thumbnail/${variant}`),
    publish:        (id)      => request('PATCH', `/templates/${id}/publish`),
    publishChanges: (id)      => request('POST',  `/templates/${id}/publish-changes`),
    draft:          (id)      => request('PATCH', `/templates/${id}/draft`),
    deleteVersion:  (templateId, versionId) =>
      request('DELETE', `/templates/${templateId}/versions/${versionId}`),
    remove:        (id)       => request('DELETE', `/templates/${id}`),
  },

  settings: {
    getPricing:     ()       => request('GET', '/settings/pricing'),
    updatePricing:  (body)   => request('PUT', '/settings/pricing', { body }),
    // Never cached: the whole point is to see what a rate change would do
    // before committing it.
    previewPricing: (params) => request('GET', '/settings/pricing/preview', { params }),
    // Never cached: which gateway is live is the one thing this page must not
    // show stale.
    getGateway:     ()       => request('GET', '/settings/gateway'),
    updateGateway:  (body)   => request('PUT', '/settings/gateway', { body }),
  },

  users: {
    list:           (params, opts)  => request('GET',   '/users', { params, cache: true, ...opts }),
    get:            (id)            => request('GET',   `/users/${id}`, { cache: true }),
    updateProfile:  (id, body)      => request('PATCH', `/users/${id}/profile`, { body }),
    resetPassword:  (id, password)  => request('PATCH', `/users/${id}/reset-password`, { body: { password } }),
    freezeNames:    (id, eventId)   => request('PATCH', `/users/${id}/freeze-names`, { body: { eventId } }),
    updateEventData:(id, data)      => request('PUT',   `/users/${id}/event-data`, { body: data }),
    swapTemplate:   (id, data)      => request('POST',  `/users/${id}/swap-template`, { body: data }),
    swapPairedTemplate: (id, data)  => request('POST',  `/users/${id}/swap-paired-template`, { body: data }),
    generateInvites:(id, data)      => request('POST',  `/users/${id}/generate-invites`, { body: data }),
    uploadEventMedia: (userId, eventId, body) => request('POST', `/users/${userId}/events/${eventId}/media`, {
      body,
      multipart: body instanceof FormData,
    }),
    deleteEventMedia: (userId, eventId, mediaId) =>
      request('DELETE', `/users/${userId}/events/${eventId}/media/${mediaId}`),
    getEventPreviewToken: (userId, eventId) =>
      request('GET', `/users/${userId}/events/${eventId}/preview-token`),
  },

  transactions: {
    list:   (params) => request('GET',  '/transactions', { params, cache: true }),
    get:    (id)     => request('GET',  `/transactions/${id}`, { cache: true }),
    refund: (id)     => request('POST', `/transactions/${id}/refund`),
    // The same filters the table is showing, so an export always matches it.
    exportCsv: (params) => download('/transactions/export', params),
    // The GST filing file. Its date range is its own on purpose — inheriting the
    // table's filters would let a forgotten dropdown file a partial return.
    gstReport: ({ from, to }) => download('/transactions/gst-report', { from, to }, 'gst-report.xlsx'),
  },

  tickets: {
    list:    (params)        => request('GET',   '/tickets', { params, cache: true }),
    get:     (id)            => request('GET',   `/tickets/${id}`, { cache: true }),
    // Never cached: this is the poll that keeps an open thread current, and the
    // 30s GET cache would hand back the same answer it just gave.
    messages: (id, since)    => request('GET',   `/tickets/${id}/messages`, { params: since ? { since } : undefined }),
    reply:   (id, body)      => request('POST',  `/tickets/${id}/reply`, { body: { body } }),
    resolve: (id)            => request('PATCH', `/tickets/${id}/resolve`),
    reopen:  (id)            => request('PATCH', `/tickets/${id}/reopen`),
  },

  coupons: {
    list:   (params)          => request('GET', '/coupons', { params, cache: true }),
    create: (body)            => request('POST', '/coupons', { body }),
    update: (id, body)        => request('PATCH', `/coupons/${id}`, { body }),
    remove: (id)              => request('DELETE', `/coupons/${id}`),
  },

  assets: {
    list:   (params) => request('GET', '/assets', { params, cache: true }),
    upload: (fd)   => request('POST', '/assets', { body: fd, multipart: true }),
    remove: (id)   => request('DELETE', `/assets/${id}`),
  },

  analytics: {
    summary: (params) => request('GET', '/analytics/summary', { params }),
    live:    (params) => request('GET', '/analytics/live', { params }),
    // What was sold, for the dashboard. Uncached: the overview should not open
    // on figures from half a minute ago.
    business: (params) => request('GET', '/analytics/business', { params }),
  },

  // Master template-testing account. `status` is deliberately uncached — the
  // 30s GET cache would show a stale template right after a load.
  testing: {
    status:         ()         => request('GET',  '/testing/status'),
    ensureAccount:  (password) => request('POST', '/testing/account', { body: password ? { password } : {} }),
    rotatePassword: (password) => request('POST', '/testing/rotate-password', { body: password ? { password } : {} }),
    loadTemplate:   (body)     => request('POST', '/testing/load-template', { body }),
    setPublished:   (publish)  => request('POST', '/testing/publish', { body: { publish } }),
    repin:          (renderSource) => request('POST', '/testing/repin', { body: { renderSource } }),
    session:        ()         => request('POST', '/testing/session'),
    reset:          ()         => request('POST', '/testing/reset'),
  },

  // Template Lab accounts for external template developers.
  developers: {
    list:           ()                 => request('GET',    '/testing/developers'),
    create:         (body)             => request('POST',   '/testing/developers', { body }),
    rotatePassword: (handle, password) => request('POST',   `/testing/developers/${handle}/rotate-password`, { body: password ? { password } : {} }),
    setActive:      (handle, isActive) => request('PATCH',  `/testing/developers/${handle}/active`, { body: { isActive } }),
    remove:         (handle)           => request('DELETE', `/testing/developers/${handle}`),
  },

  reviews: {
    list:   (params) => request('GET',    '/reviews', { params, cache: true }),
    create: (fd)     => request('POST',   '/reviews', { body: fd, multipart: true }),
    hide:   (id)     => request('PATCH',  `/reviews/${id}/hide`),
    show:   (id)     => request('PATCH',  `/reviews/${id}/show`),
    remove: (id)     => request('DELETE', `/reviews/${id}`),
  },

  blog: {
    list:      (params) => request('GET',    '/blog', { params, cache: true }),
    get:       (id)     => request('GET',    `/blog/${id}`, { cache: true }),
    create:    (fd)     => request('POST',   '/blog', { body: fd, multipart: true }),
    update:    (id, fd) => request('PUT',    `/blog/${id}`, { body: fd, multipart: true }),
    publish:   (id)     => request('PATCH',  `/blog/${id}/publish`),
    unpublish: (id)     => request('PATCH',  `/blog/${id}/unpublish`),
    remove:    (id)     => request('DELETE', `/blog/${id}`),
  },
};

export { ApiError };
