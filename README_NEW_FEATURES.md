# BookServe - New Features Guide

This document describes the newly added features to BookServe.

## 🚀 New Features

### 1. PDF Reader Support
- **Description**: Native PDF reading support with page navigation, zoom controls, and progress tracking
- **Usage**: Upload PDF files and read them directly in the browser
- **Features**:
  - Page-by-page navigation
  - Zoom in/out controls
  - Keyboard shortcuts (Arrow keys, PageUp/Down, Home/End)
  - Progress tracking
  - Full-screen reading mode

### 2. MOBI/AZW Reader with Conversion
- **Description**: Automatic conversion of MOBI/AZW/AZW3 files to EPUB for reading
- **Requirements**: Calibre's `ebook-convert` must be installed
- **Installation**:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install calibre

  # macOS
  brew install --cask calibre

  # Windows
  # Download from https://calibre-ebook.com/download
  ```
- **Usage**: Upload MOBI/AZW files - they will be automatically converted to EPUB when opened
- **Features**:
  - Automatic conversion on-demand
  - Cached conversions (no re-conversion needed)
  - Supports MOBI, AZW, and AZW3 formats

### 3. Redis Caching
- **Description**: High-performance caching for API responses and book metadata
- **Requirements**: Redis server running
- **Installation**:
  ```bash
  # Ubuntu/Debian
  sudo apt-get install redis-server

  # macOS
  brew install redis

  # Docker
  docker run -d -p 6379:6379 redis:alpine
  ```
- **Configuration**: Set `REDIS_URL` in `.env` (default: redis://localhost:6379)
- **Features**:
  - Caches book lists and metadata (5-10 minutes)
  - Caches AI recommendations (1 hour)
  - Caches AI summaries (24 hours)
  - Automatic cache invalidation on updates
  - Graceful degradation if Redis is unavailable

### 4. GraphQL API
- **Description**: Modern GraphQL API alongside the existing REST API
- **Endpoint**: http://localhost:5000/graphql
- **Playground**: Visit http://localhost:5000/graphql in your browser for the GraphiQL interface
- **Features**:
  - Query books with flexible filtering
  - Nested queries (books with reading progress, similar books)
  - Mutations for creating/updating books and progress
  - AI queries (recommendations, insights, summaries)
  - Real-time health status

#### Example Queries:

**Get Books with Progress:**
```graphql
query {
  books(limit: 10) {
    id
    title
    author
    coverImage
    readingProgress {
      progress
      lastRead
    }
  }
}
```

**Get AI Recommendations:**
```graphql
query {
  bookRecommendations(limit: 5) {
    book {
      id
      title
      author
      description
    }
    reason
    score
  }
}
```

**Update Reading Progress:**
```graphql
mutation {
  updateProgress(
    bookId: "123"
    input: { progress: 45.5, currentLocation: "chapter-3" }
  ) {
    progress
    lastRead
  }
}
```

### 5. AI Integration with Ollama
- **Description**: Local AI integration for book recommendations, summaries, and insights
- **Requirements**: Ollama running locally
- **Installation**:
  ```bash
  # Install Ollama
  curl -fsSL https://ollama.ai/install.sh | sh

  # Pull a model (e.g., llama2)
  ollama pull llama2

  # Or use a different model
  ollama pull mistral
  ollama pull codellama
  ```
- **Configuration**:
  - Set `OLLAMA_HOST` in `.env` (default: http://localhost:11434)
  - Set `OLLAMA_MODEL` in `.env` (default: llama2)
- **Features**:
  - **Personalized Recommendations**: AI-powered book suggestions based on reading history
  - **Reading Insights**: Analyze reading patterns and genre preferences
  - **Book Summaries**: Generate AI summaries for books
  - **Q&A**: Ask questions about specific books
  - **Streaming Chat**: Interactive AI chat (via REST API)

#### AI API Endpoints:

- `GET /api/ai/status` - Check AI service status
- `GET /api/ai/recommendations?limit=5` - Get personalized recommendations
- `GET /api/ai/insights` - Get reading insights and patterns
- `GET /api/ai/summary/:id` - Get AI summary for a book
- `POST /api/ai/ask/:id` - Ask a question about a book
- `POST /api/ai/chat` - Stream chat with AI

#### Example Usage:

```javascript
// Get recommendations
const response = await axios.get('/api/ai/recommendations?limit=5', {
  headers: { Authorization: `Bearer ${token}` }
});

