#!/usr/bin/env node

/**
 * Script to find and remove duplicate books from BookServe
 * Duplicates are identified by matching title and author
 * Usage: node scripts/removeDuplicates.js [options]
 */

require('dotenv').config();
const { initDatabase } = require('../server/database/init');
const Book = require('../models/Book');
const fs = require('fs').promises;
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Find duplicate books in the database
 */
async function findDuplicates(options = {}) {
  const { matchCriteria = 'title-author' } = options;
  
  console.log('Loading all books from database...');
  const allBooks = await Book.findAll(10000, 0);
  console.log(`Found ${allBooks.length} books total\n`);

  const bookMap = new Map();
  const duplicateGroups = [];

  // Group books by matching criteria
  for (const book of allBooks) {
    let key;
    
    switch (matchCriteria) {
      case 'title-author':
        // Match on both title and author
        key = `${normalizeString(book.title)}|||${normalizeString(book.author)}`;
        break;
      
      case 'title-only':
        // Match on title only
        key = normalizeString(book.title);
        break;
      
      case 'isbn':
        // Match on ISBN
        key = book.isbn_13 || book.isbn;
        if (!key) continue; // Skip books without ISBN
        break;
      
      default:
        key = `${normalizeString(book.title)}|||${normalizeString(book.author)}`;
    }

    if (!bookMap.has(key)) {
      bookMap.set(key, []);
    }
    bookMap.get(key).push(book);
  }

  // Find groups with duplicates
  for (const [key, books] of bookMap.entries()) {
    if (books.length > 1) {
      duplicateGroups.push(books);
    }
  }

  return duplicateGroups;
}

/**
 * Display duplicate groups
 */
function displayDuplicates(duplicateGroups) {
  console.log(`\n=== Found ${duplicateGroups.length} Duplicate Groups ===\n`);

  let totalDuplicates = 0;

  duplicateGroups.forEach((group, groupIndex) => {
    console.log(`\nGroup ${groupIndex + 1}: "${group[0].title}" by ${group[0].author || 'Unknown'}`);
    console.log(`  ${group.length} copies found:`);
    
    group.forEach((book, index) => {
      const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown size';
      const addedDate = book.added_at ? new Date(book.added_at).toLocaleDateString() : 'Unknown';
      const hasMetadata = book.description ? '📚' : '  ';
      const hasRating = book.average_rating ? `⭐${book.average_rating.toFixed(1)}` : '   ';
      
      console.log(`    ${index + 1}. [ID: ${book.id}] ${fileSize} | Added: ${addedDate} | ${hasMetadata} ${hasRating}`);
      console.log(`       File: ${book.file_path}`);
    });

    totalDuplicates += (group.length - 1);
  });

  console.log(`\n📊 Summary: ${totalDuplicates} duplicate books to potentially remove\n`);
  
  return totalDuplicates;
}

/**
 * Choose which book to keep in a duplicate group
 */
function chooseBestBook(books, strategy = 'newest') {
  if (books.length === 0) return null;
  if (books.length === 1) return books[0];

  let bestBook = books[0];

  switch (strategy) {
    case 'newest':
      // Keep the most recently added book
      bestBook = books.reduce((best, book) => {
        return new Date(book.added_at) > new Date(best.added_at) ? book : best;
      }, books[0]);
      break;

    case 'oldest':
      // Keep the oldest book
      bestBook = books.reduce((best, book) => {
        return new Date(book.added_at) < new Date(best.added_at) ? book : best;
      }, books[0]);
      break;

    case 'largest':
      // Keep the largest file (assuming better quality)
      bestBook = books.reduce((best, book) => {
        return (book.file_size || 0) > (best.file_size || 0) ? book : best;
      }, books[0]);
      break;

    case 'best-metadata':
      // Keep the book with most complete metadata
      bestBook = books.reduce((best, book) => {
        const bookScore = (
          (book.description ? 1 : 0) +
          (book.average_rating ? 1 : 0) +
          (book.cover_image ? 1 : 0) +
          (book.isbn_13 ? 1 : 0) +
          (book.publisher ? 1 : 0)
        );
        
        const bestScore = (
          (best.description ? 1 : 0) +
          (best.average_rating ? 1 : 0) +
          (best.cover_image ? 1 : 0) +
          (best.isbn_13 ? 1 : 0) +
          (best.publisher ? 1 : 0)
        );
        
        return bookScore > bestScore ? book : best;
      }, books[0]);
      break;

    default:
      bestBook = books[0];
  }

  return bestBook;
}

/**
 * Delete duplicate books
 */
