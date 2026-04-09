const envApi = import.meta.env.VITE_API_URL?.trim?.();
const PROD_API_ORIGIN = 'https://api.aamantran.online';
const API_ORIGIN = envApi ? envApi.replace(/\/$/, '') : import.meta.env.PROD ? PROD_API_ORIGIN : '';

/**
 * Backend may return relative paths (/s/..., /uploads/...) or absolute R2 URLs.
 */
export function resolvePublicUrl(pathOrUrl) {
  if (pathOrUrl == null || pathOrUrl === '') return '';
  const s = String(pathOrUrl).trim();
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (API_ORIGIN) return `${API_ORIGIN}${s.startsWith('/') ? s : `/${s}`}`;
  return s;
}
