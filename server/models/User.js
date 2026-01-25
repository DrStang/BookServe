const { db } = require('../database/init');
const bcrypt = require('bcryptjs');

class User {
  static async create(username, email, password, role = 'user') {
    const hashedPassword = await bcrypt.hash(password, 10);

    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [username, email, hashedPassword, role],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, username, email, role });
          }
        }
      );
    });
  }

  static async findByUsername(username) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findByEmail(email) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT id, username, email, role, created_at FROM users WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static async updateLastLogin(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
        [userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
  static async findByIdWithPassword(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

static async updatePassword(userId, newPassword) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  return new Promise((resolve, reject) => {
    db.run(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

  static async getAll() {
    return new Promise((resolve, reject) => {
      db.all('SELECT id, username, email, role, created_at, last_login FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
  static async getKindleEmail(userId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT kindle_email FROM users WHERE id = ?', [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row?.kindle_email || null);
      });
    });
  }
  static async saveKindleEmail(userId, kindleEmail) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET kindle_email = ? WHERE id = ?',
        [kindleEmail, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0, kindle_email: kindleEmail });
        }
      );
    });
  }
   // Clear user's saved kindle email
  static async clearKindleEmail(userId) {
    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET kindle_email = NULL WHERE id = ?',
        [userId],
        function(err) {
          if (err) reject(err);
          else resolve({ cleared: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = User;
