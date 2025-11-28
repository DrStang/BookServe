const Book = require('../models/Book');
const User = require('../models/User');
const ReadingProgress = require('../models/ReadingProgress');
const BookRequest = require('../models/BookRequest');
const ollamaAI = require('../services/ollamaAI');
const cache = require('../services/redisCache');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const resolvers = {
  Query: {
    // User queries
    me: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return await User.findById(user.id);
    },

    user: async (_, { id }) => {
      return await User.findById(id);
    },

    // Book queries
    books: async (_, { limit = 50, offset = 0, search, filter }) => {
      const cacheKey = `books:${limit}:${offset}:${search || ''}:${JSON.stringify(filter || {})}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      let books;
      if (search) {
        books = await Book.search(search);
      } else if (filter) {
        books = await Book.findByFilter(filter);
      } else {
        books = await Book.findAll();
      }

      const result = books.slice(offset, offset + limit);
      await cache.set(cacheKey, result, 300); // 5 min cache
      return result;
    },

    book: async (_, { id }) => {
      const cacheKey = `book:${id}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const book = await Book.findById(id);
      if (book) {
        await cache.set(cacheKey, book, 600); // 10 min cache
      }
      return book;
    },

    booksByAuthor: async (_, { author, limit = 20 }) => {
      return await Book.findByAuthor(author, limit);
    },

    booksBySeries: async (_, { series }) => {
      return await Book.findBySeries(series);
    },

    // Reading progress queries
    myProgress: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return await ReadingProgress.findByUserId(user.id);
    },

    continueReading: async (_, { limit = 10 }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return await ReadingProgress.getContinueReading(user.id, limit);
    },

    recentlyRead: async (_, { limit = 10 }, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return await ReadingProgress.getRecentlyRead(user.id, limit);
    },

    // Book request queries
    myRequests: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');
      return await BookRequest.findByUserId(user.id);
    },

    allRequests: async (_, __, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Not authorized');
      }
      return await BookRequest.findAll();
    },

    // AI queries
    bookRecommendations: async (_, { limit = 5 }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      const available = await ollamaAI.isServiceAvailable();
      if (!available) {
        throw new Error('AI service is not available');
      }

      const progress = await ReadingProgress.findByUserId(user.id);
      const readBooks = await Promise.all(
        progress.map(p => Book.findById(p.book_id))
      );

      const allBooks = await Book.findAll();
      const recommendations = await ollamaAI.getRecommendations(
        readBooks.filter(Boolean),
        allBooks,
        limit
      );

      return recommendations.map(rec => ({
        book: allBooks.find(b => b.id === rec.id),
        reason: rec.reason,
        score: rec.score || 0
      })).filter(rec => rec.book);
    },

    readingInsights: async (_, __, { user }) => {
      if (!user) throw new Error('Not authenticated');

      const available = await ollamaAI.isServiceAvailable();
      if (!available) {
        throw new Error('AI service is not available');
      }

      const progress = await ReadingProgress.findByUserId(user.id);
      const readBooks = await Promise.all(
        progress.map(p => Book.findById(p.book_id))
      );

      return await ollamaAI.generateReadingInsights(readBooks.filter(Boolean));
    },

    bookSummary: async (_, { id }) => {
      const available = await ollamaAI.isServiceAvailable();
      if (!available) {
        throw new Error('AI service is not available');
      }

      const book = await Book.findById(id);
      if (!book) throw new Error('Book not found');

      const cacheKey = `ai:summary:${id}`;
      const cached = await cache.get(cacheKey);
      if (cached) return cached;

      const summary = await ollamaAI.generateBookSummary(book);
      await cache.set(cacheKey, summary, 86400); // 24 hour cache
      return summary;
    },

    // System queries
    health: async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        services: {
          redis: cache.isConnected,
          ollama: await ollamaAI.isServiceAvailable()
        }
      };
    }
  },

  Mutation: {
    // Auth mutations
    register: async (_, { username, email, password }) => {
      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        throw new Error('Username already exists');
      }

      const user = await User.create({
        username,
        email,
        password,
        role: 'user'
      });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return { token, user };
    },

    login: async (_, { username, password }) => {
      const user = await User.findByUsername(username);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        throw new Error('Invalid credentials');
      }

      await User.updateLastLogin(user.id);

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return { token, user };
    },

    // Book mutations
    createBook: async (_, { input }, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Not authorized');
      }

      const book = await Book.create({
        ...input,
        added_by: user.id
      });

      await cache.invalidatePattern('books:*');
      return book;
    },

    updateBook: async (_, { id, input }, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Not authorized');
      }

      const book = await Book.update(id, input);
      await cache.del(`book:${id}`);
      await cache.invalidatePattern('books:*');
      return book;
    },

    deleteBook: async (_, { id }, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Not authorized');
      }

      await Book.delete(id);
      await cache.del(`book:${id}`);
      await cache.invalidatePattern('books:*');
      return true;
    },

    refreshBookMetadata: async (_, { id }, { user }) => {
      if (!user || user.role !== 'admin') {
        throw new Error('Not authorized');
      }

      // This would call the metadata refresh service
      const book = await Book.findById(id);
      await cache.del(`book:${id}`);
      return book;
    },

    // Progress mutations
    updateProgress: async (_, { bookId, input }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      const progress = await ReadingProgress.upsert({
        user_id: user.id,
        book_id: bookId,
        progress: input.progress,
        current_location: input.currentLocation
      });

      return progress;
    },

    deleteProgress: async (_, { bookId }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      await ReadingProgress.delete(user.id, bookId);
      return true;
    },

    // Request mutations
    createBookRequest: async (_, { title, author, isbn, notes }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      return await BookRequest.create({
        user_id: user.id,
        title,
        author,
        isbn,
        notes,
        status: 'pending'
      });
    },

    // AI mutations
    askBookQuestion: async (_, { bookId, question }, { user }) => {
      if (!user) throw new Error('Not authenticated');

      const available = await ollamaAI.isServiceAvailable();
      if (!available) {
        throw new Error('AI service is not available');
      }

      const book = await Book.findById(bookId);
      if (!book) throw new Error('Book not found');

      return await ollamaAI.answerBookQuestion(book, question);
    }
  },

  // Field resolvers
  Book: {
    readingProgress: async (book, _, { user }) => {
      if (!user) return null;
      return await ReadingProgress.findByUserAndBook(user.id, book.id);
    },

    similarBooks: async (book) => {
      return await Book.findSimilar(book.id, 5);
    }
  },

  ReadingProgress: {
    user: async (progress) => {
      return await User.findById(progress.user_id);
    },

    book: async (progress) => {
      return await Book.findById(progress.book_id);
    }
  },

  BookRequest: {
    user: async (request) => {
      return await User.findById(request.user_id);
    }
  }
};

module.exports = resolvers;
