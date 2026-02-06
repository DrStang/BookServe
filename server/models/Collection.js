/**
 * Collection Model for BookServe
 *
 * Handles user-created reading lists/collections like:
 * - "To Read"
 * - "Favorites"
 * - "Summer 2026"
 * - Custom collections
 */

const { db } = require('../database/init');

class Collection {
    /**
     * Initialize collections tables
     */
    static async initializeTables() {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Collections table
                db.run(`
          CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            color TEXT DEFAULT '#6366f1',
            icon TEXT DEFAULT 'bookmark',
            is_default INTEGER DEFAULT 0,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, name)
          )
        `, (err) => {
                    if (err) console.error('[Collections] Error creating collections table:', err);
                });

                // Collection books junction table
                db.run(`
          CREATE TABLE IF NOT EXISTS collection_books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            notes TEXT,
            sort_order INTEGER DEFAULT 0,
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
            FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
            UNIQUE(collection_id, book_id)
          )
        `, (err) => {
                    if (err) console.error('[Collections] Error creating collection_books table:', err);
                    else {
                        console.log('[Collections] Tables initialized');
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Create default collections for a new user
     */
    static async createDefaultCollections(userId) {
        const defaults = [
            { name: 'Want to Read', description: 'Books I want to read', icon: 'bookmark', color: '#3b82f6', is_default: 1 },
            { name: 'Currently Reading', description: 'Books I\'m reading now', icon: 'book-open', color: '#22c55e', is_default: 1 },
            { name: 'Finished', description: 'Completed books', icon: 'check-circle', color: '#a855f7', is_default: 1 },
            { name: 'Favorites', description: 'My favorite books', icon: 'heart', color: '#ef4444', is_default: 1 }
        ];

        for (let i = 0; i < defaults.length; i++) {
            const col = defaults[i];
            try {
                await Collection.create({
                    user_id: userId,
                    ...col,
                    sort_order: i
                });
            } catch (e) {
                // Ignore duplicate errors
                if (!e.message.includes('UNIQUE constraint')) {
                    console.error('[Collections] Error creating default:', e);
                }
            }
        }
    }

    /**
     * Create a new collection
     */
    static async create(data) {
        const { user_id, name, description, color, icon, is_default, sort_order } = data;

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO collections (user_id, name, description, color, icon, is_default, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [user_id, name, description || null, color || '#6366f1', icon || 'bookmark', is_default || 0, sort_order || 0],
                function(err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID, ...data });
                }
            );
        });
    }

