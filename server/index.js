require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { ApolloServer } = require('apollo-server-express');
const { initDatabase } = require('./database/init');
const downloadMonitor = require('./services/downloadMonitor');
const retryService = require('./services/retryService');
const cache = require('./services/redisCache');
const ollamaAI = require('./services/ollamaAI');
const folderScanService = require('./services/folderScanService');
const aiCacheService = require('./services/aiCacheService');
const nytBestsellersService = require('./services/nytBestsellersService');
const scanRoutes = require('./routes/scan');
const nytRoutes = require('./routes/nyt');


// Import GraphQL schema and resolvers
const typeDefs = require('./graphql/schema');
const resolvers = require('./graphql/resolvers');

// Import routes
const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const requestRoutes = require('./routes/requests');
const emailRoutes = require('./routes/email');
const metadataRoutes = require('./routes/metadata');
const progressRoutes = require('./routes/progress');
const goodreadsRoutes = require('./routes/goodreads');
const aiRoutes = require('./routes/ai');

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
app.use('/api/ai', aiRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/nyt', nytRoutes);


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
    console.log('✓ Database initialized successfully');

    // Initialize Redis cache
    await cache.connect();

    // Initialize Ollama AI service
    await ollamaAI.initialize();

    folderScanService.start();

    aiCacheService.start();

    nytBestsellersService.start();

    // Create GraphQL server with context
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      context: ({ req }) => {
        // Extract user from JWT token
        const token = req.headers.authorization?.replace('Bearer ', '');
        let user = null;

        if (token) {
          try {
            const jwt = require('jsonwebtoken');
            user = jwt.verify(token, process.env.JWT_SECRET);
          } catch (error) {
            console.error('Invalid token:', error.message);
          }
        }

        return { user };
      }
    });

    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });

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
║  REST API: http://localhost:${PORT}/api ║
║  GraphQL: http://localhost:${PORT}${apolloServer.graphqlPath} ║
║                                        ║
║  Services:                             ║
║  ${cache.isConnected ? '✓' : '✗'} Redis Cache                      ║
║  ${ollamaAI.isAvailable ? '✓' : '✗'} Ollama AI                       ║
║  ${process.env.AUTO_IMPORT_ENABLED === 'true' ? '✓' : '✗'} Download Monitor                ║
║  ${process.env.RETRY_ENABLED === 'true' ? '✓' : '✗'} Retry Service                   ║
║  ${process.env.FOLDER_SCAN_ENABLED === 'true' ? '✓' : '✗'} Folder Scanner                  ║
║  ${process.env.AI_CACHE_ENABLED === 'true' ? '✓' : '✗'} AI Cache Service                ║
║  ${process.env.NYT_ENABLED === 'true' ? '✓' : '✗'} NYT Bestsellers                 ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  downloadMonitor.stop();
  retryService.stop();
  folderScanService.stop();
  aiCacheService.stop();
  nytBestsellersService.stop();
  await cache.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  downloadMonitor.stop();
  retryService.stop();
  folderScanService.stop();
  aiCacheService.stop();
  nytBestsellersService.stop();
  await cache.disconnect();
  process.exit(0);
});

startServer();
