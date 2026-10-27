const clean = raw => String(raw || '').toUpperCase().replace(/[^0-9X]/g, '');

function valid10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : +s[i]) * (10 - i);
  return sum % 11 === 0;
}
function valid13(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += +s[i] * (i % 2 ? 3 : 1);
  return sum % 10 === 0;
}
function to13(s10) {
  const core = '978' + s10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += +core[i] * (i % 2 ? 3 : 1);
  return core + ((10 - (sum % 10)) % 10);
}
function to10(s13) {
  if (!s13.startsWith('978')) return null; // 979s have no ISBN-10
  const core = s13.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +core[i] * (10 - i);
  const c = (11 - (sum % 11)) % 11;
  return core + (c === 10 ? 'X' : String(c));
}

function normalizeIsbn(raw) {
  const s = clean(raw);
  if (s.length === 10 && valid10(s)) return { isbn: s, isbn_13: to13(s) };
  if (s.length === 13 && valid13(s)) return { isbn: to10(s), isbn_13: s };
  return null;
}

module.exports = { normalizeIsbn };
