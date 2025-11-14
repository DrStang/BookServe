const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/bookserve.db';

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Initialize database schema
const initDatabase = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT DEFAULT 'user',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME
        )
      `, (err) => {
        if (err) console.error('Error creating users table:', err);
      });

      // Books table
      db.run(`
        CREATE TABLE IF NOT EXISTS books (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT,
          isbn TEXT,
          publisher TEXT,
          published_date TEXT,
          description TEXT,
          cover_image TEXT,
          file_path TEXT NOT NULL,
          file_size INTEGER,
          format TEXT DEFAULT 'epub',
          language TEXT,
          added_by INTEGER,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (added_by) REFERENCES users(id)
        )
      `, (err) => {
        if (err) console.error('Error creating books table:', err);
      });

      // Book requests table
      db.run(`
        CREATE TABLE IF NOT EXISTS book_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          author TEXT,
          isbn TEXT,
          openlibrary_id TEXT,
          status TEXT DEFAULT 'pending',
          nzb_search_id TEXT,
          sabnzbd_id TEXT,
          error_message TEXT,
          requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) console.error('Error creating book_requests table:', err);
      });

      // User reading progress table
      db.run(`
        CREATE TABLE IF NOT EXISTS reading_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          progress REAL DEFAULT 0,
          current_location TEXT,
          last_read DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (book_id) REFERENCES books(id),
          UNIQUE(user_id, book_id)
        )
      `, (err) => {
        if (err) console.error('Error creating reading_progress table:', err);
      });

      // Download history table
      db.run(`
        CREATE TABLE IF NOT EXISTS download_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          book_id INTEGER NOT NULL,
          download_type TEXT,
          downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating download_history table:', err);
          reject(err);
        } else {
          console.log('Database schema initialized');
          resolve();
        }
      });
    });
  });
};

module.exports = { db, initDatabase };
