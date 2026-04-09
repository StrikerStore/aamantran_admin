import {
  parseGoogleMapsLocation,
  isValidLatLng,
  formatLatLngHint,
  looksLikeMapsUrl,
  normalizeMapsInputUrl,
} from './mapsParse';

export { formatLatLngHint };

/** @returns {{ venueLat: number|null, venueLng: number|null, venueMapUrl: string|null } | { error: string }} */
export function resolveMapFieldsForRow(fn) {
  const s = String(fn.mapsInput || '').trim();
  if (!s) {
    return { venueLat: null, venueLng: null, venueMapUrl: null };
  }

  const asUrlCandidate = /^https?:\/\//i.test(s) || looksLikeMapsUrl(s);
  if (asUrlCandidate) {
    const venueMapUrl = normalizeMapsInputUrl(s);
    if (!/^https?:\/\//i.test(venueMapUrl)) {
      return {
        error:
          'Could not read that map link — paste the full share URL from Google Maps (starts with https://)',
      };
    }
    const parsed = parseGoogleMapsLocation(s) || parseGoogleMapsLocation(venueMapUrl);
    return {
      venueLat: parsed ? parsed.lat : null,
      venueLng: parsed ? parsed.lng : null,
      venueMapUrl,
    };
  }

  const parsed = parseGoogleMapsLocation(s);
  if (parsed) {
    return { venueLat: parsed.lat, venueLng: parsed.lng, venueMapUrl: null };
  }

  return {
    error:
      'Paste a Google Maps share link (Copy link) or coordinates like 19.076, 72.8777',
  };
}

/** Returns { orders } or { error } — same rules as API */
export function computeFunctionSortOrders(functions) {
  const nums = [];
  for (let i = 0; i < functions.length; i++) {
    const f = functions[i];
    if (f.sortOrder === undefined || f.sortOrder === null || f.sortOrder === '') {
      nums.push(i);
      continue;
    }
    const n = Number(f.sortOrder);
    if (!Number.isInteger(n) || n < 0) {
      return { error: 'Sort order must be a non-negative integer for each function' };
    }
    nums.push(n);
  }
  if (new Set(nums).size !== nums.length) {
    return { error: 'Sort order must be unique for each function in this invitation' };
  }
  return { orders: nums };
}

export { isValidLatLng };