    /**
     * Get all collections for a user
     */
    static async findByUserId(userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT c.*, 
                COUNT(cb.book_id) as book_count
         FROM collections c
         LEFT JOIN collection_books cb ON c.id = cb.collection_id
         WHERE c.user_id = ?
         GROUP BY c.id
         ORDER BY c.sort_order ASC, c.name ASC`,
                [userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Get a single collection with its books
     */
    static async findById(id, userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM collections WHERE id = ? AND user_id = ?`,
                [id, userId],
                (err, collection) => {
                    if (err) return reject(err);
                    if (!collection) return resolve(null);

                    // Get books in this collection
                    db.all(
                        `SELECT b.*, cb.added_at, cb.notes, cb.sort_order as collection_sort_order
             FROM collection_books cb
             JOIN books b ON cb.book_id = b.id
             WHERE cb.collection_id = ?
             ORDER BY cb.sort_order ASC, cb.added_at DESC`,
                        [id],
                        (err, books) => {
                            if (err) reject(err);
                            else resolve({ ...collection, books: books || [] });
                        }
                    );
                }
            );
        });
    }

    /**
     * Update a collection
     */
    static async update(id, userId, data) {
        const allowedFields = ['name', 'description', 'color', 'icon', 'sort_order'];
        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updates.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (updates.length === 0) {
            return { updated: false };
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id, userId);

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE collections SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
                values,
                function(err) {
                    if (err) reject(err);
                    else resolve({ updated: this.changes > 0 });
                }
            );
        });
    }

    /**
     * Delete a collection (only non-default ones)
     */
    static async delete(id, userId) {
        return new Promise((resolve, reject) => {
            // First check if it's a default collection
            db.get(
                'SELECT is_default FROM collections WHERE id = ? AND user_id = ?',
                [id, userId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return resolve({ deleted: false, message: 'Collection not found' });
                    if (row.is_default) return resolve({ deleted: false, message: 'Cannot delete default collections' });

                    // Delete the collection (cascade will remove collection_books entries)
                    db.run(
                        'DELETE FROM collections WHERE id = ? AND user_id = ?',
                        [id, userId],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ deleted: this.changes > 0 });
                        }
                    );
                }
            );
        });
    }

    /**
     * Add a book to a collection
     */
    static async addBook(collectionId, bookId, userId, notes = null) {
        // First verify the collection belongs to the user
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM collections WHERE id = ? AND user_id = ?',
                [collectionId, userId],
                (err, collection) => {
                    if (err) return reject(err);
                    if (!collection) return reject(new Error('Collection not found'));

                    // Get max sort order
                    db.get(
                        'SELECT MAX(sort_order) as max_order FROM collection_books WHERE collection_id = ?',
                        [collectionId],
                        (err, result) => {
                            if (err) return reject(err);

                            const sortOrder = (result?.max_order || 0) + 1;

                            db.run(
                                `INSERT OR REPLACE INTO collection_books (collection_id, book_id, notes, sort_order, added_at)
                 VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                [collectionId, bookId, notes, sortOrder],
                                function(err) {
                                    if (err) reject(err);
                                    else {
                                        // Update collection timestamp
                                        db.run(
                                            'UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                            [collectionId]
                                        );
                                        resolve({ added: true, id: this.lastID });
                                    }
                                }
                            );
                        }
                    );
                }
            );
        });
    }

    /**
     * Remove a book from a collection
     */
    static async removeBook(collectionId, bookId, userId) {
        return new Promise((resolve, reject) => {
            // Verify ownership
            db.get(
                'SELECT id FROM collections WHERE id = ? AND user_id = ?',
                [collectionId, userId],
                (err, collection) => {
                    if (err) return reject(err);
                    if (!collection) return reject(new Error('Collection not found'));

                    db.run(
                        'DELETE FROM collection_books WHERE collection_id = ? AND book_id = ?',
                        [collectionId, bookId],
                        function(err) {
                            if (err) reject(err);
                            else {
                                // Update collection timestamp
                                db.run(
                                    'UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                                    [collectionId]
                                );
                                resolve({ removed: this.changes > 0 });
                            }
                        }
                    );
                }
            );
        });
    }

    /**
     * Move a book between collections
     */
    static async moveBook(bookId, fromCollectionId, toCollectionId, userId) {
        try {
            await Collection.removeBook(fromCollectionId, bookId, userId);
            await Collection.addBook(toCollectionId, bookId, userId);
            return { moved: true };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update book notes in a collection
     */
    static async updateBookNotes(collectionId, bookId, userId, notes) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM collections WHERE id = ? AND user_id = ?',
                [collectionId, userId],
                (err, collection) => {
                    if (err) return reject(err);
                    if (!collection) return reject(new Error('Collection not found'));

                    db.run(
                        'UPDATE collection_books SET notes = ? WHERE collection_id = ? AND book_id = ?',
                        [notes, collectionId, bookId],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ updated: this.changes > 0 });
                        }
                    );
                }
            );
        });
    }

    /**
     * Reorder books in a collection
     */
    static async reorderBooks(collectionId, bookIds, userId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT id FROM collections WHERE id = ? AND user_id = ?',
                [collectionId, userId],
                (err, collection) => {
                    if (err) return reject(err);
                    if (!collection) return reject(new Error('Collection not found'));

                    db.serialize(() => {
                        const stmt = db.prepare(
                            'UPDATE collection_books SET sort_order = ? WHERE collection_id = ? AND book_id = ?'
                        );

                        for (let i = 0; i < bookIds.length; i++) {
                            stmt.run(i, collectionId, bookIds[i]);
                        }

                        stmt.finalize((err) => {
                            if (err) reject(err);
                            else resolve({ reordered: true });
                        });
                    });
                }
            );
        });
    }

    /**
     * Get all collections a book belongs to (for a user)
     */
    static async getBookCollections(bookId, userId) {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT c.*, cb.added_at, cb.notes
         FROM collections c
         JOIN collection_books cb ON c.id = cb.collection_id
         WHERE cb.book_id = ? AND c.user_id = ?
         ORDER BY c.name ASC`,
                [bookId, userId],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                }
            );
        });
    }

    /**
     * Check if a book is in a specific collection
     */
    static async isBookInCollection(collectionId, bookId) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT 1 FROM collection_books WHERE collection_id = ? AND book_id = ?',
                [collectionId, bookId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(!!row);
                }
            );
        });
    }

    /**
     * Get collection statistics for a user
     */
    static async getStats(userId) {
        return new Promise((resolve, reject) => {
            db.get(
                `SELECT 
           COUNT(DISTINCT c.id) as total_collections,
           COUNT(DISTINCT cb.book_id) as unique_books_in_collections,
           COUNT(cb.id) as total_assignments
         FROM collections c
         LEFT JOIN collection_books cb ON c.id = cb.collection_id
         WHERE c.user_id = ?`,
                [userId],
                (err, stats) => {
                    if (err) reject(err);
                    else resolve(stats);
                }
            );
        });
    }
}

module.exports = Collection;