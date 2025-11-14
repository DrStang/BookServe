const axios = require('axios');

const OPENLIBRARY_API_URL = 'https://openlibrary.org';

class OpenLibraryService {
  /**
   * Search for books
   */
  async search(query, limit = 20) {
    try {
      const response = await axios.get(`${OPENLIBRARY_API_URL}/search.json`, {
        params: { q: query, limit }
      });

      return response.data.docs ? response.data.docs.map(this.formatSearchResult) : [];
    } catch (error) {
      console.error('OpenLibrary search error:', error.message);
      return [];
    }
  }

  /**
   * Search by ISBN
   */
  async searchByISBN(isbn) {
    try {
      const response = await axios.get(`${OPENLIBRARY_API_URL}/search.json`, {
        params: { isbn }
      });

      if (response.data.docs && response.data.docs.length > 0) {
        const book = response.data.docs[0];
        // Get full details using the work ID
        if (book.key) {
          return await this.getWorkDetails(book.key);
        }
        return this.formatSearchResult(book);
      }

      return null;
    } catch (error) {
      console.error('OpenLibrary ISBN search error:', error.message);
      return null;
    }
  }

  /**
   * Get work details by OpenLibrary work key
   */
  async getWorkDetails(workKey) {
    try {
      // Remove /works/ prefix if present
      const cleanKey = workKey.replace('/works/', '');

      const response = await axios.get(`${OPENLIBRARY_API_URL}/works/${cleanKey}.json`);
      const work = response.data;

      // Get ratings
      const ratingsResponse = await axios.get(
        `${OPENLIBRARY_API_URL}/works/${cleanKey}/ratings.json`
      ).catch(() => ({ data: null }));

      return this.formatWorkDetails(work, ratingsResponse.data);
    } catch (error) {
      console.error('OpenLibrary work details error:', error.message);
      return null;
    }
  }

  /**
   * Get book details by OpenLibrary edition key
   */
  async getEditionDetails(editionKey) {
    try {
      const cleanKey = editionKey.replace('/books/', '');
      const response = await axios.get(`${OPENLIBRARY_API_URL}/books/${cleanKey}.json`);
      return response.data;
    } catch (error) {
      console.error('OpenLibrary edition details error:', error.message);
      return null;
    }
  }

  /**
   * Search by title and author
   */
  async searchByTitleAuthor(title, author) {
    try {
      const params = { title };
      if (author) {
        params.author = author;
      }

      const response = await axios.get(`${OPENLIBRARY_API_URL}/search.json`, { params });

      if (response.data.docs && response.data.docs.length > 0) {
        const book = response.data.docs[0];
        if (book.key) {
          return await this.getWorkDetails(book.key);
        }
        return this.formatSearchResult(book);
      }

      return null;
    } catch (error) {
      console.error('OpenLibrary title/author search error:', error.message);
      return null;
    }
  }

  /**
   * Format search result
   */
  formatSearchResult(doc) {
    return {
      openlibrary_id: doc.key,
      title: doc.title,
      author: doc.author_name ? doc.author_name.join(', ') : null,
      authors: doc.author_name || [],
      first_publish_year: doc.first_publish_year,
      isbn: doc.isbn ? doc.isbn[0] : null,
      isbn_13: doc.isbn ? doc.isbn.find(i => i.length === 13) : null,
      publisher: doc.publisher ? doc.publisher[0] : null,
      cover_id: doc.cover_i,
      cover_image_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null,
      page_count: doc.number_of_pages_median,
      language: doc.language ? doc.language[0] : null,
      subjects: doc.subject ? doc.subject.slice(0, 10) : [],
    };
  }

  /**
   * Format work details
   */
  formatWorkDetails(work, ratings) {
    const description = typeof work.description === 'string'
      ? work.description
      : work.description?.value;

    // Calculate average rating from OpenLibrary ratings
    let averageRating = null;
    let ratingsCount = 0;

    if (ratings && ratings.summary) {
      const summary = ratings.summary;
      ratingsCount = summary.count || 0;
      if (summary.average) {
        averageRating = summary.average;
      }
    }

    return {
      openlibrary_id: work.key,
      title: work.title,
      subtitle: work.subtitle,
      description,
      authors: work.authors ? work.authors.map(a => a.author?.key) : [],
      subjects: work.subjects ? work.subjects.slice(0, 10) : [],
      categories: work.subjects ? work.subjects.slice(0, 5).join(', ') : null,
      cover_id: work.covers ? work.covers[0] : null,
      cover_image_url: work.covers && work.covers[0]
        ? `https://covers.openlibrary.org/b/id/${work.covers[0]}-L.jpg`
        : null,
      first_publish_date: work.first_publish_date,
      average_rating: averageRating,
      ratings_count: ratingsCount,
    };
  }

  /**
   * Get cover URL by ISBN
   */
  getCoverUrlByISBN(isbn, size = 'L') {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
  }

  /**
   * Get metadata for a book
   */
  async getMetadata(bookInfo) {
    const { isbn, isbn_13, title, author, openlibrary_id } = bookInfo;

    // Try OpenLibrary ID first
    if (openlibrary_id) {
      const result = await this.getWorkDetails(openlibrary_id);
      if (result) return result;
    }

    // Try ISBN
    if (isbn_13) {
      const result = await this.searchByISBN(isbn_13);
      if (result) return result;
    }

    if (isbn) {
      const result = await this.searchByISBN(isbn);
      if (result) return result;
    }

    // Fall back to title/author
    if (title) {
      const result = await this.searchByTitleAuthor(title, author);
      if (result) return result;
    }

    return null;
  }
}

module.exports = new OpenLibraryService();
