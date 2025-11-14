# BookServe

A Plex-like media server for digital books (EPUB). Manage your personal book library, read books online, download them, send to email, and automatically request new books through NZBHydra and SABnzbd.

![BookServe](https://img.shields.io/badge/BookServe-v1.0.0-red)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![React](https://img.shields.io/badge/React-18+-blue)

## Features

### Core Features
- **Digital Book Library** - Store and manage your EPUB book collection
- **Web-based Reader** - Read books directly in your browser with a beautiful EPUB reader
- **Book Metadata & Ratings** - Automatically fetch book details, descriptions, and ratings from Google Books and OpenLibrary
- **Detailed Book Information** - View comprehensive book details including cover art, descriptions, ratings, categories, publisher info, and more
- **User Authentication** - Individual user accounts with JWT-based authentication
- **Book Download** - Download books to your devices
- **Email Delivery** - Send books directly to your email address
- **Search Library** - Search your collection by title, author, or ISBN

### Request System
- **OpenLibrary Integration** - Search for books using the OpenLibrary API
- **Automated Downloads** - Automatically download requested books via NZBHydra and SABnzbd
- **Request Tracking** - Monitor the status of your book requests
- **Auto-Import** - Automatically import completed downloads into your library
- **Automatic Metadata Enrichment** - Newly added books automatically fetch metadata from Google Books and OpenLibrary

## Architecture

### Backend
- **Node.js** with Express
- **SQLite** database for user and book management
- **JWT** authentication
- **Multer** for file uploads
- **Nodemailer** for email delivery
- **Axios** for API integrations

### Frontend
- **React 18** with Material-UI
- **React Router** for navigation
- **EPUBjs** with React Reader for book reading
- **Axios** for API communication

### External Integrations
- **Google Books API** - Rich book metadata, ratings, and descriptions
- **OpenLibrary API** - Book search, metadata, and additional ratings
- **NZBHydra** - NZB indexer aggregation
- **SABnzbd** - Usenet downloader

## Installation

### Prerequisites
- Node.js 18+ and npm
- NZBHydra (optional, for automated downloads)
- SABnzbd (optional, for automated downloads)
- SMTP server (optional, for email functionality)

### Quick Start

1. **Clone the repository**
```bash
git clone <repository-url>
cd BookServe
```

2. **Install dependencies**
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client
npm install
cd ..
```

3. **Configure environment**
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and configure your settings
nano .env
```

4. **Start the application**

**Development mode:**
```bash
# Terminal 1 - Start backend
npm run server

# Terminal 2 - Start frontend
npm run client
```

**Production mode:**
```bash
# Build frontend
npm run build

# Start server
NODE_ENV=production npm start
```

The application will be available at:
- Frontend: http://localhost:3000 (development) or http://localhost:5000 (production)
- API: http://localhost:5000/api

## Configuration

### Environment Variables

Edit the `.env` file with your configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# JWT Secret (IMPORTANT: Change this!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# Database
DB_PATH=./data/bookserve.db

# File Storage
BOOKS_STORAGE_PATH=./data/books
UPLOADS_PATH=./data/uploads

# Email Configuration (for sending books to email)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# NZBHydra Configuration
NZBHYDRA_URL=http://localhost:5076
NZBHYDRA_API_KEY=your-nzbhydra-api-key

# SABnzbd Configuration
SABNZBD_URL=http://localhost:8080
SABNZBD_API_KEY=your-sabnzbd-api-key

# OpenLibrary API (no key required)
OPENLIBRARY_API_URL=https://openlibrary.org

# Auto-import settings
AUTO_IMPORT_ENABLED=true
AUTO_IMPORT_INTERVAL=300000
```

### Email Configuration

For Gmail:
1. Enable 2-factor authentication on your Google account
2. Generate an "App Password" at https://myaccount.google.com/apppasswords
3. Use this app password in the `EMAIL_PASS` variable

### NZBHydra Configuration

1. Install and configure NZBHydra2
2. Get your API key from Settings → Main
3. Add the URL and API key to `.env`

### SABnzbd Configuration

1. Install and configure SABnzbd
2. Get your API key from Config → General
3. Add the URL and API key to `.env`
4. Make sure SABnzbd has a category configured for ebooks

## Usage

### First Time Setup

1. **Register an account**
   - Navigate to http://localhost:3000/register
   - Create your user account

2. **Login**
   - Use your credentials to log in

3. **Request your first book**
   - Click "Request Book"
   - Search for a book using the OpenLibrary search
   - Click "Request This Book"
   - The system will automatically search NZBHydra and download via SABnzbd

### Reading Books

1. Click on any book in your library
2. The EPUB reader will open
3. Use the navigation controls to read
4. Your progress is saved automatically

### Viewing Book Details

1. Click the menu icon (⋮) on any book card
2. Select "View Details"
3. View comprehensive information including:
   - Book cover and title
   - Author and publisher
   - Average rating and number of ratings
   - Categories/genres
   - Description
   - Page count, ISBN, publication date
   - Links to preview and more information
4. Click "Refresh" icon to update metadata from Google Books and OpenLibrary

### Downloading Books

1. Click the menu icon (⋮) on any book card
2. Select "Download"
3. The book will be downloaded to your device

### Sending Books to Email

1. Click the menu icon (⋮) on any book card
2. Select "Send to Email"
3. Enter the recipient email address
4. Click "Send"

### Monitoring Requests

1. Click "My Requests" in the navigation
2. View the status of all your book requests
3. Statuses include:
   - **Pending** - Request received
   - **Searching** - Searching NZBHydra for the book
   - **Downloading** - Download in progress via SABnzbd
   - **Completed** - Book added to your library
   - **Failed** - Request failed (with error message)

## API Documentation

### Authentication Endpoints

#### Register
```
POST /api/auth/register
Body: { username, email, password }
Response: { token, user }
```

#### Login
```
POST /api/auth/login
Body: { username, password }
Response: { token, user }
```

#### Get Profile
```
GET /api/auth/profile
Headers: Authorization: Bearer <token>
Response: { user }
```

### Book Endpoints

#### Get All Books
```
GET /api/books?limit=100&offset=0
Headers: Authorization: Bearer <token>
Response: { books, total, limit, offset }
```

#### Get Book by ID
```
GET /api/books/:id
Headers: Authorization: Bearer <token>
Response: { book }
```

#### Search Books
```
GET /api/books/search?q=query
Headers: Authorization: Bearer <token>
Response: { books, count }
```

#### Download Book
```
GET /api/books/:id/download
Headers: Authorization: Bearer <token>
Response: Binary file
```

#### Stream Book
```
GET /api/books/:id/stream
Headers: Authorization: Bearer <token>
Response: Binary file
```

### Request Endpoints

#### Search OpenLibrary
```
GET /api/requests/search?q=query
Headers: Authorization: Bearer <token>
Response: { books, total }
```

#### Create Request
```
POST /api/requests
Headers: Authorization: Bearer <token>
Body: { title, author, isbn, openlibrary_id }
Response: { request }
```

#### Get My Requests
```
GET /api/requests/my-requests
Headers: Authorization: Bearer <token>
Response: { requests }
```

### Email Endpoints

#### Send Book by Email
```
POST /api/email/:id/send
Headers: Authorization: Bearer <token>
Body: { email }
Response: { message }
```

### Metadata Endpoints

#### Refresh Book Metadata
```
POST /api/metadata/books/:id/refresh?force=false
Headers: Authorization: Bearer <token>
Response: { message, book }
```

#### Search Google Books
```
GET /api/metadata/google-books/search?q=query
Headers: Authorization: Bearer <token>
Response: { results, count }
```

#### Search OpenLibrary for Metadata
```
GET /api/metadata/openlibrary/search?q=query
Headers: Authorization: Bearer <token>
Response: { results, count }
```

#### Get Combined Metadata
```
GET /api/metadata/search?isbn=XXX&title=XXX&author=XXX
Headers: Authorization: Bearer <token>
Response: { google, openLibrary, merged }
```

## Project Structure

```
BookServe/
├── server/
│   ├── controllers/        # Request handlers
│   │   ├── authController.js
│   │   ├── bookController.js
│   │   ├── requestController.js
│   │   ├── emailController.js
│   │   └── metadataController.js
│   ├── database/          # Database setup
│   │   └── init.js
│   ├── middleware/        # Express middleware
│   │   └── auth.js
│   ├── models/           # Data models
│   │   ├── User.js
│   │   ├── Book.js
│   │   └── BookRequest.js
│   ├── routes/           # API routes
│   │   ├── auth.js
│   │   ├── books.js
│   │   ├── requests.js
│   │   ├── email.js
│   │   └── metadata.js
│   ├── services/         # Background services
│   │   ├── downloadMonitor.js
│   │   ├── googleBooksService.js
│   │   ├── openLibraryService.js
│   │   └── metadataService.js
│   └── index.js          # Server entry point
├── client/
│   ├── public/
│   └── src/
│       ├── components/
│       │   ├── Auth/
│       │   │   ├── Login.js
│       │   │   └── Register.js
│       │   ├── Common/
│       │   │   └── PrivateRoute.js
│       │   ├── Dashboard/
│       │   │   ├── Dashboard.js
│       │   │   └── BookCard.js
│       │   ├── BookDetails/
│       │   │   └── BookDetails.js
│       │   ├── Reader/
│       │   │   └── BookReader.js
│       │   └── Requests/
│       │       ├── RequestBook.js
│       │       └── MyRequests.js
│       ├── services/
│       │   └── api.js
│       ├── App.js
│       └── index.js
├── data/                 # Created on first run
│   ├── books/           # Stored book files
│   └── bookserve.db     # SQLite database
├── .env                 # Environment configuration
├── .env.example         # Example environment file
├── package.json         # Backend dependencies
└── README.md           # This file
```

## Development

### Adding New Features

1. **Backend**: Add controllers, routes, and models in the `server/` directory
2. **Frontend**: Add components in `client/src/components/`
3. **API Integration**: Update `client/src/services/api.js`

### Database Schema

The SQLite database includes the following tables:

- **users** - User accounts
- **books** - Book library
- **book_requests** - Book download requests
- **reading_progress** - User reading progress
- **download_history** - Download tracking

## Troubleshooting

### Books not downloading automatically

1. Check NZBHydra and SABnzbd are running
2. Verify API keys in `.env` are correct
3. Check server logs for errors
4. Ensure `AUTO_IMPORT_ENABLED=true` in `.env`

### Email not working

1. Verify SMTP settings in `.env`
2. For Gmail, use an App Password
3. Check firewall/port settings

### Reader not loading books

1. Ensure the book file exists in `data/books/`
2. Check browser console for CORS errors
3. Verify the book is a valid EPUB file

## Security Considerations

1. **Change JWT_SECRET** - Use a strong, random secret key
2. **HTTPS** - Use HTTPS in production (configure reverse proxy)
3. **Firewall** - Restrict access to your network
4. **Backups** - Regularly backup the `data/` directory
5. **Updates** - Keep dependencies updated

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Acknowledgments

- [OpenLibrary](https://openlibrary.org/) for book metadata
- [EPUBjs](https://github.com/futurepress/epub.js/) for the EPUB reader
- [Material-UI](https://mui.com/) for the UI components
- Inspired by [Plex](https://www.plex.tv/)

## Support

For issues and questions:
- GitHub Issues: [Create an issue]
- Documentation: See this README

---

**BookServe** - Your personal digital book library
