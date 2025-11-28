const { gql } = require('apollo-server-express');

const typeDefs = gql`
  type User {
    id: ID!
    username: String!
    email: String!
    role: String!
    createdAt: String!
    lastLogin: String
  }

  type Book {
    id: ID!
    title: String!
    author: String!
    isbn: String
    publisher: String
    publishedDate: String
    description: String
    coverImage: String
    filePath: String!
    fileSize: Int
    format: String!
    language: String
    pageCount: Int
    rating: Float
    series: String
    seriesIndex: Int
    genre: String
    uploadedAt: String!
    uploadedBy: Int
    readingProgress: ReadingProgress
    similarBooks: [Book!]
  }

  type ReadingProgress {
    id: ID!
    userId: Int!
    bookId: Int!
    progress: Float!
    currentLocation: String
    lastRead: String!
    user: User
    book: Book
  }

  type BookRequest {
    id: ID!
    userId: Int!
    title: String!
    author: String
    isbn: String
    status: String!
    requestedAt: String!
    notes: String
    user: User
  }

  type AIRecommendation {
    book: Book!
    reason: String!
    score: Float
  }

  type ReadingInsights {
    preferredGenres: [String!]!
    readingPatterns: String!
    suggestedGenres: [String!]!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    uptime: Float!
    services: ServiceStatus!
  }

  type ServiceStatus {
    redis: Boolean!
    ollama: Boolean!
  }

  input BookFilter {
    author: String
    genre: String
    yearFrom: Int
    yearTo: Int
    ratingMin: Float
    ratingMax: Float
    series: String
  }

  input BookInput {
    title: String!
    author: String!
    isbn: String
    publisher: String
    publishedDate: String
    description: String
    language: String
    pageCount: Int
    rating: Float
    series: String
    seriesIndex: Int
    genre: String
  }

  input ProgressInput {
    progress: Float!
    currentLocation: String
  }

  type Query {
    # User queries
    me: User
    user(id: ID!): User

    # Book queries
    books(
      limit: Int
      offset: Int
      search: String
      filter: BookFilter
    ): [Book!]!
    book(id: ID!): Book
    booksByAuthor(author: String!, limit: Int): [Book!]!
    booksBySeries(series: String!): [Book!]!

    # Reading progress queries
    myProgress: [ReadingProgress!]!
    continueReading(limit: Int): [ReadingProgress!]!
    recentlyRead(limit: Int): [ReadingProgress!]!

    # Book request queries
    myRequests: [BookRequest!]!
    allRequests: [BookRequest!]!

    # AI queries
    bookRecommendations(limit: Int): [AIRecommendation!]!
    readingInsights: ReadingInsights
    bookSummary(id: ID!): String

    # System queries
    health: HealthStatus!
  }

  type Mutation {
    # Auth mutations
    register(username: String!, email: String!, password: String!): AuthPayload!
    login(username: String!, password: String!): AuthPayload!

    # Book mutations
    createBook(input: BookInput!): Book!
    updateBook(id: ID!, input: BookInput!): Book!
    deleteBook(id: ID!): Boolean!
    refreshBookMetadata(id: ID!): Book!

    # Progress mutations
    updateProgress(bookId: ID!, input: ProgressInput!): ReadingProgress!
    deleteProgress(bookId: ID!): Boolean!

    # Request mutations
    createBookRequest(title: String!, author: String, isbn: String, notes: String): BookRequest!

    # AI mutations
    askBookQuestion(bookId: ID!, question: String!): String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }
`;

module.exports = typeDefs;
