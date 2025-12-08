/**
 * Backfill Missing ISBNs
 * 
 * This script finds books without ISBNs and attempts to fetch them from Google Books.
 * Run with: node scripts/backfillISBNs.js
 * 
 * Options:
 *   --dry-run    Show what would be updated without making changes
 *   --limit=N    Only process N books
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');
const { db } = require('../server/database/init');

const GOOGLE_BOOKS_API = 'https://www.googleapis.com/books/v1/volumes';
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second to avoid rate limiting

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Search Google Books for ISBN
 */
async function searchGoogleBooks(title, author) {
  try {
    let query = '';
    if (title) query += `intitle:${title}`;
    if (author) query += ` inauthor:${author}`;
    
    const response = await axios.get(GOOGLE_BOOKS_API, {
      params: {
        q: query.trim(),
        maxResults: 5,
        printType: 'books'
      },
      timeout: 10000
    });

    if (!response.data.items || response.data.items.length === 0) {
      return null;
    }

    // Find the best match with ISBN
    for (const item of response.data.items) {
      const volumeInfo = item.volumeInfo;
      const identifiers = volumeInfo.industryIdentifiers || [];
      
      const isbn13 = identifiers.find(id => id.type === 'ISBN_13')?.identifier;
      const isbn10 = identifiers.find(id => id.type === 'ISBN_10')?.identifier;
      
      if (isbn13 || isbn10) {
        // Verify title roughly matches
        const normalizedSearchTitle = normalizeText(title);
        const normalizedResultTitle = normalizeText(volumeInfo.title);
        
        if (titlesMatch(normalizedSearchTitle, normalizedResultTitle)) {
          return {
            isbn13,
            isbn10,
            googleTitle: volumeInfo.title,
            googleAuthors: volumeInfo.authors?.join(', ')
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`  Error searching Google Books: ${error.message}`);
    return null;
  }
}

function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesMatch(title1, title2) {
  if (title1 === title2) return true;
  
  // Check if one contains the other
  if (title1.includes(title2) || title2.includes(title1)) return true;
  
  // Check word overlap
  const words1 = title1.split(' ').filter(w => w.length > 2);
  const words2 = title2.split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return false;
  
  const matchingWords = words1.filter(w => words2.includes(w));
  const matchRatio = matchingWords.length / Math.min(words1.length, words2.length);
  
  return matchRatio >= 0.6;
}

/**
 * Get books without ISBNs
 */
function getBooksWithoutISBN(limitCount) {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT id, title, author 
      FROM books 
      WHERE (isbn IS NULL OR isbn = '') 
        AND (isbn_13 IS NULL OR isbn_13 = '')
      ORDER BY added_at DESC
    `;
    
    if (limitCount) {
      sql += ` LIMIT ${limitCount}`;
    }
    
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Update book with ISBN
 */
function updateBookISBN(bookId, isbn, isbn13) {
  return new Promise((resolve, reject) => {
    const updates = [];
    const params = [];
    
    if (isbn) {
      updates.push('isbn = ?');
      params.push(isbn);
    }
    if (isbn13) {
      updates.push('isbn13 = ?');
      params.push(isbn13);
    }
    
    if (updates.length === 0) {
      resolve(false);
      return;
    }
    
    params.push(bookId);
    
    db.run(
      `UPDATE books SET ${updates.join(', ')} WHERE id = ?`,
      params,
      function(err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      }
    );
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('Backfill Missing ISBNs');
  console.log('='.repeat(60));
  
  if (isDryRun) {
    console.log('DRY RUN MODE - No changes will be made\n');
  }
  
  // Get books without ISBNs
  const books = await getBooksWithoutISBN(limit);
  console.log(`Found ${books.length} books without ISBNs\n`);
  
  if (books.length === 0) {
    console.log('All books have ISBNs! Nothing to do.');
    process.exit(0);
  }
  
  let updated = 0;
  let notFound = 0;
  let errors = 0;
  
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    console.log(`[${i + 1}/${books.length}] "${book.title}" by ${book.author || 'Unknown'}`);
    
    try {
      const result = await searchGoogleBooks(book.title, book.author);
      
      if (result) {
        console.log(`  Found: ISBN-13: ${result.isbn13 || 'N/A'}, ISBN-10: ${result.isbn10 || 'N/A'}`);
        console.log(`  Google: "${result.googleTitle}" by ${result.googleAuthors || 'Unknown'}`);
        
        if (!isDryRun) {
          await updateBookISBN(book.id, result.isbn10, result.isbn13);
          console.log(`  ✓ Updated`);
        } else {
          console.log(`  [DRY RUN] Would update`);
        }
        updated++;
      } else {
        console.log(`  ✗ No ISBN found on Google Books`);
        notFound++;
      }
    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      errors++;
    }
    
    // Rate limiting
    if (i < books.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total processed: ${books.length}`);
  console.log(`Updated:         ${updated}`);
  console.log(`Not found:       ${notFound}`);
  console.log(`Errors:          ${errors}`);
  
  if (isDryRun) {
    console.log('\nThis was a dry run. Run without --dry-run to apply changes.');
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
