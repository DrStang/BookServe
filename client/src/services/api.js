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
  getAll: (limit = 100, offset = 0) =>
    api.get('/books', { params: { limit, offset } }),
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
    api.post('/metadata/update-all', {}, { params: { force } }),
  searchGoogleBooks: (query) =>
    api.get('/metadata/google-books/search', { params: { q: query } }),
  searchOpenLibrary: (query) =>
    api.get('/metadata/openlibrary/search', { params: { q: query } }),
  getMetadata: (params) =>
    api.get('/metadata/search', { params }),
};

export default api;
