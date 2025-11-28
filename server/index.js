require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { initDatabase } = require('./database/init');
const downloadMonitor = require('./services/downloadMonitor');
const retryService = require('./services/retryService');

// Import routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const requestRoutes = require('./routes/requests');
const emailRoutes = require('./routes/email');
const metadataRoutes = require('./routes/metadata');
const progressRoutes = require('./routes/progress');
const goodreadsRoutes = require('./routes/goodreads');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/goodreads', goodreadsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Initialize database and start server
const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database initialized successfully');

    // Start download monitor
    downloadMonitor.start();

    // Start retry service
    retryService.start();

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║         BookServe Server               ║
║                                        ║
║  Server running on port ${PORT}         ║
║  Environment: ${process.env.NODE_ENV || 'development'}              ║
║                                        ║
║  API: http://localhost:${PORT}/api      ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  downloadMonitor.stop();
  retryService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  downloadMonitor.stop();
  retryService.stop();
  process.exit(0);
});

startServer();
