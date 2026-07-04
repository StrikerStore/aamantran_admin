/**
 * Public base URL where guest invitations are served (backend /i/:slug).
 * Set VITE_PUBLIC_INVITE_BASE_URL in .env — e.g. http://localhost:4000 or https://api.yourdomain.com
 */
export function getInviteBaseUrl() {
  const v = import.meta.env.VITE_PUBLIC_INVITE_BASE_URL;
  if (v && String(v).trim()) return String(v).replace(/\/$/, '');
  return import.meta.env.PROD ? 'https://api.aamantran.online' : 'http://localhost:4000';
}

/**
 * Public marketing site (Next.js) — where blog posts and templates are shown.
 * Set VITE_LANDING_URL in .env to override (e.g. http://localhost:3000).
 */
export function getLandingUrl() {
  const v = import.meta.env.VITE_LANDING_URL;
  if (v && String(v).trim()) return String(v).replace(/\/$/, '');
  return import.meta.env.PROD ? 'https://www.aamantran.online' : 'http://localhost:3000';
}
