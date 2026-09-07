/** Shared formatters and helpers */

export function formatCurrency(paise) {
  if (paise == null) return '—';
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

/**
 * Money in whichever currency it was actually charged in.
 *
 * Amounts are stored in the MINOR units of their own currency — paise for INR,
 * cents for USD — so the divisor is the same but the symbol and grouping are
 * not. Never sum across currencies; group by currency first.
 *
 * Dollars keep their cents because international prices are deliberately .99;
 * rupees drop them, matching how prices have always been shown here.
 */
export function formatMoney(minor, currency = 'INR') {
  if (minor == null) return '—';
  const amount = minor / 100;
  if (String(currency).toUpperCase() === 'USD') {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0 });
}

/**
 * INR paise -> USD cents, at a .99 price point.
 *
 * MIRRORS aamantran_backend/src/services/pricing.service.js `deriveUsdCents`.
 * The backend is the authority — this copy exists only so the template form can
 * show what a multiplier does without a round trip. Keep the two in step.
 *
 * cents = paise * multiplier / rate, collapsed to an integer first so the tier
 * maths below cannot flip on a floating-point hair; then a strict ceiling to the
 * next whole $10, minus a cent.
 */
export function deriveUsdCents(inrPaise, usdInrRate, multiplier) {
  const paise = Number(inrPaise);
  const rate  = Number(usdInrRate);
  const mult  = Number(multiplier);
  if (!Number.isFinite(paise) || paise <= 0) return null;
  if (!Number.isFinite(rate)  || rate  <= 0) return null;
  if (!Number.isFinite(mult)  || mult  <= 0) return null;
  const rawCents  = Math.round((paise * mult) / rate);
  return (Math.floor(rawCents / 1000) + 1) * 1000 - 1;
}

/** '+91 9876543210' from the split columns, or '—' when unset. */
export function formatPhone(phone, phoneCountryCode) {
  if (!phone) return '—';
  return (phoneCountryCode ? phoneCountryCode + ' ' : '') + phone;
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
  // Invitation publish state — distinct wording from a template's active/draft
  // so the Testing page can show both badges side by side without ambiguity.
  published:   'badge-active',
  unpublished: 'badge-draft',
};

export function statusLabel(status) {
  if (status === true)  return 'active';
  if (status === false) return 'draft';
  return String(status);
}