async function deleteDuplicates(duplicateGroups, options = {}) {
  const {
    dryRun = false,
    deleteFiles = false,
    keepStrategy = 'newest',
    interactive = false
  } = options;

  const results = {
    deleted: [],
    kept: [],
    failed: [],
    filesDeleted: 0
  };

  for (const [groupIndex, group] of duplicateGroups.entries()) {
    console.log(`\n[${groupIndex + 1}/${duplicateGroups.length}] Processing group: "${group[0].title}"`);

    let bookToKeep;

    if (interactive) {
      // Interactive mode - let user choose
      console.log('\nWhich book do you want to keep?');
      group.forEach((book, index) => {
        const fileSize = book.file_size ? `${(book.file_size / 1024 / 1024).toFixed(2)} MB` : 'Unknown';
        console.log(`  ${index + 1}. [ID: ${book.id}] ${fileSize} | Added: ${new Date(book.added_at).toLocaleDateString()}`);
      });

      const choice = await question(`Enter number to keep (1-${group.length}), or 's' to skip: `);
      
      if (choice.toLowerCase() === 's') {
        console.log('  Skipped');
        continue;
      }

      const choiceNum = parseInt(choice);
      if (choiceNum >= 1 && choiceNum <= group.length) {
        bookToKeep = group[choiceNum - 1];
      } else {
        console.log('  Invalid choice, skipping');
        continue;
      }
    } else {
      // Automatic mode - use strategy
      bookToKeep = chooseBestBook(group, keepStrategy);
    }

    console.log(`  Keeping: [ID: ${bookToKeep.id}] (${keepStrategy} strategy)`);
    results.kept.push(bookToKeep.id);

    // Delete the rest
    for (const book of group) {
      if (book.id === bookToKeep.id) continue;

      console.log(`  Deleting: [ID: ${book.id}]`);

      if (dryRun) {
        console.log(`    [DRY RUN] Would delete book`);
        results.deleted.push(book.id);
        continue;
      }

      try {
        // Delete file if requested
        if (deleteFiles) {
          try {
            await fs.unlink(book.file_path);
            console.log(`    ✓ File deleted: ${book.file_path}`);
            results.filesDeleted++;
          } catch (fileErr) {
            console.log(`    ⚠ Could not delete file: ${fileErr.message}`);
          }
        }

        // Delete from database
        await Book.delete(book.id);
        console.log(`    ✓ Removed from database`);
        results.deleted.push(book.id);
      } catch (error) {
        console.error(`    ✗ Error deleting book: ${error.message}`);
        results.failed.push({ id: book.id, error: error.message });
      }
    }
  }

  return results;
}

/**
 * Main function
 */
async function main() {
  console.log('=== BookServe Duplicate Remover ===\n');

  // Parse command line arguments
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
BookServe Duplicate Book Remover
Find and remove duplicate books from your library

Usage:
  node scripts/removeDuplicates.js [options]

Options:
  --dry-run              Preview changes without deleting
  --delete-files         Also delete physical book files (not just database entries)
  --interactive, -i      Manually choose which book to keep for each duplicate
  --keep <strategy>      Strategy for choosing which book to keep (default: newest)
                         Options: newest, oldest, largest, best-metadata
  --match <criteria>     How to identify duplicates (default: title-author)
                         Options: title-author, title-only, isbn
  --help, -h             Show this help

Strategies:
  newest        - Keep the most recently added book
  oldest        - Keep the oldest book
  largest       - Keep the largest file (best quality)
  best-metadata - Keep the book with most complete metadata

Examples:
  # Preview duplicates without deleting
  node scripts/removeDuplicates.js --dry-run

  # Delete duplicates, keep newest, remove files
  node scripts/removeDuplicates.js --delete-files

  # Interactive mode - choose which to keep
  node scripts/removeDuplicates.js --interactive

  # Keep the book with best metadata
  node scripts/removeDuplicates.js --keep best-metadata

  # Match by title only (more aggressive)
  node scripts/removeDuplicates.js --match title-only --dry-run
    `);
    rl.close();
    process.exit(0);
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    deleteFiles: args.includes('--delete-files'),
    interactive: args.includes('--interactive') || args.includes('-i'),
    keepStrategy: args.includes('--keep') ? args[args.indexOf('--keep') + 1] : 'newest',
    matchCriteria: args.includes('--match') ? args[args.indexOf('--match') + 1] : 'title-author'
  };

  console.log('Configuration:');
  console.log(`  Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`  Delete files: ${options.deleteFiles}`);
  console.log(`  Interactive: ${options.interactive}`);
  console.log(`  Keep strategy: ${options.keepStrategy}`);
  console.log(`  Match criteria: ${options.matchCriteria}`);
  console.log('');

  // Initialize database
  console.log('Initializing database...');
  await initDatabase();

  // Find duplicates
  const duplicateGroups = await findDuplicates({ matchCriteria: options.matchCriteria });

  if (duplicateGroups.length === 0) {
    console.log('\n✓ No duplicates found! Your library is clean.\n');
    rl.close();
    process.exit(0);
  }

  // Display duplicates
  displayDuplicates(duplicateGroups);

  // Confirm before deletion
  if (!options.dryRun && !options.interactive) {
    const confirm = await question('Proceed with deletion? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
      console.log('\nCancelled.');
      rl.close();
      process.exit(0);
    }
  }

  // Delete duplicates
  console.log('\nProcessing duplicates...');
  const results = await deleteDuplicates(duplicateGroups, options);

  // Print summary
  console.log('\n\n=== Summary ===');
  console.log(`Books kept: ${results.kept.length}`);
  console.log(`Books deleted: ${results.deleted.length}`);
  console.log(`Files deleted: ${results.filesDeleted}`);
  console.log(`Failed deletions: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed deletions:');
    results.failed.forEach(({ id, error }) => {
      console.log(`  - Book ID ${id}: ${error}`);
    });
  }

  if (options.dryRun) {
    console.log('\n⚠ This was a DRY RUN. No changes were made.');
    console.log('Run without --dry-run to actually delete duplicates.');
  } else {
    console.log('\n✓ Duplicate removal complete!\n');
  }

  rl.close();
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFatal error:', error);
    rl.close();
    process.exit(1);
  });
