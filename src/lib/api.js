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

async function request(method, path, { body, multipart = false, params } = {}) {
  const token = localStorage.getItem('aam_admin_token');

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
    res = await fetch(url.toString(), { method, headers, body: fetchBody });
  } catch {
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
    // Only hard-redirect when a session was active (e.g. expired token mid-session).
    // On the login page itself there is no token yet, so just throw and let the
    // form's catch block display the error inline.
    if (hadToken) window.location.href = '/';
    throw new ApiError(msg, 401, json);
  }

  if (!res.ok) throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json);
  return json;
}

export const api = {
  auth: {
    login: (email, password) =>
      request('POST', '/auth/login', { body: { email, password } }),
  },

  templates: {
    list:          (params)   => request('GET',    '/templates', { params }),
    get:           (id)       => request('GET',    `/templates/${id}`),
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

  users: {
    list:           (params)        => request('GET',   '/users', { params }),
    get:            (id)            => request('GET',   `/users/${id}`),
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
    list:   (params) => request('GET',  '/transactions', { params }),
    get:    (id)     => request('GET',  `/transactions/${id}`),
    refund: (id)     => request('POST', `/transactions/${id}/refund`),
  },

  tickets: {
    list:    (params)        => request('GET',   '/tickets', { params }),
    get:     (id)            => request('GET',   `/tickets/${id}`),
    reply:   (id, body)      => request('POST',  `/tickets/${id}/reply`, { body: { body } }),
    resolve: (id)            => request('PATCH', `/tickets/${id}/resolve`),
    reopen:  (id)            => request('PATCH', `/tickets/${id}/reopen`),
  },

  coupons: {
    list:   ()                => request('GET', '/coupons'),
    create: (body)            => request('POST', '/coupons', { body }),
    update: (id, body)        => request('PATCH', `/coupons/${id}`, { body }),
    remove: (id)              => request('DELETE', `/coupons/${id}`),
  },

  assets: {
    list:   ()     => request('GET', '/assets'),
    upload: (fd)   => request('POST', '/assets', { body: fd, multipart: true }),
    remove: (id)   => request('DELETE', `/assets/${id}`),
  },
};

export { ApiError };
