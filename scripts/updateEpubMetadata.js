#!/usr/bin/env node

/**
 * Script to update existing books with metadata extracted from EPUB files
 * This will re-extract title, author, and other metadata from the EPUB files
 * Usage: node scripts/updateEpubMetadata.js [options]
 */

require('dotenv').config();
const { initDatabase } = require('../server/database/init');
const Book = require('../server/models/Book');
const epubMetadataService = require('../server/services/epubMetadataService');
const fs = require('fs');
const path = require('path');

async function updateBookMetadata(book, options = {}) {
  const { dryRun = false, verbose = false } = options;

  console.log(`\n[Book ID: ${book.id}] ${book.title} by ${book.author || 'Unknown'}`);

  // Check if file exists
  if (!fs.existsSync(book.file_path)) {
    console.log(`  ⚠ Warning: File not found at ${book.file_path}`);
    return { success: false, error: 'File not found' };
  }

  // Only process EPUB files
  if (book.format !== 'epub') {
    if (verbose) {
      console.log(`  ⊘ Skipping (not an EPUB)`);
    }
    return { success: false, error: 'Not an EPUB file' };
  }

  try {
    // Extract metadata from EPUB
    console.log(`  Extracting metadata from EPUB file...`);
    const epubMetadata = epubMetadataService.extractMetadata(book.file_path);

    // Compare with current data
    const changes = [];

    if (epubMetadata.title && epubMetadata.title !== book.title) {
      changes.push(`Title: "${book.title}" → "${epubMetadata.title}"`);
    }

    if (epubMetadata.author && epubMetadata.author !== book.author) {
      changes.push(`Author: "${book.author}" → "${epubMetadata.author}"`);
    }

    if (epubMetadata.publisher && epubMetadata.publisher !== book.publisher) {
      changes.push(`Publisher: "${book.publisher || 'none'}" → "${epubMetadata.publisher}"`);
    }

    if (epubMetadata.description && !book.description) {
      changes.push(`Description: Added (${epubMetadata.description.substring(0, 50)}...)`);
    }

    if (epubMetadata.isbn_13 && epubMetadata.isbn_13 !== book.isbn_13) {
      changes.push(`ISBN-13: "${book.isbn_13 || 'none'}" → "${epubMetadata.isbn_13}"`);
    }

    if (epubMetadata.isbn && epubMetadata.isbn !== book.isbn) {
      changes.push(`ISBN: "${book.isbn || 'none'}" → "${epubMetadata.isbn}"`);
    }

    if (changes.length === 0) {
      console.log(`  ✓ No changes needed - metadata is up to date`);
      return { success: true, updated: false };
    }

    // Display changes
    console.log(`  Changes to apply:`);
    changes.forEach(change => console.log(`    - ${change}`));

    if (dryRun) {
      console.log(`  [DRY RUN] Would update book`);
      return { success: true, updated: false, dryRun: true };
    }

    // Prepare update data - only update fields that have values from EPUB
    const updateData = {};

    if (epubMetadata.title) {
      updateData.title = epubMetadata.title;
    }

    if (epubMetadata.author) {
      updateData.author = epubMetadata.author;
    }

    if (epubMetadata.publisher) {
      updateData.publisher = epubMetadata.publisher;
    }

    if (epubMetadata.published_date) {
      updateData.published_date = epubMetadata.published_date;
    }

    if (epubMetadata.description && !book.description) {
      updateData.description = epubMetadata.description;
    }

    if (epubMetadata.language) {
      updateData.language = epubMetadata.language;
    }

    if (epubMetadata.isbn) {
      updateData.isbn = epubMetadata.isbn;
    }

    if (epubMetadata.isbn_13) {
      updateData.isbn_13 = epubMetadata.isbn_13;
    }

    // Update the book
    await Book.update(book.id, updateData);
    console.log(`  ✓ Successfully updated`);

    return { success: true, updated: true, changes: changes.length };
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function updateAllBooks(options = {}) {
  const { dryRun = false, verbose = false, limit = null } = options;

  console.log('=== BookServe EPUB Metadata Update Tool ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE UPDATE'}`);
  console.log(`Verbose: ${verbose}`);
  if (limit) {
    console.log(`Limit: ${limit} books`);
  }
  console.log('');

  // Initialize database
  console.log('Initializing database...');
  await initDatabase();

  // Get all books
  console.log('Loading books from database...');
  const allBooks = await Book.findAll(10000, 0); // Get up to 10000 books
  const books = limit ? allBooks.slice(0, limit) : allBooks;

  console.log(`Found ${books.length} books in database`);

  if (books.length === 0) {
    console.log('No books found. Exiting.');
    process.exit(0);
  }

  // Process each book
  const results = {
    success: [],
    updated: [],
    skipped: [],
    failed: []
  };

  for (let i = 0; i < books.length; i++) {
    const book = books[i];

    console.log(`\n[${i + 1}/${books.length}] Processing book ID ${book.id}`);

    const result = await updateBookMetadata(book, options);

    if (result.success) {
      results.success.push(book.id);
      if (result.updated) {
        results.updated.push({ id: book.id, changes: result.changes });
      } else {
        results.skipped.push(book.id);
      }
    } else {
      results.failed.push({ id: book.id, error: result.error });
    }
  }

  // Print summary
  console.log('\n\n=== Update Summary ===');
  console.log(`Total books processed: ${books.length}`);
  console.log(`Successfully processed: ${results.success.length}`);
  console.log(`Updated: ${results.updated.length}`);
  console.log(`Skipped (no changes): ${results.skipped.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.updated.length > 0) {
    console.log(`\nTotal changes applied: ${results.updated.reduce((sum, r) => sum + r.changes, 0)}`);
  }

  if (results.failed.length > 0) {
    console.log('\nFailed updates:');
    results.failed.forEach(({ id, error }) => {
      console.log(`  - Book ID ${id}: ${error}`);
    });
  }

  if (dryRun) {
    console.log('\n⚠ This was a DRY RUN. No changes were made to the database.');
    console.log('Run without --dry-run to apply changes.');
  } else {
    console.log('\n✓ Update complete!\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
BookServe EPUB Metadata Update Tool
Re-extract metadata from EPUB files and update the database

Usage:
  node scripts/updateEpubMetadata.js [options]

Options:
  --dry-run             Preview changes without applying them
  --verbose, -v         Show detailed output for all books
  --limit <number>      Only process first N books
  --help, -h            Show this help

Examples:
  # Preview what would be changed (dry run)
  node scripts/updateEpubMetadata.js --dry-run

  # Update all books with metadata from EPUB files
  node scripts/updateEpubMetadata.js

  # Update first 10 books only (for testing)
  node scripts/updateEpubMetadata.js --limit 10

  # Verbose output with dry run
  node scripts/updateEpubMetadata.js --dry-run --verbose
  `);
  process.exit(0);
}

const options = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  limit: args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : null
};

// Run update
updateAllBooks(options)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });
