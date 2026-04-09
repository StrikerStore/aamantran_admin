/** Shared formatters and helpers */

export function formatCurrency(paise) {
  if (paise == null) return '—';
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export function formatRelative(d) {
  if (!d) return '—';
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60)    return 'just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return formatDate(d);
}

export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function debounce(fn, delay = 320) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

export async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { return false; }
}

export function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/** Status badge CSS class map */
export const STATUS_CLASS = {
  active:   'badge-active',
  draft:    'badge-draft',
  pending:  'badge-pending',
  paid:     'badge-paid',
  failed:   'badge-failed',
  refunded: 'badge-refunded',
  open:     'badge-open',
  resolved: 'badge-resolved',
};

export function statusLabel(status) {
  if (status === true)  return 'active';
  if (status === false) return 'draft';
  return String(status);
}
