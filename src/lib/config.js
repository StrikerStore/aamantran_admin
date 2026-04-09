/**
 * Public base URL where guest invitations are served (backend /i/:slug).
 * Set VITE_PUBLIC_INVITE_BASE_URL in .env — e.g. http://localhost:4000 or https://api.yourdomain.com
 */
export function getInviteBaseUrl() {
  const v = import.meta.env.VITE_PUBLIC_INVITE_BASE_URL;
  if (v && String(v).trim()) return String(v).replace(/\/$/, '');
  return import.meta.env.PROD ? 'https://api.aamantran.online' : 'http://localhost:4000';
}
