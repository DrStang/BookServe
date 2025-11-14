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
}

module.exports = BookRequest;
