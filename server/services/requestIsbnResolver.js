const BookRequest = require('../models/BookRequest');
const { normalizeIsbn } = require('../utils/isbn');

const STOP = new Set(['the', 'a', 'an', 'and', 'of', 'novel', 'book']);

const norm = t => String(t || '').toLowerCase()
  .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[’'`]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

// Drop subtitles / "(Series #2)" before comparing
const words = t => norm(String(t || '').split(/[:(]/)[0])
  .split(' ').filter(w => w.length > 1 && !STOP.has(w));

function lastName(author) {
  if (!author || /^unknown$/i.test(author.trim())) return '';
  const first = author.split(/\s*(?:&|;| and )\s*/i)[0];
  if (first.includes(',')) return norm(first.split(',')[0]);
  const parts = norm(first).split(' ');
  return parts[parts.length - 1] || '';
}

function dice(a, b) {
  if (!a.length || !b.length) return 0;
  const B = new Set(b);
  const hits = new Set(a.filter(w => B.has(w))).size;
  return (2 * hits) / (new Set(a).size + B.size);
}

async function findRequestIsbn(title, author) {
  const target = words(title);
  if (!target.length) return null;

  const last = lastName(author);
  const candidates = await BookRequest.findIsbnCandidates(last);

  let best = null;
  for (const r of candidates) {
    const score = dice(target, words(r.title));
    if (!best || score > best.score) best = { r, score };
  }

  // Stricter when we couldn't filter by author
  const threshold = last ? 0.75 : 0.95;
  if (!best || best.score < threshold) return null;

  const n = normalizeIsbn(best.r.isbn);
  return n ? { ...n, requestId: best.r.id, score: best.score } : null;
}

module.exports = { findRequestIsbn };
