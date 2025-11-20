const { db } = require('../database/init');

class BookRequest {
  static async create(requestData) {
    const {
      user_id,
      title,
      author,
      isbn,
      openlibrary_id
    } = requestData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO book_requests (
          user_id, title, author, isbn, openlibrary_id, status
        ) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [user_id, title, author, isbn, openlibrary_id],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...requestData, status: 'pending' });
          }
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM book_requests WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findByUserId(userId) {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM book_requests WHERE user_id = ? ORDER BY requested_at DESC',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async findAll(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT br.*, u.username
         FROM book_requests br
         JOIN users u ON br.user_id = u.id
         ORDER BY br.requested_at DESC
         LIMIT ? OFFSET ?`,
        [limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async updateStatus(id, status, additionalData = {}) {
    const fields = ['status = ?'];
    const values = [status];

    Object.keys(additionalData).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(additionalData[key]);
    });

    if (status === 'completed') {
      fields.push('completed_at = CURRENT_TIMESTAMP');
    }

    values.push(id);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE book_requests SET ${fields.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }

  static async getPendingRequests() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM book_requests WHERE status IN ('pending', 'searching', 'downloading')`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  // Get failed requests that are ready for retry
  static async getFailedRequestsForRetry() {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT br.*, u.email, u.username, u.email_notifications
         FROM book_requests br
         JOIN users u ON br.user_id = u.id
         WHERE br.status = 'failed'
         AND br.retry_count < br.max_retries
         AND (br.next_retry_at IS NULL OR br.next_retry_at <= datetime('now'))`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Schedule a request for retry
  static async scheduleRetry(id, retryIntervalDays = 3) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE book_requests
         SET next_retry_at = datetime('now', '+' || ? || ' days')
         WHERE id = ?`,
        [retryIntervalDays, id],
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }

  // Increment retry count and update last retry timestamp
  static async incrementRetryCount(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE book_requests
         SET retry_count = retry_count + 1,
             last_retry_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [id],
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }

  // Reset retry status when moving to a non-failed state
  static async resetRetryStatus(id) {
    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE book_requests
         SET next_retry_at = NULL,
             retry_count = 0
         WHERE id = ?`,
        [id],
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = BookRequest;
