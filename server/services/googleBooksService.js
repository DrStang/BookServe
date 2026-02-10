const axios = require("axios");
const { HttpsProxyAgent } = require("https-proxy-agent");

// Google Books API base URL
const GOOGLE_BOOKS_API_URL = 'https://www.googleapis.com/books/v1/volumes';
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || ''; // Optional, but increases rate limits
//const proxyUrl =

const agent = new HttpsProxyAgent(proxyUrl);

const instance = axios.create({
  proxy: false,
  httpAgent: agent,
  httpsAgent: agent,
  timeout: 30000,
});  

class GoogleBooksService {
  /**
   * Search for books by query
   */
  async search(query, maxResults = 20) {
    try {
      const params = {
        q: query,
        maxResults,
        printType: 'books',
      };

      if (API_KEY) {
        params.key = API_KEY;
      }
      
      
      const response = await axios.get(GOOGLE_BOOKS_API_URL, { params });
      //const response = await instance.get(GOOGLE_BOOKS_API_URL, { params });

      return response.data.items ? response.data.items.map(this.formatBookData) : [];
    } catch (error) {
      console.error('Google Books search error:', error.message);
      return [];
    }
  }

  /**
   * Search by ISBN
   */
  async searchByISBN(isbn) {
    try {
      const params = {
        q: `isbn:${isbn}`,
      };

      if (API_KEY) {
        params.key = API_KEY;
      }

      const response = await axios.get(GOOGLE_BOOKS_API_URL, { params });
     //const response = await instance.get(GOOGLE_BOOKS_API_URL, { params });

      if (response.data.items && response.data.items.length > 0) {
        return this.formatBookData(response.data.items[0]);
      }

      return null;
    } catch (error) {
      console.error('Google Books ISBN search error:', error.message);
      return null;
    }
  }

  /**
   * Search by title and author
   */
  async searchByTitleAuthor(title, author) {
    try {
      let query = `intitle:${title}`;
      if (author) {
        query += `+inauthor:${author}`;
      }

      const params = {
        q: query,
        maxResults: 5,
      };

      if (API_KEY) {
        params.key = API_KEY;
      }

      const response = await axios.get(GOOGLE_BOOKS_API_URL, { params });
      //const response = await instance.get(GOOGLE_BOOKS_API_URL, { params });

      if (response.data.items && response.data.items.length > 0) {
        return this.formatBookData(response.data.items[0]);
      }

      return null;
    } catch (error) {

      console.error('Google Books title/author search error:', error.message);
      return null;
    }
  }

  /**
   * Get book by Google Books ID
   */
  async getById(googleBooksId) {
    try {
      const url = `${GOOGLE_BOOKS_API_URL}/${googleBooksId}`;
      const params = {};

      if (API_KEY) {
        params.key = API_KEY;
      }

      const response = await axios.get(url, { params });
      return this.formatBookData(response.data);
    } catch (error) {
      console.error('Google Books getById error:', error.message);
      return null;
    }
  }

  /**
   * Format Google Books API response
   */
  formatBookData(item) {
    if (!item || !item.volumeInfo) {
      return null;
    }

    const info = item.volumeInfo;
    const isbn10 = info.industryIdentifiers?.find(id => id.type === 'ISBN_10')?.identifier;
    const isbn13 = info.industryIdentifiers?.find(id => id.type === 'ISBN_13')?.identifier;

    return {
      google_books_id: item.id,
      title: info.title,
      subtitle: info.subtitle,
      authors: info.authors || [],
      author: info.authors ? info.authors.join(', ') : null,
      publisher: info.publisher,
      published_date: info.publishedDate,
      description: info.description,
      isbn: isbn10 || isbn13,
      isbn_13: isbn13,
      page_count: info.pageCount,
      categories: info.categories ? info.categories.join(', ') : null,
      average_rating: info.averageRating,
      ratings_count: info.ratingsCount,
      language: info.language,
      preview_link: info.previewLink,
      info_link: info.infoLink,
      cover_image_url: this.getBestCoverImage(info.imageLinks),
      thumbnail: info.imageLinks?.thumbnail,
      small_thumbnail: info.imageLinks?.smallThumbnail,
    };
  }

  /**
   * Get the best quality cover image
   */
  getBestCoverImage(imageLinks) {
    if (!imageLinks) return null;

    // Prefer higher resolution images
    return imageLinks.extraLarge ||
           imageLinks.large ||
           imageLinks.medium ||
           imageLinks.thumbnail ||
           imageLinks.smallThumbnail ||
           null;
  }

  /**
   * Get metadata for a book (try multiple search methods)
   */
  async getMetadata(bookInfo) {
    const { isbn, isbn_13, title, author } = bookInfo;

    // Try ISBN first (most accurate)
    if (isbn_13) {
      const result = await this.searchByISBN(isbn_13);
      if (result) return result;
    }

    if (isbn) {
      const result = await this.searchByISBN(isbn);
      if (result) return result;
    }

    // Fall back to title/author search
    if (title) {
      const result = await this.searchByTitleAuthor(title, author);
      if (result) return result;
    }

    return null;
  }
}

module.exports = new GoogleBooksService();
