const googleBooksService = require('./googleBooksService');
const openLibraryService = require('./openLibraryService');
const coverCacheService = require('./coverCacheService');
const Book = require('../models/Book');
const mariadb = require('mariadb');

class MetadataService {
  /**
   * Fetch and merge metadata from multiple sources
   */
  async fetchMetadata(bookInfo) {
    const results = {
      google: null,
      openLibrary: null,
      merged: null,
    };

    try {
      // Fetch from both sources in parallel
      const [googleData, openLibraryData] = await Promise.all([
        googleBooksService.getMetadata(bookInfo).catch(err => {
          console.error('Google Books fetch error:', err);
          return null;
        }),
        openLibraryService.getMetadata(bookInfo).catch(err => {
          console.error('OpenLibrary fetch error:', err);
          return null;
        }),
      ]);

      results.google = googleData;
      results.openLibrary = openLibraryData;

      // Merge the results, preferring Google Books for most fields
      results.merged = this.mergeMetadata(googleData, openLibraryData, bookInfo);

      return results;
    } catch (error) {
      console.error('Metadata fetch error:', error);
      return results;
    }
  }
  const pool = mariadb.createPool({
    host: '192.168.2.104',
    user: 'goodreads',
    password: 'goodreads',
    database: 'Goodreads',
    connectionLimit: 5
  });

  async function 

  /**
   * Merge metadata from multiple sources
   * Priority: Google Books > OpenLibrary > Original
   */
  mergeMetadata(googleData, openLibraryData, originalData) {
    const merged = { ...originalData };

    // Helper to set value if not null/undefined
    const setValue = (key, ...sources) => {
      for (const source of sources) {
        if (source && source[key] !== null && source[key] !== undefined) {
          merged[key] = source[key];
          return;
        }
      }
    };

    // Merge fields with priority
    setValue('title', googleData, openLibraryData);
    setValue('subtitle', googleData, openLibraryData);
    setValue('author', googleData, openLibraryData);
    setValue('description', googleData, openLibraryData);
    setValue('isbn', googleData, openLibraryData);
    setValue('isbn_13', googleData, openLibraryData);
    setValue('publisher', googleData, openLibraryData);
    setValue('published_date', googleData, openLibraryData);
    setValue('page_count', googleData, openLibraryData);
    setValue('language', googleData, openLibraryData);
    setValue('categories', googleData, openLibraryData);
    setValue('preview_link', googleData);
    setValue('info_link', googleData);

    // For cover images, prefer Google Books (usually higher quality)
    setValue('cover_image_url', googleData, openLibraryData);

    // Store service IDs
    if (googleData?.google_books_id) {
      merged.google_books_id = googleData.google_books_id;
    }
    if (openLibraryData?.openlibrary_id) {
      merged.openlibrary_id = openLibraryData.openlibrary_id;
    }

    // For ratings, prefer Google Books but combine if both exist
    if (googleData?.average_rating && googleData?.ratings_count) {
      merged.average_rating = googleData.average_rating;
      merged.ratings_count = googleData.ratings_count;
    } else if (openLibraryData?.average_rating && openLibraryData?.ratings_count) {
      merged.average_rating = openLibraryData.average_rating;
      merged.ratings_count = openLibraryData.ratings_count;
    }

    return merged;
  }

  /**
   * Update book metadata in database
   */
  async updateBookMetadata(bookId, forceRefresh = false) {
    try {
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error('Book not found');
      }

      // Check if metadata was recently updated (within 30 days)
      if (!forceRefresh && book.metadata_updated_at) {
        const daysSinceUpdate = (Date.now() - new Date(book.metadata_updated_at)) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
          console.log(`Metadata for book ${bookId} is recent, skipping update`);
          return book;
        }
      }

      // Fetch metadata
      const metadata = await this.fetchMetadata({
        isbn: book.isbn,
        isbn_13: book.isbn_13,
        title: book.title,
        author: book.author,
        google_books_id: book.google_books_id,
        openlibrary_id: book.openlibrary_id,
      });

      if (!metadata.merged) {
        console.log(`No metadata found for book ${bookId}`);
        return book;
      }

      // Download and cache cover image
      let coverPath = book.cover_image;
      if (metadata.merged.cover_image_url) {
        const localPath = await coverCacheService.downloadCover(metadata.merged.cover_image_url, bookId);
        if (localPath) {
          coverPath = localPath;
        } else if (!book.cover_image) {
          // Fallback to URL if download failed
          coverPath = metadata.merged.cover_image_url;
        }
      }

      // Prepare update data
      const updateData = {
        description: metadata.merged.description || book.description,
        publisher: metadata.merged.publisher || book.publisher,
        published_date: metadata.merged.published_date || book.published_date,
        page_count: metadata.merged.page_count || book.page_count,
        categories: metadata.merged.categories || book.categories,
        google_books_id: metadata.merged.google_books_id || book.google_books_id,
        openlibrary_id: metadata.merged.openlibrary_id || book.openlibrary_id,
        average_rating: metadata.merged.average_rating,
        ratings_count: metadata.merged.ratings_count,
        preview_link: metadata.merged.preview_link,
        info_link: metadata.merged.info_link,
        cover_image: coverPath,
        metadata_updated_at: new Date().toISOString(),
      };
    
      // Update ISBN-13 if we don't have one
      if (!book.isbn_13 && metadata.merged.isbn_13) {
        updateData.isbn_13 = metadata.merged.isbn_13;
        console.log(`  Adding ISBN-13: ${metadata.merged.isbn_13}`);
      }
      
      // Update ISBN-10 if we don't have one
      if (!book.isbn && metadata.merged.isbn) {
        updateData.isbn = metadata.merged.isbn;
        console.log(`  Adding ISBN-10: ${metadata.merged.isbn}`);
      }

      // Update the book
      await Book.update(bookId, updateData);

      console.log(`Updated metadata for book ${bookId}: ${book.title}`);

      return await Book.findById(bookId);
    } catch (error) {
      console.error(`Error updating metadata for book ${bookId}:`, error);
      throw error;
    }
  }

  /**
   * Batch update metadata for multiple books
   */
  async batchUpdateMetadata(bookIds, forceRefresh = false) {
    const results = {
      success: [],
      failed: [],
    };

    for (const bookId of bookIds) {
      try {
        await this.updateBookMetadata(bookId, forceRefresh);
        results.success.push(bookId);

        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to update metadata for book ${bookId}:`, error);
        results.failed.push({ bookId, error: error.message });
      }
    }

    return results;
  }

  /**
   * Update metadata for all books in library
   */
  async updateAllMetadata(forceRefresh = false) {
    try {
      const books = await Book.findAll(1000, 0);
      const bookIds = books.map(b => b.id);

      console.log(`Starting metadata update for ${bookIds.length} books`);
      return await this.batchUpdateMetadata(bookIds, forceRefresh);
    } catch (error) {
      console.error('Error updating all metadata:', error);
      throw error;
    }
  }
}

module.exports = new MetadataService();
