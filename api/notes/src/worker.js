// The note wall's API, running on Cloudflare Workers with the notes kept in a D1 database.
//
//   GET  /api/notes            the newest notes (?before=<id> pages back through the rest)
//   GET  /api/notes/me         where the visitor seems to be, and whether they can post today
//   POST /api/notes            { m, c }: stick a note up, with a message and colour by number
//
// Visitors only ever pick from the lists in gallery/notes-messages.js, so there's nothing to
// moderate. Cloudflare tells us roughly where each visitor is (request.cf), and their IP address
// is never stored: only a salted hash that changes every day, kept for that day to allow one note.
//
// Settings are in wrangler.toml: ALLOWED_ORIGINS, PER_DAY and WALL_DAY.

import { MESSAGES, COLOURS } from '../../../gallery/notes-messages.js';

const PAGE = 120;

// Shorter names for the countries that have a familiar one
const SHORT = { GB: 'UK', US: 'USA', AE: 'UAE', KR: 'South Korea', CZ: 'Czechia', RU: 'Russia', NL: 'the Netherlands', PH: 'the Philippines' };
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

function placeOf(request) {
  const cf = request.cf || {};
  const iso = cf.country;
  if (!iso || iso === 'XX' || iso === 'T1') return { place: null, country: null };
  let country = SHORT[iso];
  if (!country) {
    try { country = countryNames.of(iso); } catch { country = iso; }
  }
  const city = cf.city;
  return { place: city && city !== country ? `${city}, ${country}` : country, country: iso };
}

const today = () => new Date().toISOString().slice(0, 10);

async function secretOf(env) {
  if (env.NOTES_SECRET) return env.NOTES_SECRET;
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('secret').first();
  if (row) return row.value;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const value = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  await env.DB.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind('secret', value).run();
  return (await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind('secret').first()).value;
}

async function visitorOf(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(await secretOf(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${today()}|${ip}`));
  return [...new Uint8Array(mac)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------------------------------ Routes */

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean);
  if (allowed.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return null;
}

function json(status, body, origin) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

async function list(url, env) {
  const before = Number(url.searchParams.get('before'));
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || PAGE, 1), PAGE);
  const columns = 'id, message AS m, colour AS c, place, created_at AS at';
  const query = before > 0
    ? env.DB.prepare(`SELECT ${columns} FROM notes WHERE id < ? ORDER BY id DESC LIMIT ?`).bind(before, limit)
    : env.DB.prepare(`SELECT ${columns} FROM notes ORDER BY id DESC LIMIT ?`).bind(limit);
  const [{ results: notes }, totals] = await env.DB.batch([
    query,
    env.DB.prepare("SELECT COUNT(*) AS notes, COUNT(DISTINCT COALESCE(place, '')) AS places FROM notes"),
  ]);
  const { notes: total, places } = totals.results[0];
  return { notes, total, places, more: notes.length === limit };
}

async function me(request, env) {
  const row = await env.DB.prepare('SELECT count FROM daily WHERE day = ? AND visitor = ?').bind(today(), await visitorOf(request, env)).first();
  return { place: placeOf(request).place, canPost: (row ? row.count : 0) < Number(env.PER_DAY || 1) };
}

async function post(request, env, origin) {
  // Browsers say where a request came from: only take notes from the gallery itself
  if (!origin) return json(403, { error: 'origin' });

  const raw = await request.text();
  if (raw.length > 512) return json(400, { error: 'body' }, origin);
  let body;
  try { body = JSON.parse(raw || '{}'); } catch { return json(400, { error: 'body' }, origin); }
  const m = Number(body.m);
  const c = Number(body.c);
  if (!Number.isInteger(m) || m < 0 || m >= MESSAGES.length) return json(400, { error: 'message' }, origin);
  if (!Number.isInteger(c) || c < 0 || c >= COLOURS.length) return json(400, { error: 'colour' }, origin);

  const day = today();
  const visitor = await visitorOf(request, env);
  const [used, wall] = await env.DB.batch([
    env.DB.prepare('SELECT count FROM daily WHERE day = ? AND visitor = ?').bind(day, visitor),
    env.DB.prepare('SELECT COUNT(*) AS n FROM notes WHERE created_at >= ?').bind(`${day}T00:00:00Z`),
  ]);
  if ((used.results[0]?.count || 0) >= Number(env.PER_DAY || 1)) return json(429, { error: 'tomorrow' }, origin);
  if (wall.results[0].n >= Number(env.WALL_DAY || 300)) return json(429, { error: 'full' }, origin);

  const { place, country } = placeOf(request);
  const [, , inserted] = await env.DB.batch([
    env.DB.prepare('DELETE FROM daily WHERE day < ?').bind(day),
    env.DB.prepare('INSERT INTO daily (day, visitor, count) VALUES (?, ?, 1) ON CONFLICT (day, visitor) DO UPDATE SET count = count + 1').bind(day, visitor),
    env.DB.prepare('INSERT INTO notes (message, colour, place, country) VALUES (?, ?, ?, ?) RETURNING id, message AS m, colour AS c, place, created_at AS at').bind(m, c, place, country),
  ]);
  return json(201, { note: inserted.results[0] }, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');
    const origin = allowedOrigin(request, env);
    try {
      if (request.method === 'OPTIONS') return json(204, null, origin);
      if (request.method === 'GET' && path === '/api/notes') return json(200, await list(url, env), origin);
      if (request.method === 'GET' && path === '/api/notes/me') return json(200, await me(request, env), origin);
      if (request.method === 'POST' && path === '/api/notes') return await post(request, env, origin);
      return json(404, { error: 'not found' }, origin);
    } catch (error) {
      console.error(error);
      return json(500, { error: 'server' }, origin);
    }
  },
};
