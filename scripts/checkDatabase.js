#!/usr/bin/env node

/**
 * Script to check database status and books
 * Usage: node scripts/checkDatabase.js
 */

require('dotenv').config();
const { db, initDatabase } = require('../server/database/init');

async function checkDatabase() {
  try {
    console.log('Initializing database...');
    await initDatabase();

    // Check books table structure
    console.log('\n=== Books Table Structure ===');
    await new Promise((resolve, reject) => {
      db.all('PRAGMA table_info(books)', (err, columns) => {
        if (err) {
          reject(err);
        } else {
          console.log('Columns:');
          columns.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
          });
          resolve();
        }
      });
    });

    // Count books
    console.log('\n=== Books Count ===');
    await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM books', (err, row) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Total books: ${row.count}`);
          resolve();
        }
      });
    });

    // List all books
    console.log('\n=== All Books ===');
    await new Promise((resolve, reject) => {
      db.all('SELECT id, title, author, average_rating, ratings_count FROM books', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          if (rows.length === 0) {
            console.log('No books found in database.');
            console.log('\nTo add sample books, run:');
            console.log('  node scripts/addSampleBook.js');
            console.log('  node scripts/addSampleBook.js --multiple  (adds 5 books)');
          } else {
            rows.forEach(book => {
              console.log(`\n[${book.id}] ${book.title}`);
              console.log(`    Author: ${book.author || 'N/A'}`);
              console.log(`    Rating: ${book.average_rating ? book.average_rating.toFixed(1) : 'N/A'} (${book.ratings_count || 0} ratings)`);
            });
          }
          resolve();
        }
      });
    });

    // Check users
    console.log('\n=== Users Count ===');
    await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) {
          reject(err);
        } else {
          console.log(`Total users: ${row.count}`);
          resolve();
        }
      });
    });

    console.log('\n✓ Database check complete\n');
    process.exit(0);
  } catch (error) {
    console.error('Error checking database:', error);
    process.exit(1);
  }
}

checkDatabase();
