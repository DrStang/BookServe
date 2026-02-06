/**
 * OPDS Catalog Service for BookServe
 *
 * OPDS (Open Publication Distribution System) is a standard catalog format
 * that allows e-reader apps like KOReader, Moon+ Reader, Librera, etc.
 * to browse and download books directly from your server.
 *
 * Spec: https://specs.opds.io/opds-1.2
 */

const Book = require('../models/Book');
const { db } = require('../database/init');

class OPDSService {
    constructor() {
        this.baseUrl = process.env.OPDS_BASE_URL || process.env.BASE_URL || 'http://localhost:5000';
        this.title = process.env.OPDS_TITLE || 'BookServe Library';
        this.author = process.env.OPDS_AUTHOR || 'BookServe';
    }

    /**
     * Generate XML header and namespace declarations
     */
    getXMLHeader() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:dc="http://purl.org/dc/terms/"
      xmlns:opds="http://opds-spec.org/2010/catalog">`;
    }

    /**
     * Escape XML special characters
     */
    escapeXml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    /**
     * Format date to RFC 3339
     */
    formatDate(date) {
        return new Date(date || Date.now()).toISOString();
    }

    /**
     * Generate the root/navigation catalog
     */
    async getRootCatalog() {
        const updated = this.formatDate();

        return `${this.getXMLHeader()}
  <id>urn:bookserve:root</id>
  <title>${this.escapeXml(this.title)}</title>
  <updated>${updated}</updated>
  <author>
    <name>${this.escapeXml(this.author)}</name>
  </author>
  
  <link rel="self" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="search" href="${this.baseUrl}/opds/search?q={searchTerms}" type="application/atom+xml;profile=opds-catalog;kind=acquisition" title="Search"/>
  
  <entry>
    <id>urn:bookserve:all</id>
    <title>All Books</title>
    <link rel="subsection" href="${this.baseUrl}/opds/all" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <updated>${updated}</updated>
    <content type="text">Browse all books in the library</content>
  </entry>
  
  <entry>
    <id>urn:bookserve:recent</id>
    <title>Recently Added</title>
    <link rel="subsection" href="${this.baseUrl}/opds/recent" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <updated>${updated}</updated>
    <content type="text">Recently added books</content>
  </entry>
  
  <entry>
    <id>urn:bookserve:authors</id>
    <title>By Author</title>
    <link rel="subsection" href="${this.baseUrl}/opds/authors" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
    <updated>${updated}</updated>
    <content type="text">Browse books by author</content>
  </entry>
  
  <entry>
    <id>urn:bookserve:genres</id>
    <title>By Genre</title>
    <link rel="subsection" href="${this.baseUrl}/opds/genres" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
    <updated>${updated}</updated>
    <content type="text">Browse books by genre/category</content>
  </entry>
  
