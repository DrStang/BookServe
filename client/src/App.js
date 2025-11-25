import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import BookReader from './components/Reader/BookReader';
import RequestBook from './components/Requests/RequestBook';
import MyRequests from './components/Requests/MyRequests';
import AuthorPage from './components/Author/AuthorPage';
import PrivateRoute from './components/Common/PrivateRoute';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#e50914',
    },
    secondary: {
      main: '#b20710',
    },
    background: {
      default: '#0f0f0f',
      paper: '#1a1a1a',
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    setIsAuthenticated(!!token);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? (
                <Navigate to="/" />
              ) : (
                <Register onRegister={handleLogin} />
              )
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <Dashboard onLogout={handleLogout} />
              </PrivateRoute>
            }
          />
          <Route
            path="/read/:id"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <BookReader />
              </PrivateRoute>
            }
          />
          <Route
            path="/request"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <RequestBook />
              </PrivateRoute>
            }
          />
          <Route
            path="/my-requests"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <MyRequests />
              </PrivateRoute>
            }
          />
          <Route
            path="/author/:authorName"
            element={
              <PrivateRoute isAuthenticated={isAuthenticated}>
                <AuthorPage />
              </PrivateRoute>
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
