import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (username, email, password) =>
    api.post('/auth/register', { username, email, password }),
  login: (username, password) =>
    api.post('/auth/login', { username, password }),
  getProfile: () => api.get('/auth/profile'),
};

// Books
export const booksAPI = {
  getAll: (limit = 100, offset = 0, sortBy = 'added_at', sortOrder = 'DESC', filters = {}) => {
    const params = { limit, offset, sortBy, sortOrder, ...filters };
    return api.get('/books', { params });
  },
  getById: (id) => api.get(`/books/${id}`),
  search: (query) => api.get('/books/search', { params: { q: query } }),
  download: (id) => api.get(`/books/${id}/download`, { responseType: 'blob' }),
  getStreamUrl: (id) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/books/${id}/stream${token ? `?token=${token}` : ''}`;
  },
  getCoverUrl: (id) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/books/${id}/cover${token ? `?token=${token}` : ''}`;
  },
  upload: (formData) =>
    api.post('/books', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id,data) => api.put(`/books/${id}`, data),
  delete: (id) => api.delete(`/books/${id}`),
  getSimilar: (id, limit = 10) => api.get(`/books/${id}/similar`, { params: { limit } }),
};

// Requests
export const requestsAPI = {
  searchOpenLibrary: (query, author, title) =>
    api.get('/requests/search', { params: { q: query, author, title } }),
  create: (bookData) => api.post('/requests', bookData),
  getMyRequests: () => api.get('/requests/my-requests'),
  getAll: () => api.get('/requests/all'),
  getById: (id) => api.get(`/requests/${id}`),
};

// Email
export const emailAPI = {
  sendBook: (id, email) => api.post(`/email/${id}/send`, { email }),
};

// Metadata
export const metadataAPI = {
  refreshBookMetadata: (id, force = false) =>
    api.post(`/metadata/books/${id}/refresh`, {}, { params: { force } }),
  refreshAllMetadata: (force = false) =>
    api.post('/metadata/update-all', {}, {params: { force } }),
  searchGoogleBooks: (query) =>
    api.get('/metadata/google-books/search', { params: { q: query } }),
  searchOpenLibrary: (query) =>
    api.get('/metadata/openlibrary/search', { params: { q: query } }),
  getMetadata: (params) =>
    api.get('/metadata/search', { params }),
};

// Reading Progress
export const progressAPI = {
  getBookProgress: (bookId) => api.get(`/progress/${bookId}`),
  updateBookProgress: (bookId, progress, currentLocation) =>
    api.post(`/progress/${bookId}`, { progress, current_location: currentLocation }),
  getAllProgress: () => api.get('/progress'),
  getRecentlyRead: (limit = 10) => api.get('/progress/recently-read', { params: { limit } }),
  getContinueReading: (limit = 10) => api.get('/progress/continue-reading', { params: { limit } }),
  deleteProgress: (bookId) => api.delete(`/progress/${bookId}`),
};

// Goodreads Import
export const goodreadsAPI = {
  previewCSV: (formData) =>
    api.post('/goodreads/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  importCSV: (formData) =>
    api.post('/goodreads/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getImportedBooks: (shelf = null) => {
    const params = shelf ? { shelf } : {};
    return api.get('/goodreads/imported-books', { params });
  },
};

export default api;