  <entry>
    <id>urn:bookserve:series</id>
    <title>By Series</title>
    <link rel="subsection" href="${this.baseUrl}/opds/series" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
    <updated>${updated}</updated>
    <content type="text">Browse books by series</content>
  </entry>
  
</feed>`;
    }

    /**
     * Generate a book entry for OPDS feed
     */
    generateBookEntry(book) {
        const id = `urn:bookserve:book:${book.id}`;
        const updated = this.formatDate(book.metadata_updated_at || book.added_at);

        // Determine MIME type based on format
        const mimeTypes = {
            'epub': 'application/epub+zip',
            'pdf': 'application/pdf',
            'mobi': 'application/x-mobipocket-ebook',
            'azw': 'application/vnd.amazon.ebook',
            'azw3': 'application/vnd.amazon.ebook'
        };
        const format = (book.format || 'epub').toLowerCase();
        const mimeType = mimeTypes[format] || 'application/epub+zip';

        let entry = `
  <entry>
    <id>${id}</id>
    <title>${this.escapeXml(book.title)}</title>
    <updated>${updated}</updated>`;

        if (book.author) {
            entry += `
    <author>
      <name>${this.escapeXml(book.author)}</name>
    </author>`;
        }

        if (book.publisher) {
            entry += `
    <dc:publisher>${this.escapeXml(book.publisher)}</dc:publisher>`;
        }

        if (book.language) {
            entry += `
    <dc:language>${this.escapeXml(book.language)}</dc:language>`;
        }

        if (book.published_date) {
            entry += `
    <dc:issued>${this.escapeXml(book.published_date)}</dc:issued>`;
        }

        if (book.isbn_13 || book.isbn) {
            entry += `
    <dc:identifier>urn:isbn:${this.escapeXml(book.isbn_13 || book.isbn)}</dc:identifier>`;
        }

        if (book.categories) {
            const categories = book.categories.split(',').map(c => c.trim());
            categories.forEach(cat => {
                entry += `
    <category term="${this.escapeXml(cat)}" label="${this.escapeXml(cat)}"/>`;
            });
        }

        if (book.description) {
            entry += `
    <summary type="html">${this.escapeXml(book.description)}</summary>`;
        }

        if (book.series) {
            entry += `
    <link rel="related" href="${this.baseUrl}/opds/series/${encodeURIComponent(book.series)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition" title="Series: ${this.escapeXml(book.series)}"/>`;
        }

        // Cover image link
        if (book.cover_image) {
            entry += `
    <link rel="http://opds-spec.org/image" href="${this.baseUrl}/api/books/${book.id}/cover" type="image/jpeg"/>
    <link rel="http://opds-spec.org/image/thumbnail" href="${this.baseUrl}/api/books/${book.id}/cover" type="image/jpeg"/>`;
        }

        // Download link
        entry += `
    <link rel="http://opds-spec.org/acquisition" href="${this.baseUrl}/api/books/${book.id}/download" type="${mimeType}" title="Download ${format.toUpperCase()}"/>`;

        // Stream/read online link
        entry += `
    <link rel="http://opds-spec.org/acquisition/open-access" href="${this.baseUrl}/api/books/${book.id}/stream" type="${mimeType}"/>`;

        entry += `
  </entry>`;

        return entry;
    }

    /**
     * Generate acquisition feed with books
     */
    async generateAcquisitionFeed(options = {}) {
        const {
            title = 'All Books',
            id = 'all',
            books = [],
            page = 1,
            perPage = 50,
            totalCount = 0
        } = options;

        const updated = this.formatDate();
        const totalPages = Math.ceil(totalCount / perPage);

        let feed = `${this.getXMLHeader()}
  <id>urn:bookserve:${id}</id>
  <title>${this.escapeXml(title)}</title>
  <updated>${updated}</updated>
  <author>
    <name>${this.escapeXml(this.author)}</name>
  </author>
  
  <link rel="self" href="${this.baseUrl}/opds/${id}?page=${page}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <link rel="start" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="up" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>`;

        // Pagination links
        if (page > 1) {
            feed += `
  <link rel="previous" href="${this.baseUrl}/opds/${id}?page=${page - 1}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <link rel="first" href="${this.baseUrl}/opds/${id}?page=1" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>`;
        }

        if (page < totalPages) {
            feed += `
  <link rel="next" href="${this.baseUrl}/opds/${id}?page=${page + 1}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
  <link rel="last" href="${this.baseUrl}/opds/${id}?page=${totalPages}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>`;
        }

        // Add book entries
        for (const book of books) {
            feed += this.generateBookEntry(book);
        }

        feed += `
</feed>`;

