const { db } = require('../database/init');

class ReadingProgress {
  // Get user's progress for a specific book
  static getProgress(userId, bookId) {
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?',
        [userId, bookId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  // Get all books in progress for a user
  static getAllProgress(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT rp.*, b.title, b.author, b.cover_image
         FROM reading_progress rp
         JOIN books b ON rp.book_id = b.id
         WHERE rp.user_id = ?
         ORDER BY rp.last_read DESC`,
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Get recently read books (last 30 days)
  static getRecentlyRead(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT rp.*, b.title, b.author, b.cover_image
         FROM reading_progress rp
         JOIN books b ON rp.book_id = b.id
         WHERE rp.user_id = ? AND rp.last_read >= datetime('now', '-30 days')
         ORDER BY rp.last_read DESC
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Get books currently being read (progress > 0 and < 100)
  static getContinueReading(userId, limit = 10) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT rp.*, b.title, b.author, b.cover_image
         FROM reading_progress rp
         JOIN books b ON rp.book_id = b.id
         WHERE rp.user_id = ? AND rp.progress > 0 AND rp.progress < 100
         ORDER BY rp.last_read DESC
         LIMIT ?`,
        [userId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Update or create progress
  static upsertProgress(userId, bookId, progress, currentLocation) {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO reading_progress (user_id, book_id, progress, current_location, last_read)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id, book_id) DO UPDATE SET
           progress = excluded.progress,
           current_location = excluded.current_location,
           last_read = CURRENT_TIMESTAMP`,
        [userId, bookId, progress, currentLocation],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  }

  // Delete progress for a book
  static deleteProgress(userId, bookId) {
    return new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM reading_progress WHERE user_id = ? AND book_id = ?',
        [userId, bookId],
        function(err) {
          if (err) reject(err);
          else resolve({ deleted: this.changes });
        }
      );
    });
  }
}

module.exports = ReadingProgress;
