#!/usr/bin/env node

 

/**

 * Script to bulk rename/update book metadata in BookServe

 * Usage: node scripts/bulkRenameBooks.js [options]

 */

 

require('dotenv').config();

const { initDatabase } = require('../server/database/init');

const Book = require('../server/models/Book');

const readline = require('readline');

 

const rl = readline.createInterface({

  input: process.stdin,

  output: process.stdout

});

 

function question(query) {

  return new Promise(resolve => rl.question(query, resolve));

}

 

async function listBooks() {

  const books = await Book.findAll(1000, 0);

  console.log('\n=== Current Books ===');

  books.forEach((book, index) => {

    console.log(`[${book.id}] ${book.title} - ${book.author || 'Unknown'}`);

  });

  console.log(`\nTotal: ${books.length} books\n`);

  return books;

}

 

async function bulkUpdatePattern() {

  console.log('\n=== Bulk Update with Pattern ===');

  console.log('Example: Remove "ebook-" prefix from all titles\n');

 

  const books = await Book.findAll(1000, 0);

 

  const pattern = await question('Enter search pattern (regex): ');

  const replacement = await question('Enter replacement text: ');

  const field = await question('Field to update (title/author): ');

 

  if (field !== 'title' && field !== 'author') {

    console.log('Invalid field. Must be "title" or "author"');

    return;

  }

 

  const regex = new RegExp(pattern, 'gi');

  const updates = [];

 

  books.forEach(book => {

    if (book[field]) {

      const newValue = book[field].replace(regex, replacement);

      if (newValue !== book[field]) {

        updates.push({

          id: book.id,

          old: book[field],

          new: newValue

        });

      }

    }

  });

 

  if (updates.length === 0) {

    console.log('\nNo matches found.');

    return;

  }

 

  console.log(`\nWill update ${updates.length} books:`);

  updates.slice(0, 10).forEach(u => {

    console.log(`  [${u.id}] "${u.old}" => "${u.new}"`);

  });

 

  if (updates.length > 10) {

    console.log(`  ... and ${updates.length - 10} more`);

  }

 

  const confirm = await question('\nProceed with updates? (yes/no): ');

 

  if (confirm.toLowerCase() !== 'yes') {

    console.log('Cancelled.');

    return;

  }

 

  for (const update of updates) {

    await Book.update(update.id, { [field]: update.new });

  }

 

  console.log(`\n✓ Updated ${updates.length} books successfully!`);

}

 

async function bulkUpdateSpecific() {

  const books = await listBooks();

 

  const idsInput = await question('Enter book IDs to update (comma-separated): ');

  const ids = idsInput.split(',').map(id => parseInt(id.trim()));

 

  if (ids.some(isNaN)) {

    console.log('Invalid IDs provided');

    return;

  }

 

  const field = await question('Field to update (title/author/isbn/publisher): ');

  const value = await question(`New value for ${field}: `);

 

  console.log(`\nWill update ${field} to "${value}" for ${ids.length} books`);

  const confirm = await question('Proceed? (yes/no): ');

 

  if (confirm.toLowerCase() !== 'yes') {

    console.log('Cancelled.');

    return;

  }

 

  for (const id of ids) {

    await Book.update(id, { [field]: value });

  }

 

  console.log(`\n✓ Updated ${ids.length} books successfully!`);

}

 

async function fixCommonIssues() {

  console.log('\n=== Fix Common Issues ===');

  console.log('1. Remove file extensions from titles (.epub, .pdf, etc.)');

  console.log('2. Fix "Author - Title" format (swap author and title)');

  console.log('3. Trim whitespace from titles and authors');

  console.log('4. Remove numeric prefixes (e.g., "001 - Book Title")');

 

  const choice = await question('\nSelect option (1-4): ');

 

  const books = await Book.findAll(1000, 0);

  const updates = [];

 

  switch (choice) {

    case '1':

      // Remove file extensions

      books.forEach(book => {

        if (book.title) {

          const newTitle = book.title.replace(/\.(epub|pdf|mobi|azw3)$/i, '');

          if (newTitle !== book.title) {

            updates.push({ id: book.id, title: newTitle });

          }

        }

      });

      break;

 

    case '2':

      // Fix Author - Title format

      books.forEach(book => {

        if (book.title && book.title.includes(' - ')) {

          const parts = book.title.split(' - ');

          if (parts.length === 2 && !book.author) {

            // Assume first part is author if book.author is empty

            updates.push({

              id: book.id,

              title: parts[1].trim(),

              author: parts[0].trim()

            });

          }

        }

      });

      break;

 

    case '3':

      // Trim whitespace

      books.forEach(book => {

        const update = {};

        if (book.title && book.title !== book.title.trim()) {

          update.title = book.title.trim();

        }

        if (book.author && book.author !== book.author.trim()) {

          update.author = book.author.trim();

        }

        if (Object.keys(update).length > 0) {

          updates.push({ id: book.id, ...update });

        }

      });

      break;

 

    case '4':

      // Remove numeric prefixes

      books.forEach(book => {

        if (book.title) {

          const newTitle = book.title.replace(/^\d+[\s\-_.]+/, '');

          if (newTitle !== book.title) {

            updates.push({ id: book.id, title: newTitle });

          }

        }

      });

      break;

 

    default:

      console.log('Invalid option');

      return;

  }

 

  if (updates.length === 0) {

    console.log('\nNo issues found!');

    return;

  }

 

  console.log(`\nWill update ${updates.length} books`);

  updates.slice(0, 10).forEach(u => {

    console.log(`  [${u.id}] Updates: ${JSON.stringify(u)}`);

  });

 

  if (updates.length > 10) {

    console.log(`  ... and ${updates.length - 10} more`);

  }

 

  const confirm = await question('\nProceed? (yes/no): ');

 

  if (confirm.toLowerCase() !== 'yes') {

    console.log('Cancelled.');

    return;

  }

 

  for (const update of updates) {

    const { id, ...fields } = update;

    await Book.update(id, fields);

  }

 

  console.log(`\n✓ Fixed ${updates.length} books successfully!`);

}

 

async function main() {

  console.log('=== BookServe Bulk Rename Tool ===\n');

 

  await initDatabase();

 

  console.log('Options:');

  console.log('1. List all books');

  console.log('2. Bulk update with pattern (regex)');

  console.log('3. Update specific books');

  console.log('4. Fix common issues (auto-detect)');

  console.log('5. Exit\n');

 

  const choice = await question('Select option: ');

 

  switch (choice) {

    case '1':

      await listBooks();

      break;

    case '2':

      await bulkUpdatePattern();

      break;

    case '3':

      await bulkUpdateSpecific();

      break;

    case '4':

      await fixCommonIssues();

      break;

    case '5':

      console.log('Goodbye!');

      rl.close();

      process.exit(0);

      break;

    default:

      console.log('Invalid option');

  }

 

  rl.close();

}

 

main().catch(error => {

  console.error('Error:', error);

  rl.close();

  process.exit(1);

});