        return feed;
    }

    /**
     * Get all books with pagination
     */
    async getAllBooks(page = 1, perPage = 50) {
        const offset = (page - 1) * perPage;

        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM books', [], (err, countRow) => {
                if (err) return reject(err);

                db.all(
                    'SELECT * FROM books ORDER BY title ASC LIMIT ? OFFSET ?',
                    [perPage, offset],
                    async (err, books) => {
                        if (err) return reject(err);

                        const feed = await this.generateAcquisitionFeed({
                            title: 'All Books',
                            id: 'all',
                            books,
                            page,
                            perPage,
                            totalCount: countRow.count
                        });

                        resolve(feed);
                    }
                );
            });
        });
    }

    /**
     * Get recently added books
     */
    async getRecentBooks(page = 1, perPage = 50) {
        const offset = (page - 1) * perPage;

        return new Promise((resolve, reject) => {
            db.get('SELECT COUNT(*) as count FROM books', [], (err, countRow) => {
                if (err) return reject(err);

                db.all(
                    'SELECT * FROM books ORDER BY added_at DESC LIMIT ? OFFSET ?',
                    [perPage, offset],
                    async (err, books) => {
                        if (err) return reject(err);

                        const feed = await this.generateAcquisitionFeed({
                            title: 'Recently Added',
                            id: 'recent',
                            books,
                            page,
                            perPage,
                            totalCount: countRow.count
                        });

                        resolve(feed);
                    }
                );
            });
        });
    }

    /**
     * Get list of authors
     */
    async getAuthors() {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT author, COUNT(*) as book_count 
         FROM books 
         WHERE author IS NOT NULL AND author != ''
         GROUP BY author 
         ORDER BY author ASC`,
                [],
                (err, authors) => {
                    if (err) return reject(err);

                    const updated = this.formatDate();
                    let feed = `${this.getXMLHeader()}
  <id>urn:bookserve:authors</id>
  <title>Authors</title>
  <updated>${updated}</updated>
  <author>
    <name>${this.escapeXml(this.author)}</name>
  </author>
  
  <link rel="self" href="${this.baseUrl}/opds/authors" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="up" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>`;

                    for (const author of authors) {
                        feed += `
  <entry>
    <id>urn:bookserve:author:${encodeURIComponent(author.author)}</id>
    <title>${this.escapeXml(author.author)}</title>
    <link rel="subsection" href="${this.baseUrl}/opds/authors/${encodeURIComponent(author.author)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <updated>${updated}</updated>
    <content type="text">${author.book_count} book${author.book_count !== 1 ? 's' : ''}</content>
  </entry>`;
                    }

                    feed += `
</feed>`;

                    resolve(feed);
                }
            );
        });
    }

    /**
     * Get books by author
     */
    async getBooksByAuthor(authorName, page = 1, perPage = 50) {
        const offset = (page - 1) * perPage;

        return new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as count FROM books WHERE author = ?',
                [authorName],
                (err, countRow) => {
                    if (err) return reject(err);

                    db.all(
                        'SELECT * FROM books WHERE author = ? ORDER BY title ASC LIMIT ? OFFSET ?',
                        [authorName, perPage, offset],
                        async (err, books) => {
                            if (err) return reject(err);

                            const feed = await this.generateAcquisitionFeed({
                                title: `Books by ${authorName}`,
                                id: `authors/${encodeURIComponent(authorName)}`,
                                books,
                                page,
                                perPage,
                                totalCount: countRow.count
                            });

                            resolve(feed);
                        }
                    );
                }
            );
        });
    }

    /**
     * Get list of genres/categories
     */
    async getGenres() {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT categories FROM books WHERE categories IS NOT NULL AND categories != ''`,
                [],
                (err, rows) => {
                    if (err) return reject(err);

                    // Extract and count unique genres
                    const genreCounts = {};
                    for (const row of rows) {
                        const cats = row.categories.split(',').map(c => c.trim());
                        for (const cat of cats) {
                            if (cat) {
                                genreCounts[cat] = (genreCounts[cat] || 0) + 1;
                            }
                        }
                    }

                    const genres = Object.entries(genreCounts)
                        .sort((a, b) => a[0].localeCompare(b[0]))
                        .map(([name, count]) => ({ name, count }));

                    const updated = this.formatDate();
                    let feed = `${this.getXMLHeader()}
  <id>urn:bookserve:genres</id>
  <title>Genres</title>
  <updated>${updated}</updated>
  <author>
    <name>${this.escapeXml(this.author)}</name>
  </author>
  
  <link rel="self" href="${this.baseUrl}/opds/genres" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="up" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>`;

                    for (const genre of genres) {
                        feed += `
  <entry>
    <id>urn:bookserve:genre:${encodeURIComponent(genre.name)}</id>
    <title>${this.escapeXml(genre.name)}</title>
    <link rel="subsection" href="${this.baseUrl}/opds/genres/${encodeURIComponent(genre.name)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <updated>${updated}</updated>
    <content type="text">${genre.count} book${genre.count !== 1 ? 's' : ''}</content>
  </entry>`;
                    }

                    feed += `
</feed>`;

                    resolve(feed);
                }
            );
        });
    }

    /**
     * Get books by genre
     */
    async getBooksByGenre(genreName, page = 1, perPage = 50) {
        const offset = (page - 1) * perPage;

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM books WHERE categories LIKE ?`,
                [`%${genreName}%`],
                (err, countRow) => {
                    if (err) return reject(err);

                    db.all(
                        `SELECT * FROM books WHERE categories LIKE ? ORDER BY title ASC LIMIT ? OFFSET ?`,
                        [`%${genreName}%`, perPage, offset],
                        async (err, books) => {
                            if (err) return reject(err);

                            const feed = await this.generateAcquisitionFeed({
                                title: `Genre: ${genreName}`,
                                id: `genres/${encodeURIComponent(genreName)}`,
                                books,
                                page,
                                perPage,
                                totalCount: countRow.count
                            });

                            resolve(feed);
                        }
                    );
                }
            );
        });
    }

    /**
     * Get list of series
     */
    async getSeries() {
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT series, COUNT(*) as book_count 
         FROM books 
         WHERE series IS NOT NULL AND series != ''
         GROUP BY series 
         ORDER BY series ASC`,
                [],
                (err, seriesList) => {
                    if (err) return reject(err);

                    const updated = this.formatDate();
                    let feed = `${this.getXMLHeader()}
  <id>urn:bookserve:series</id>
  <title>Series</title>
  <updated>${updated}</updated>
  <author>
    <name>${this.escapeXml(this.author)}</name>
  </author>
  
  <link rel="self" href="${this.baseUrl}/opds/series" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="start" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>
  <link rel="up" href="${this.baseUrl}/opds" type="application/atom+xml;profile=opds-catalog;kind=navigation"/>`;

                    for (const s of seriesList) {
                        feed += `
  <entry>
    <id>urn:bookserve:series:${encodeURIComponent(s.series)}</id>
    <title>${this.escapeXml(s.series)}</title>
    <link rel="subsection" href="${this.baseUrl}/opds/series/${encodeURIComponent(s.series)}" type="application/atom+xml;profile=opds-catalog;kind=acquisition"/>
    <updated>${updated}</updated>
    <content type="text">${s.book_count} book${s.book_count !== 1 ? 's' : ''}</content>
  </entry>`;
                    }

                    feed += `
</feed>`;

                    resolve(feed);
                }
            );
        });
    }

    /**
     * Get books by series
     */
    async getBooksBySeries(seriesName, page = 1, perPage = 50) {
        const offset = (page - 1) * perPage;

        return new Promise((resolve, reject) => {
            db.get(
                'SELECT COUNT(*) as count FROM books WHERE series = ?',
                [seriesName],
                (err, countRow) => {
                    if (err) return reject(err);

                    db.all(
                        'SELECT * FROM books WHERE series = ? ORDER BY series_number ASC, title ASC LIMIT ? OFFSET ?',
                        [seriesName, perPage, offset],
                        async (err, books) => {
                            if (err) return reject(err);

                            const feed = await this.generateAcquisitionFeed({
                                title: `Series: ${seriesName}`,
                                id: `series/${encodeURIComponent(seriesName)}`,
                                books,
                                page,
                                perPage,
                                totalCount: countRow.count
                            });

                            resolve(feed);
                        }
                    );
                }
            );
        });
    }

    /**
     * Search books
     */
    async searchBooks(query, page = 1, perPage = 50) {
        const offset = (page - 1) * perPage;
        const searchTerm = `%${query}%`;

        return new Promise((resolve, reject) => {
            db.get(
                `SELECT COUNT(*) as count FROM books 
         WHERE title LIKE ? OR author LIKE ? OR description LIKE ? OR isbn LIKE ? OR isbn_13 LIKE ?`,
                [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm],
                (err, countRow) => {
                    if (err) return reject(err);

                    db.all(
                        `SELECT * FROM books 
             WHERE title LIKE ? OR author LIKE ? OR description LIKE ? OR isbn LIKE ? OR isbn_13 LIKE ?
             ORDER BY title ASC LIMIT ? OFFSET ?`,
                        [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, perPage, offset],
                        async (err, books) => {
                            if (err) return reject(err);

                            const feed = await this.generateAcquisitionFeed({
                                title: `Search: ${query}`,
                                id: `search?q=${encodeURIComponent(query)}`,
                                books,
                                page,
                                perPage,
                                totalCount: countRow.count
                            });

                            resolve(feed);
                        }
                    );
                }
            );
        });
    }
}

module.exports = new OPDSService();