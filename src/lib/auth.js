/** Auth helpers — token storage, decode, guard hook */

const TOKEN_KEY = 'aam_admin_token';

function decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

function isExpired(token) {
  const p = decodeJWT(token);
  return !p || !p.exp || Date.now() >= p.exp * 1000;
}

export function saveToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated() {
  const t = getToken();
  return !!t && !isExpired(t);
}

export function getAdminInfo() {
  const t = getToken();
  return t ? decodeJWT(t) : null;
}
