require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { db } = require('../server/database/init');
const { normalizeIsbn } = require('../server/utils/isbn');

const APPLY = process.argv.includes('--apply');
const booksDir = path.resolve(process.env.BOOKS_STORAGE_PATH || './data/books');
const all = (q, p = []) => new Promise((res, rej) => db.all(q, p, (e, r) => (e ? rej(e) : res(r))));
const run = (q, p = []) => new Promise((res, rej) => db.run(q, p, e => (e ? rej(e) : res())));

(async () => {
  // Index files on disk by byte size
  const bySize = new Map();
  for (const f of fs.readdirSync(booksDir)) {
    const p = path.join(booksDir, f);
    const st = fs.statSync(p);
    if (!st.isFile()) continue;
    if (!bySize.has(st.size)) bySize.set(st.size, []);
    bySize.get(st.size).push(p);
  }

  const rows = await all(`SELECT * FROM books WHERE file_path NOT LIKE '/%' AND file_path GLOB '[0-9]*'`);
  console.log(`${rows.length} shifted rows`);

  for (const r of rows) {
    const size = parseInt(r.file_path, 10);
    const coverIsFile = r.cover_image && path.resolve(r.cover_image).startsWith(booksDir)
      && /\.(epub|pdf|mobi|azw3?)$/i.test(r.cover_image) && fs.existsSync(r.cover_image);
    const matches = bySize.get(size) || [];
    const real = coverIsFile ? r.cover_image : (matches.length === 1 ? matches[0] : null);

    if (!real) {
      console.log(`#${r.id} "${r.title}" — no unique file of size ${size}:`, matches);
      continue;
    }

    const dateLike = v => typeof v === 'string' && /^\d{4}(-\d{2}){0,2}$/.test(v.trim());
    const fix = {
      file_path: real,
      file_size: size,
      format: r.file_size,          // held format
      language: r.format,           // held language
      series: r.language,           // held series
      series_number: r.series,      // held series_number
      added_by: r.series_number ?? 1,
      cover_image: coverIsFile ? null : r.cover_image,   // keep a real cover if metadata set one
      isbn_13: normalizeIsbn(r.isbn_13)?.isbn_13 ?? null, // drop publisher text, keep real ISBNs
      published_date: dateLike(r.published_date) ? r.published_date
                    : dateLike(r.publisher) ? r.publisher : null,
      publisher: dateLike(r.publisher) ? null : r.publisher,
    };

    console.log(`#${r.id} "${r.title}" → ${path.basename(real)}`);
    if (APPLY) {
      const keys = Object.keys(fix);
      await run(`UPDATE books SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`,
        [...keys.map(k => fix[k]), r.id]);
    }
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write changes.');
  process.exit(0);
})();
