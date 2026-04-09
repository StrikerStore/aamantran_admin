/** True if the string looks like a Google Maps URL without requiring a scheme. */
export function looksLikeMapsUrl(s) {
  if (s == null || typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (!t) return false;
  return (
    t.startsWith('maps.app.goo.gl/')
    || t.startsWith('goo.gl/maps')
    || t.startsWith('goo.gl/')
    || t.includes('maps.google.')
    || (t.includes('google.') && t.includes('/maps'))
    || t.startsWith('www.google.com/maps')
  );
}

/** Ensure https:// for paste without scheme (e.g. maps.app.goo.gl/…). */
export function normalizeMapsInputUrl(raw) {
  let t = String(raw || '').trim();
  if (!t) return '';
  if (/^\/\//.test(t)) t = `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  if (looksLikeMapsUrl(t)) return `https://${t.replace(/^\/+/, '')}`;
  return t;
}

/** @returns {{ lat: number, lng: number } | null} */
export function parseGoogleMapsLocation(raw) {
  if (raw == null || typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s) return null;

  const comma = /^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(s.replace(/\s/g, ' ').trim());
  if (comma) {
    const lat = parseFloat(comma[1]);
    const lng = parseFloat(comma[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const at = /@(-?\d+\.?\d*),(-?\d+\.?\d*)/.exec(s);
  if (at) {
    const lat = parseFloat(at[1]);
    const lng = parseFloat(at[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const bang = /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/.exec(s);
  if (bang) {
    const lat = parseFloat(bang[1]);
    const lng = parseFloat(bang[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const qEq = /[?&]q=(-?\d+\.?\d*)[+,](-?\d+\.?\d*)/i.exec(s);
  if (qEq) {
    const lat = parseFloat(qEq[1]);
    const lng = parseFloat(qEq[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}

export function isValidLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** For prefilling the paste field when lat/lng already saved */
export function formatLatLngHint(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return '';
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return '';
  return `${la}, ${ln}`;
}
