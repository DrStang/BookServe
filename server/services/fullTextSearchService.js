/**
 * Full-Text Search Service for BookServe
 *
 * Extracts text from EPUBs and indexes it for full-text search.
 * Uses SQLite FTS5 for efficient full-text indexing and search.
 */

const { db } = require('../database/init');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs').promises;

class FullTextSearchService {
    constructor() {
        this.indexingInProgress = false;
        this.indexingQueue = [];
    }

    /**
     * Initialize FTS tables
     */
    async initializeFTS() {
        return new Promise((resolve, reject) => {
            db.serialize(() => {
                // Create FTS5 virtual table for book content
                db.run(`
          CREATE VIRTUAL TABLE IF NOT EXISTS book_content_fts USING fts5(
            book_id,
            chapter_title,
            content,
            content_type,
            tokenize='porter unicode61'
          )
        `, (err) => {
                    if (err) {
                        // FTS5 might not be available, try FTS4
                        console.log('[FTS] FTS5 not available, trying FTS4...');
                        db.run(`
              CREATE VIRTUAL TABLE IF NOT EXISTS book_content_fts USING fts4(
                book_id,
                chapter_title,
                content,
                content_type,
                tokenize=porter
              )
            `, (err2) => {
                            if (err2) {
                                console.error('[FTS] Error creating FTS table:', err2);
                                reject(err2);
                            }
                        });
                    }
                });

                // Track which books have been indexed
                db.run(`
          CREATE TABLE IF NOT EXISTS book_fts_status (
            book_id INTEGER PRIMARY KEY,
            indexed_at DATETIME,
            word_count INTEGER,
            chapter_count INTEGER,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            FOREIGN KEY (book_id) REFERENCES books(id)
          )
        `, (err) => {
                    if (err) console.error('[FTS] Error creating status table:', err);
                    else {
                        console.log('[FTS] Full-text search tables initialized');
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Extract text from HTML/XHTML content
     */
    extractTextFromHtml(html) {
        // Remove script and style elements
        let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
        text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

        // Convert common entities
        text = text.replace(/&nbsp;/gi, ' ');
        text = text.replace(/&amp;/gi, '&');
        text = text.replace(/&lt;/gi, '<');
        text = text.replace(/&gt;/gi, '>');
        text = text.replace(/&quot;/gi, '"');
        text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(num));

        // Remove all remaining tags
        text = text.replace(/<[^>]+>/g, ' ');

        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();

        return text;
    }

    /**
     * Extract chapter title from HTML if possible
     */
    extractChapterTitle(html, filename) {
        // Try to find h1, h2, or title
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
            html.match(/<h2[^>]*>([^<]+)<\/h2>/i) ||
            html.match(/<title[^>]*>([^<]+)<\/title>/i);

        if (titleMatch) {
            return this.extractTextFromHtml(titleMatch[1]).substring(0, 200);
        }

        // Fall back to filename
        return path.basename(filename, path.extname(filename));
    }

    /**
     * Extract and index content from an EPUB file
     */
    async indexBook(bookId, filePath) {
        console.log(`[FTS] Starting to index book ${bookId}...`);

        try {
            // Check if file exists
            await fs.access(filePath);

            // Read EPUB (it's a ZIP file)
            const zip = new AdmZip(filePath);
            const entries = zip.getEntries();

            let totalWords = 0;
            let chapterCount = 0;
            const contentChunks = [];

            // Find and process content files
            for (const entry of entries) {
                const name = entry.entryName.toLowerCase();

                // Process HTML/XHTML content files
                if ((name.endsWith('.html') || name.endsWith('.xhtml') || name.endsWith('.htm')) &&
                    !name.includes('toc') && !name.includes('nav')) {

                    try {
                        const content = entry.getData().toString('utf8');
                        const text = this.extractTextFromHtml(content);

                        if (text.length > 50) { // Only index substantial content
                            const chapterTitle = this.extractChapterTitle(content, entry.entryName);
                            const wordCount = text.split(/\s+/).length;

                            contentChunks.push({
                                chapterTitle,
                                content: text,
                                contentType: 'chapter'
                            });

                            totalWords += wordCount;
                            chapterCount++;
                        }
                    } catch (e) {
                        console.warn(`[FTS] Error processing ${entry.entryName}:`, e.message);
                    }
                }
            }

            // Delete existing index for this book
            await this.deleteBookIndex(bookId);

            // Insert new content
            for (const chunk of contentChunks) {
                await new Promise((resolve, reject) => {
                    db.run(
                        `INSERT INTO book_content_fts (book_id, chapter_title, content, content_type) 
             VALUES (?, ?, ?, ?)`,
                        [bookId.toString(), chunk.chapterTitle, chunk.content, chunk.contentType],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            // Update status
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT OR REPLACE INTO book_fts_status 
           (book_id, indexed_at, word_count, chapter_count, status) 
           VALUES (?, datetime('now'), ?, ?, 'indexed')`,
                    [bookId, totalWords, chapterCount],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log(`[FTS] Indexed book ${bookId}: ${chapterCount} chapters, ${totalWords} words`);
            return { success: true, chapters: chapterCount, words: totalWords };

        } catch (error) {
            console.error(`[FTS] Error indexing book ${bookId}:`, error);

            // Record error
            await new Promise((resolve) => {
                db.run(
                    `INSERT OR REPLACE INTO book_fts_status 
           (book_id, indexed_at, status, error_message) 
           VALUES (?, datetime('now'), 'error', ?)`,
                    [bookId, error.message],
                    () => resolve()
                );
            });

            return { success: false, error: error.message };
        }
    }

    /**
     * Delete index for a specific book
     */
    async deleteBookIndex(bookId) {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM book_content_fts WHERE book_id = ?',
                [bookId.toString()],
                (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });
    }

    /**
     * Search across all indexed books
     */
    async search(query, options = {}) {
        const {
            limit = 50,
            offset = 0,
            bookId = null,  // Optionally search within a specific book
            highlightTag = 'mark'
        } = options;

        return new Promise((resolve, reject) => {
            // Build the search query
            // FTS5 uses MATCH syntax
            let sql = `
        SELECT 
          fts.book_id,
          fts.chapter_title,
          snippet(book_content_fts, 2, '<${highlightTag}>', '</${highlightTag}>', '...', 32) as snippet,
          bm25(book_content_fts) as relevance,
          b.title as book_title,
          b.author as book_author,
          b.cover_image
        FROM book_content_fts fts
        JOIN books b ON CAST(fts.book_id AS INTEGER) = b.id
        WHERE book_content_fts MATCH ?
      `;

            const params = [query];

            if (bookId) {
                sql += ' AND fts.book_id = ?';
                params.push(bookId.toString());
            }

            sql += ' ORDER BY relevance LIMIT ? OFFSET ?';
            params.push(limit, offset);

            db.all(sql, params, (err, results) => {
                if (err) {
                    // Try FTS4 syntax if FTS5 fails
                    const fts4Sql = sql.replace('bm25(book_content_fts)', '1').replace('snippet(book_content_fts, 2,', 'snippet(book_content_fts,');
                    db.all(fts4Sql, params, (err2, results2) => {
                        if (err2) reject(err2);
                        else resolve(results2 || []);
                    });
                } else {
                    resolve(results || []);
                }
            });
        });
    }

    /**
     * Search within a specific book
     */
    async searchInBook(bookId, query, options = {}) {
        return this.search(query, { ...options, bookId });
    }

    /**
     * Get indexing status for all books
     */
    async getIndexStatus() {
        return new Promise((resolve, reject) => {
            db.all(`
        SELECT 
          b.id,
          b.title,
          b.author,
          COALESCE(s.status, 'not_indexed') as index_status,
          s.indexed_at,
          s.word_count,
          s.chapter_count,
          s.error_message
        FROM books b
        LEFT JOIN book_fts_status s ON b.id = s.book_id
        ORDER BY 
          CASE WHEN s.status = 'indexed' THEN 0
               WHEN s.status = 'error' THEN 1
               ELSE 2 END,
          b.title
      `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    /**
     * Get overall index statistics
     */
    async getStats() {
        return new Promise((resolve, reject) => {
            db.get(`
        SELECT 
          COUNT(DISTINCT book_id) as indexed_books,
          SUM(word_count) as total_words,
          SUM(chapter_count) as total_chapters
        FROM book_fts_status
        WHERE status = 'indexed'
      `, [], (err, stats) => {
                if (err) reject(err);
                else {
                    db.get('SELECT COUNT(*) as total FROM books', [], (err2, total) => {
                        if (err2) reject(err2);
                        else {
                            resolve({
                                indexedBooks: stats?.indexed_books || 0,
                                totalBooks: total?.total || 0,
                                totalWords: stats?.total_words || 0,
                                totalChapters: stats?.total_chapters || 0,
                                percentIndexed: total?.total ?
                                    Math.round((stats?.indexed_books || 0) / total.total * 100) : 0
                            });
                        }
                    });
                }
            });
        });
    }

    /**
     * Index all books that haven't been indexed yet
     */
    async indexAllBooks(forceReindex = false) {
        if (this.indexingInProgress) {
            return { success: false, message: 'Indexing already in progress' };
        }

        this.indexingInProgress = true;

        try {
            // Get books to index
            let sql = `
        SELECT b.id, b.file_path, b.format
        FROM books b
        LEFT JOIN book_fts_status s ON b.id = s.book_id
        WHERE b.format = 'epub'
      `;

            if (!forceReindex) {
                sql += " AND (s.status IS NULL OR s.status = 'error')";
            }

            const books = await new Promise((resolve, reject) => {
                db.all(sql, [], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
            });

            console.log(`[FTS] Starting to index ${books.length} books...`);

            let indexed = 0;
            let errors = 0;

            for (const book of books) {
                const result = await this.indexBook(book.id, book.file_path);
                if (result.success) indexed++;
                else errors++;

                // Small delay to prevent overwhelming the system
                await new Promise(r => setTimeout(r, 100));
            }

            console.log(`[FTS] Indexing complete: ${indexed} indexed, ${errors} errors`);
            return { success: true, indexed, errors, total: books.length };

        } finally {
            this.indexingInProgress = false;
        }
    }

    /**
     * Check if indexing is currently in progress
     */
    isIndexing() {
        return this.indexingInProgress;
    }
}

module.exports = new FullTextSearchService();