// Get book summary
const summary = await axios.get('/api/ai/summary/123', {
  headers: { Authorization: `Bearer ${token}` }
});

// Ask a question about a book
const answer = await axios.post(
  '/api/ai/ask/123',
  { question: 'What are the main themes?' },
  { headers: { Authorization: `Bearer ${token}` } }
);
```

## 📦 Installation

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Install external services:**
   - Redis (for caching)
   - Calibre (for MOBI/AZW conversion)
   - Ollama (for AI features)

3. **Configure environment:**
   - Copy `.env.example` to `.env`
   - Update Redis and Ollama URLs if not using defaults
   - Choose your preferred Ollama model

4. **Start services:**
   ```bash
   # Start Redis
   redis-server

   # Start Ollama
   ollama serve

   # Start BookServe
   npm run dev
   ```

## 🎨 Frontend Integration

The frontend now includes:
- **PDF Reader Component**: `client/src/components/Reader/PDFReader.js`
- **GraphQL Client**: `client/src/graphql/client.js`
- **GraphQL Queries**: `client/src/graphql/queries.js`
- **GraphQL Mutations**: `client/src/graphql/mutations.js`

To use GraphQL in your React components:

```javascript
import { useQuery } from '@apollo/client';
import { GET_BOOKS } from '../graphql/queries';

function BookList() {
  const { loading, error, data } = useQuery(GET_BOOKS, {
    variables: { limit: 20 }
  });

  if (loading) return <Loading />;
  if (error) return <Error />;

  return <Books books={data.books} />;
}
```

## 🔧 Troubleshooting

### Redis Connection Issues
- Ensure Redis is running: `redis-cli ping` should return `PONG`
- Check Redis URL in `.env`
- BookServe will continue to work without Redis (caching disabled)

### Ollama Not Working
- Check if Ollama is running: `curl http://localhost:11434/api/tags`
- Verify model is installed: `ollama list`
- Pull a model if needed: `ollama pull llama2`
- AI features will be disabled if Ollama is unavailable

### MOBI/AZW Conversion Fails
- Verify Calibre is installed: `ebook-convert --version`
- Check file permissions on `./data/converted` directory
- Check server logs for conversion errors

### PDF Reader Not Loading
- Ensure `react-pdf` dependencies are installed
- Check browser console for errors
- Verify PDF file is accessible at `/api/books/:id/stream`

## 📊 Performance Considerations

### Redis Caching
- Book lists cached for 5 minutes
- Book details cached for 10 minutes
- AI recommendations cached for 1 hour
- AI summaries cached for 24 hours

### MOBI/AZW Conversion
- First conversion may take 10-30 seconds depending on book size
- Converted files are cached and reused
- Converted files stored in `./data/converted`

### Ollama AI
- Response time depends on model size and hardware
- Llama2 7B: Fast on most systems
- Llama2 13B/70B: Requires more RAM and slower
- Consider using `mistral` for faster responses

## 🔐 Security Notes

- GraphQL requires JWT authentication (same as REST API)
- AI endpoints require authentication
- Redis connection should be secured in production
- Ollama should not be exposed to the internet

## 📝 Environment Variables Reference

```bash
# Redis
REDIS_URL=redis://localhost:6379

# Ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama2

# File Storage
CONVERTED_BOOKS_PATH=./data/converted
```

## 🎯 Next Steps

1. Integrate PDF reader in the main Dashboard
2. Add AI recommendations widget to Dashboard
3. Create reading insights page
4. Add AI chat interface
5. Implement GraphQL subscriptions for real-time updates

## 📚 Additional Resources

- [Redis Documentation](https://redis.io/documentation)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [GraphQL Documentation](https://graphql.org/learn/)
- [Calibre CLI Documentation](https://manual.calibre-ebook.com/generated/en/ebook-convert.html)
- [React PDF Documentation](https://github.com/wojtekmaj/react-pdf)
