const { db } = require('../database/init');

class Book {
  static async create(bookData) {
    const {
      title,
      author,
      isbn,
      publisher,
      published_date,
      description,
      cover_image,
      file_path,
      file_size,
      format,
      language,
      added_by
    } = bookData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO books (
          title, author, isbn, publisher, published_date,
          description, cover_image, file_path, file_size,
          format, language, added_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, author, isbn, publisher, published_date, description,
         cover_image, file_path, file_size, format, language, added_by],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...bookData });
          }
        }
      );
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM books WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  static async findAll(limit = 100, offset = 0, sortBy = 'added_at', sortOrder = 'DESC', filters = {}) {
    return new Promise((resolve, reject) => {
      // Build WHERE clause for filters
      const whereClauses = [];
      const params = [];

      if (filters.author) {
        whereClauses.push('author LIKE ?');
        params.push(`%${filters.author}%`);
      }

      if (filters.publisher) {
        whereClauses.push('publisher LIKE ?');
        params.push(`%${filters.publisher}%`);
      }

      if (filters.year) {
        whereClauses.push('published_date LIKE ?');
        params.push(`%${filters.year}%`);
      }

      if (filters.language) {
        whereClauses.push('language = ?');
        params.push(filters.language);
      }

      if (filters.format) {
        whereClauses.push('format = ?');
        params.push(filters.format);
      }

      if (filters.categories) {
        whereClauses.push('categories LIKE ?');
        params.push(`%${filters.categories}%`);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Validate sortBy to prevent SQL injection
      const validSortFields = ['title', 'author', 'added_at', 'published_date', 'average_rating'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'added_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      params.push(limit, offset);

      const query = `SELECT * FROM books ${whereClause} ORDER BY ${sortField} ${sortDirection} LIMIT ? OFFSET ?`;

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  static async search(query) {
    return new Promise((resolve, reject) => {
      const searchTerm = `%${query}%`;
      db.all(
        `SELECT * FROM books
         WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ?
         ORDER BY added_at DESC`,
        [searchTerm, searchTerm, searchTerm],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM books WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ deleted: this.changes > 0 });
      });
    });
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    });

    values.push(id);

    return new Promise((resolve, reject) => {
      db.run(
        `UPDATE books SET ${fields.join(', ')} WHERE id = ?`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve({ updated: this.changes > 0 });
        }
      );
    });
  }

  static async count(filters = {}) {
    return new Promise((resolve, reject) => {
      // Build WHERE clause for filters
      const whereClauses = [];
      const params = [];

      if (filters.author) {
        whereClauses.push('author LIKE ?');
        params.push(`%${filters.author}%`);
      }

      if (filters.publisher) {
        whereClauses.push('publisher LIKE ?');
        params.push(`%${filters.publisher}%`);
      }

      if (filters.year) {
        whereClauses.push('published_date LIKE ?');
        params.push(`%${filters.year}%`);
      }

      if (filters.language) {
        whereClauses.push('language = ?');
        params.push(filters.language);
      }

      if (filters.format) {
        whereClauses.push('format = ?');
        params.push(filters.format);
      }

      if (filters.categories) {
        whereClauses.push('categories LIKE ?');
        params.push(`%${filters.categories}%`);
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      db.get(`SELECT COUNT(*) as count FROM books ${whereClause}`, params, (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
  }
}

module.exports = Book;
