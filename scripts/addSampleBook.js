#!/usr/bin/env node

/**
 * Script to add a sample book and test metadata fetching
 * Usage: node scripts/addSampleBook.js
 */

require('dotenv').config();
const { db, initDatabase } = require('../server/database/init');
const Book = require('../server/models/Book');
const metadataService = require('../server/services/metadataService');
const path = require('path');
const fs = require('fs');

async function addSampleBook() {
  try {
    console.log('Initializing database...');
    await initDatabase();

    // Create a dummy EPUB file for testing
    const booksDir = process.env.BOOKS_STORAGE_PATH || './data/books';
    if (!fs.existsSync(booksDir)) {
      fs.mkdirSync(booksDir, { recursive: true });
    }

    const dummyFilePath = path.join(booksDir, 'sample-book.epub');
    if (!fs.existsSync(dummyFilePath)) {
      fs.writeFileSync(dummyFilePath, 'Dummy EPUB content for testing');
    }

    console.log('\nAdding sample book: "The Great Gatsby" by F. Scott Fitzgerald...');

    const bookData = {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      isbn: '9780743273565',
      file_path: dummyFilePath,
      file_size: fs.statSync(dummyFilePath).size,
      format: 'epub',
      language: 'en',
      added_by: 1
    };

    const book = await Book.create(bookData);
    console.log('✓ Book added with ID:', book.id);

    console.log('\nFetching metadata from Google Books and OpenLibrary...');
    const updatedBook = await metadataService.updateBookMetadata(book.id, true);

    console.log('\n=== Book Details ===');
    console.log('Title:', updatedBook.title);
    console.log('Author:', updatedBook.author);
    console.log('Publisher:', updatedBook.publisher);
    console.log('Published:', updatedBook.published_date);
    console.log('Pages:', updatedBook.page_count);
    console.log('Rating:', updatedBook.average_rating);
    console.log('Ratings Count:', updatedBook.ratings_count);
    console.log('Categories:', updatedBook.categories);
    console.log('Description:', updatedBook.description ? updatedBook.description.substring(0, 100) + '...' : 'N/A');
    console.log('Google Books ID:', updatedBook.google_books_id);
    console.log('OpenLibrary ID:', updatedBook.openlibrary_id);

    console.log('\n✓ Sample book added successfully with metadata!');
    console.log('You can now view it in the web interface.');

    process.exit(0);
  } catch (error) {
    console.error('Error adding sample book:', error);
    process.exit(1);
  }
}

// Add another book option
async function addMultipleSamples() {
  try {
    console.log('Initializing database...');
    await initDatabase();

    const booksDir = process.env.BOOKS_STORAGE_PATH || './data/books';
    if (!fs.existsSync(booksDir)) {
      fs.mkdirSync(booksDir, { recursive: true });
    }

    const sampleBooks = [
      {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        isbn: '9780743273565'
      },
      {
        title: '1984',
        author: 'George Orwell',
        isbn: '9780451524935'
      },
      {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        isbn: '9780061120084'
      },
      {
        title: 'Pride and Prejudice',
        author: 'Jane Austen',
        isbn: '9780141439518'
      },
      {
        title: 'The Hobbit',
        author: 'J.R.R. Tolkien',
        isbn: '9780547928227'
      }
    ];

    for (const bookInfo of sampleBooks) {
      const dummyFilePath = path.join(booksDir, `${bookInfo.title.replace(/\s/g, '-')}.epub`);
      if (!fs.existsSync(dummyFilePath)) {
        fs.writeFileSync(dummyFilePath, 'Dummy EPUB content for testing');
      }

      console.log(`\nAdding: "${bookInfo.title}" by ${bookInfo.author}...`);

      const bookData = {
        ...bookInfo,
        file_path: dummyFilePath,
        file_size: fs.statSync(dummyFilePath).size,
        format: 'epub',
        language: 'en',
        added_by: 1
      };

      const book = await Book.create(bookData);
      console.log('✓ Book added with ID:', book.id);

      console.log('  Fetching metadata...');
      await metadataService.updateBookMetadata(book.id, true);
      console.log('  ✓ Metadata fetched');

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✓ All sample books added successfully!');
    console.log('You can now view them in the web interface.');

    process.exit(0);
  } catch (error) {
    console.error('Error adding sample books:', error);
    process.exit(1);
  }
}

// Check command line arguments
const args = process.argv.slice(2);
if (args.includes('--multiple') || args.includes('-m')) {
  addMultipleSamples();
} else {
  addSampleBook();
}
