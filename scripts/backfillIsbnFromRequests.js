require('dotenv').config();
const { db } = require('../server/database/init');
const Book = require('../server/models/Book');
const { findRequestIsbn } = require('../server/services/requestIsbnResolver');
const metadataService = require('../server/services/metadataService');

const DRY = process.argv.includes('--dry-run');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const books = await new Promise((res, rej) => db.all(
    `SELECT id, title, author FROM books
     WHERE (isbn IS NULL OR isbn = '') AND (isbn_13 IS NULL OR isbn_13 = '')`,
    (e, r) => (e ? rej(e) : res(r))
  ));
  console.log(`${books.length} books without ISBN`);

  for (const b of books) {
    const hit = await findRequestIsbn(b.title, b.author);
    if (!hit) continue;
    console.log(`#${b.id} "${b.title}" → ${hit.isbn_13} (req #${hit.requestId}, ${hit.score.toFixed(2)})`);
    if (DRY) continue;
    await Book.update(b.id, { isbn: hit.isbn, isbn_13: hit.isbn_13 });
     
      await metadataService.updateBookMetadata(b.id, true).catch(e => console.warn(e.message));
      await sleep(4000); // be gentle with Goodreads
    
  }
  process.exit(0);
})();
