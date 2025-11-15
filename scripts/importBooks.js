#!/usr/bin/env node

/**
 * Script to import existing EPUB files into BookServe
 * Usage: node scripts/importBooks.js /path/to/your/books/folder
 */

require('dotenv').config();
const { initDatabase } = require('../server/database/init');
const Book = require('../server/models/Book');
const metadataService = require('../server/services/metadataService');
const fs = require('fs');
const path = require('path');

// Parse book info from filename
function parseFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.epub$/i, '');

  // Common patterns:
  // "Author Name - Book Title.epub"
  // "Book Title - Author Name.epub"
  // "Book Title.epub"

  let title = nameWithoutExt;
  let author = null;

  // Try to split by " - "
  if (nameWithoutExt.includes(' - ')) {
    const parts = nameWithoutExt.split(' - ');
    if (parts.length === 2) {
      // Assume "Author - Title" or "Title - Author"
      // We'll use both and let metadata service figure it out
      title = parts[1].trim();
      author = parts[0].trim();

      // If first part looks like a title (starts with "The", etc), swap them
      if (parts[0].match(/^(The|A|An)\s/i)) {
        title = parts[0].trim();
        author = parts[1].trim();
      }
    }
  }

  return { title, author };
}

async function importBook(filePath, sourceFolder, userId = 1, fetchMetadata = true) {
  const filename = path.basename(filePath);
  const stats = fs.statSync(filePath);

  // Parse filename for initial data
  const { title, author } = parseFilename(filename);

  console.log(`\nImporting: ${filename}`);
  console.log(`  Detected - Title: "${title}", Author: "${author || 'Unknown'}"`);

  // Prepare book data
  const bookData = {
    title,
    author,
    file_path: filePath,
    file_size: stats.size,
    format: 'epub',
    language: 'en',
    added_by: userId
  };

  try {
    // Create book entry
    const book = await Book.create(bookData);
    console.log(`  ✓ Added to database with ID: ${book.id}`);

    // Fetch metadata if requested
    if (fetchMetadata) {
      console.log(`  Fetching metadata from Google Books and OpenLibrary...`);
      try {
        const updatedBook = await metadataService.updateBookMetadata(book.id, true);

        if (updatedBook.average_rating) {
          console.log(`  ✓ Metadata fetched - Rating: ${updatedBook.average_rating.toFixed(1)} (${updatedBook.ratings_count} reviews)`);
        } else {
          console.log(`  ✓ Metadata fetched`);
        }

        if (updatedBook.description) {
          console.log(`  ✓ Description: ${updatedBook.description.substring(0, 80)}...`);
        }
      } catch (metaError) {
        console.log(`  ⚠ Warning: Could not fetch metadata - ${metaError.message}`);
      }
    }

    return { success: true, book };
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function importFolder(folderPath, options = {}) {
  const {
    recursive = true,
    fetchMetadata = true,
    userId = 1,
    copyFiles = false,
    targetFolder = process.env.BOOKS_STORAGE_PATH || './data/books'
  } = options;

  console.log('=== BookServe Import Tool ===');
  console.log(`Source folder: ${folderPath}`);
  console.log(`Recursive: ${recursive}`);
  console.log(`Fetch metadata: ${fetchMetadata}`);
  console.log(`Copy files: ${copyFiles}`);
  if (copyFiles) {
    console.log(`Target folder: ${targetFolder}`);
  }
  console.log('');

  // Check if folder exists
  if (!fs.existsSync(folderPath)) {
    console.error(`Error: Folder not found: ${folderPath}`);
    process.exit(1);
  }

  // Initialize database
  console.log('Initializing database...');
  await initDatabase();

  // Create target folder if copying
  if (copyFiles && !fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // Find all EPUB files
  const epubFiles = [];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && recursive) {
        scanDirectory(fullPath);
      } else if (stat.isFile() && item.toLowerCase().endsWith('.epub')) {
        epubFiles.push(fullPath);
      }
    }
  }

  console.log('Scanning for EPUB files...');
  scanDirectory(folderPath);
  console.log(`Found ${epubFiles.length} EPUB files\n`);

  if (epubFiles.length === 0) {
    console.log('No EPUB files found. Exiting.');
    process.exit(0);
  }

  // Import each book
  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < epubFiles.length; i++) {
    const filePath = epubFiles[i];

    console.log(`\n[${i + 1}/${epubFiles.length}] Processing: ${path.basename(filePath)}`);

    let targetPath = filePath;

    // Copy file if requested
    if (copyFiles) {
      const newFilename = `${Date.now()}-${path.basename(filePath)}`;
      targetPath = path.join(targetFolder, newFilename);

      console.log(`  Copying to: ${targetPath}`);
      fs.copyFileSync(filePath, targetPath);
    }

    // Import book
    const result = await importBook(targetPath, folderPath, userId, fetchMetadata);

    if (result.success) {
      results.success.push(filePath);
    } else {
      results.failed.push({ file: filePath, error: result.error });
    }

    // Small delay to avoid rate limiting on metadata APIs
    if (fetchMetadata && i < epubFiles.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log('\n\n=== Import Summary ===');
  console.log(`Total files: ${epubFiles.length}`);
  console.log(`Successfully imported: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed imports:');
    results.failed.forEach(({ file, error }) => {
      console.log(`  - ${path.basename(file)}: ${error}`);
    });
  }

  console.log('\n✓ Import complete!\n');
}

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
BookServe Import Tool
Import existing EPUB files into your BookServe library

Usage:
  node scripts/importBooks.js <folder-path> [options]

Options:
  --no-recursive        Don't scan subdirectories
  --no-metadata         Skip metadata fetching (faster)
  --copy                Copy files to BookServe storage folder
  --user-id <id>        User ID to attribute books to (default: 1)
  --help, -h            Show this help

Examples:
  # Import all EPUBs from a folder (use files in place)
  node scripts/importBooks.js /path/to/your/books

  # Import and copy files to BookServe storage
  node scripts/importBooks.js /path/to/your/books --copy

  # Import without fetching metadata (much faster)
  node scripts/importBooks.js /path/to/your/books --no-metadata

  # Import only from specific folder, not subdirectories
  node scripts/importBooks.js /path/to/your/books --no-recursive
  `);
  process.exit(0);
}

const folderPath = path.resolve(args[0]);
const options = {
  recursive: !args.includes('--no-recursive'),
  fetchMetadata: !args.includes('--no-metadata'),
  copyFiles: args.includes('--copy'),
  userId: args.includes('--user-id') ? parseInt(args[args.indexOf('--user-id') + 1]) : 1
};

// Run import
importFolder(folderPath, options)
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('\nFatal error:', error);
    process.exit(1);
  });
