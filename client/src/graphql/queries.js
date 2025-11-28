import { gql } from '@apollo/client';

export const GET_BOOKS = gql`
  query GetBooks($limit: Int, $offset: Int, $search: String, $filter: BookFilter) {
    books(limit: $limit, offset: $offset, search: $search, filter: $filter) {
      id
      title
      author
      isbn
      publisher
      publishedDate
      description
      coverImage
      format
      rating
      series
      seriesIndex
      genre
      readingProgress {
        progress
        currentLocation
        lastRead
      }
    }
  }
`;

export const GET_BOOK = gql`
  query GetBook($id: ID!) {
    book(id: $id) {
      id
      title
      author
      isbn
      publisher
      publishedDate
      description
      coverImage
      format
      language
      pageCount
      rating
      series
      seriesIndex
      genre
      uploadedAt
      readingProgress {
        progress
        currentLocation
        lastRead
      }
      similarBooks {
        id
        title
        author
        coverImage
        rating
      }
    }
  }
`;

export const GET_CONTINUE_READING = gql`
  query GetContinueReading($limit: Int) {
    continueReading(limit: $limit) {
      id
      progress
      currentLocation
      lastRead
      book {
        id
        title
        author
        coverImage
        format
      }
    }
  }
`;

export const GET_RECOMMENDATIONS = gql`
  query GetRecommendations($limit: Int) {
    bookRecommendations(limit: $limit) {
      book {
        id
        title
        author
        coverImage
        description
        rating
      }
      reason
      score
    }
  }
`;

export const GET_READING_INSIGHTS = gql`
  query GetReadingInsights {
    readingInsights {
      preferredGenres
      readingPatterns
      suggestedGenres
    }
  }
`;

export const GET_BOOK_SUMMARY = gql`
  query GetBookSummary($id: ID!) {
    bookSummary(id: $id)
  }
`;

export const SEARCH_BOOKS = gql`
  query SearchBooks($search: String!) {
    books(search: $search) {
      id
      title
      author
      coverImage
      format
      rating
    }
  }
`;

export const GET_HEALTH = gql`
  query GetHealth {
    health {
      status
      timestamp
      uptime
      services {
        redis
        ollama
      }
    }
  }
`;
