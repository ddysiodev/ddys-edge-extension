import { DEFAULT_SITE_BASE } from './constants.js';

export function normalizeBaseUrl(value, fallback) {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.replace(/\/+$/, '');
}

export function buildUrl(base, path, query = {}) {
  const url = new URL(`${normalizeBaseUrl(base, base)}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '') url.searchParams.append(key, String(item));
      }
      continue;
    }
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export function unwrapData(envelope) {
  if (envelope?.success === true) return envelope.data;
  if (Array.isArray(envelope)) return envelope;
  return envelope?.data ?? envelope;
}

export function unwrapPaginated(envelope) {
  if (envelope?.success === true) {
    return {
      data: Array.isArray(envelope.data) ? envelope.data : [],
      meta: envelope.meta || createMeta(envelope.data)
    };
  }
  return {
    data: extractItems(envelope),
    meta: envelope?.meta || createMeta(extractItems(envelope))
  };
}

export function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['data', 'items', 'movies', 'results', 'list']) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = extractItems(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function normalizeMovie(item = {}) {
  const title = item.title || item.name || item.movie_title || item.keyword || '未命名影片';
  const slug = item.slug || item.id || slugify(title);
  return {
    ...item,
    id: item.id ?? slug,
    title,
    slug,
    poster: item.poster || item.cover || item.image || '',
    year: item.year || item.release_year || '',
    rating: item.rating ?? item.score ?? '',
    type: item.type || item.type_code || '',
    region: item.region || item.region_code || '',
    url: item.url || `/movies/${encodeURIComponent(String(slug))}`
  };
}

export function itemKey(item = {}) {
  const normalized = normalizeMovie(item);
  return String(normalized.slug || normalized.id || normalized.title).trim().toLowerCase();
}

export function movieSiteUrl(item = {}, siteBase = DEFAULT_SITE_BASE) {
  const normalized = normalizeMovie(item);
  if (/^https?:\/\//i.test(normalized.url || '')) return normalized.url;
  const path = normalized.url || `/movies/${encodeURIComponent(String(normalized.slug))}`;
  return `${normalizeBaseUrl(siteBase, DEFAULT_SITE_BASE)}${path.startsWith('/') ? path : `/${path}`}`;
}

export function metaLine(item = {}) {
  const movie = normalizeMovie(item);
  return [movie.year, movie.type, movie.region, movie.rating ? `评分 ${movie.rating}` : ''].filter(Boolean).join(' / ');
}

export function createMeta(data = []) {
  const total = Array.isArray(data) ? data.length : 0;
  return { total, page: 1, per_page: total, total_pages: 1 };
}

export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'movie';
}

export function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function shortText(value, length = 80) {
  const text = String(value || '').trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}
