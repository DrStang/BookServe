import { gql } from '@apollo/client';

export const UPDATE_PROGRESS = gql`
  mutation UpdateProgress($bookId: ID!, $input: ProgressInput!) {
    updateProgress(bookId: $bookId, input: $input) {
      id
      progress
      currentLocation
      lastRead
    }
  }
`;

export const DELETE_PROGRESS = gql`
  mutation DeleteProgress($bookId: ID!) {
    deleteProgress(bookId: $bookId)
  }
`;

export const CREATE_BOOK_REQUEST = gql`
  mutation CreateBookRequest(
    $title: String!
    $author: String
    $isbn: String
    $notes: String
  ) {
    createBookRequest(title: $title, author: $author, isbn: $isbn, notes: $notes) {
      id
      title
      author
      isbn
      status
      requestedAt
      notes
    }
  }
`;

export const ASK_BOOK_QUESTION = gql`
  mutation AskBookQuestion($bookId: ID!, $question: String!) {
    askBookQuestion(bookId: $bookId, question: $question)
  }
`;

export const LOGIN = gql`
  mutation Login($username: String!, $password: String!) {
    login(username: $username, password: $password) {
      token
      user {
        id
        username
        email
        role
      }
    }
  }
`;

export const REGISTER = gql`
  mutation Register($username: String!, $email: String!, $password: String!) {
    register(username: $username, email: $email, password: $password) {
      token
      user {
        id
        username
        email
        role
      }
    }
  }
`;

export const CREATE_BOOK = gql`
  mutation CreateBook($input: BookInput!) {
    createBook(input: $input) {
      id
      title
      author
      isbn
      description
      coverImage
    }
  }
`;

export const UPDATE_BOOK = gql`
  mutation UpdateBook($id: ID!, $input: BookInput!) {
    updateBook(id: $id, input: $input) {
      id
      title
      author
      isbn
      description
      coverImage
    }
  }
`;

export const DELETE_BOOK = gql`
  mutation DeleteBook($id: ID!) {
    deleteBook(id: $id)
  }
`;

export const REFRESH_BOOK_METADATA = gql`
  mutation RefreshBookMetadata($id: ID!) {
    refreshBookMetadata(id: $id) {
      id
      title
      author
      description
      coverImage
    }
  }
`;
