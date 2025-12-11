import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }  
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
  download: (id, format = null) => {
    const params = format ? { format } : {};
    return api.get(`/books/${id}/download`, { responseType: 'blob', params });
  },
  getStreamUrl: (id) => {
    const token = localStorage.getItem('token');
    return `${API_BASE_URL}/books/${id}/stream${token ? `?token=${token}` : ''}`;
  },
getCoverUrl: (id) => {
  return `${API_BASE_URL}/books/${id}/cover`;  // No token needed
},
  upload: (formData) =>
    api.post('/books', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id, data) => api.put(`/books/${id}`, data),
  delete: (id) => api.delete(`/books/${id}`),
  getSimilar: (id, limit = 10) => api.get(`/books/${id}/similar`, { params: { limit } }),
  // New: Bulk update multiple books
  bulkUpdate: (bookIds, updates) => api.post('/books/bulk-update', { bookIds, updates }),
  // New: Get all unique series names
  getAllSeries: () => api.get('/books/metadata/series'),
};

// Requests
export const requestsAPI = {
  searchOpenLibrary: (query, author, title) =>
    api.get('/requests/search', { params: { q: query, author, title } }),
  create: (bookData) => api.post('/requests', bookData),
  getMyRequests: () => api.get('/requests/my-requests'),
  // Admin only: get ALL requests from all users
  getAllRequests: (status = null) => {
    const params = status ? { status } : {};
    return api.get('/requests/all', { params });
  },
  getById: (id) => api.get(`/requests/${id}`),
  delete: (id) => api.delete(`/requests/${id}`),
  getStats: () => api.get('/requests/stats'),
  retryWithCustomSearch: (id, customTerms = {}) =>
    api.post(`requests/${id}/retry`, customTerms),
  getSearchFailures: () => api.get('/requests/search-failures'),
};

// Email
export const emailAPI = {
  sendBook: (id, email, format = null) => api.post(`/email/${id}/send`, { email, format }),
};

// Metadata
export const metadataAPI = {
  refreshBookMetadata: (id, force = false) =>
    api.post(`/metadata/books/${id}/refresh`, {}, { params: { force } }),
  refreshAllMetadata: (force = false) =>
    api.post('/metadata/update-all', {}, { params: { force } }),
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

// NYT Bestsellers (admin only)
export const nytAPI = {
  getOverview: (date = null) => {
    const params = date ? { date } : {};
    return api.get('/nyt/overview', { params });
  },
  getList: (listName, date = 'current') =>
    api.get(`/nyt/lists/${date}/${listName}`),
  getListNames: () => api.get('/nyt/list-names'),
  searchReviews: (params) => api.get('/nyt/reviews', { params }),
  getStatus: () => api.get('/nyt/status'),
  triggerCheck: () => api.post('/nyt/trigger'),
  getLists: () => api.get('/nyt/admin/lists'),
};

// Admin endpoints
export const adminAPI = {
  // Request statistics
  getRequestStats: () => api.get('/requests/stats'),
  // AI cache management
  getAICacheStatus: () => api.get('/ai/cache-status'),
  triggerAIUpdate: () => api.post('/ai/trigger-update'),
  invalidateAICache: (userId = null, pattern = null) => 
    api.post('/ai/invalidate-cache', { userId, pattern }),
  // Folder scan
  getScanStatus: () => api.get('/scan/status'),
  triggerScan: () => api.post('/scan/trigger'),
  // NYT
  getNYTStatus: () => api.get('/nyt/status'),
  triggerNYTCheck: () => api.post('/nyt/trigger'),
};

export default api;
