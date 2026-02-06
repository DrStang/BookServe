/**
 * OPDS Routes for BookServe
 *
 * These routes provide OPDS catalog feeds that can be consumed by
 * e-reader apps like KOReader, Moon+ Reader, Librera, Aldiko, etc.
 *
 * Usage:
 * 1. Add to server/index.js: app.use('/opds', opdsRoutes);
 * 2. Configure your e-reader app with: http://your-server:5000/opds
 *
 * Optional: Enable basic auth for OPDS by setting OPDS_AUTH=true in .env
 */

const express = require('express');
const router = express.Router();
const opdsService = require('../services/opdsService');

// Optional: Basic Auth middleware for OPDS
// Many e-reader apps support basic auth
const basicAuthMiddleware = (req, res, next) => {
    // Skip auth if OPDS_AUTH is not enabled
    if (process.env.OPDS_AUTH !== 'true') {
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="BookServe OPDS"');
        return res.status(401).send('Authentication required');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
    const [username, password] = credentials.split(':');

    // Verify credentials against database
    const { db } = require('../database/init');
    const bcrypt = require('bcryptjs');

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            res.set('WWW-Authenticate', 'Basic realm="BookServe OPDS"');
            return res.status(401).send('Invalid credentials');
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            res.set('WWW-Authenticate', 'Basic realm="BookServe OPDS"');
            return res.status(401).send('Invalid credentials');
        }

        req.user = user;
        next();
    });
};

// Set content type for all OPDS responses
router.use((req, res, next) => {
    res.set('Content-Type', 'application/atom+xml;profile=opds-catalog;charset=utf-8');
    next();
});

// Apply basic auth to all routes if enabled
router.use(basicAuthMiddleware);

/**
 * GET /opds
 * Root navigation catalog
 */
router.get('/', async (req, res) => {
    try {
        const feed = await opdsService.getRootCatalog();
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error generating root catalog:', error);
        res.status(500).send('Error generating catalog');
    }
});

/**
 * GET /opds/all
 * All books (paginated)
 */
router.get('/all', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const feed = await opdsService.getAllBooks(page);
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching all books:', error);
        res.status(500).send('Error fetching books');
    }
});

/**
 * GET /opds/recent
 * Recently added books (paginated)
 */
router.get('/recent', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const feed = await opdsService.getRecentBooks(page);
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching recent books:', error);
        res.status(500).send('Error fetching books');
    }
});

/**
 * GET /opds/authors
 * List of all authors
 */
router.get('/authors', async (req, res) => {
    try {
        const feed = await opdsService.getAuthors();
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching authors:', error);
        res.status(500).send('Error fetching authors');
    }
});

/**
 * GET /opds/authors/:author
 * Books by specific author (paginated)
 */
router.get('/authors/:author', async (req, res) => {
    try {
        const author = decodeURIComponent(req.params.author);
        const page = parseInt(req.query.page) || 1;
        const feed = await opdsService.getBooksByAuthor(author, page);
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching books by author:', error);
        res.status(500).send('Error fetching books');
    }
});

/**
 * GET /opds/genres
 * List of all genres/categories
 */
router.get('/genres', async (req, res) => {
    try {
        const feed = await opdsService.getGenres();
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching genres:', error);
        res.status(500).send('Error fetching genres');
    }
});

/**
 * GET /opds/genres/:genre
 * Books in specific genre (paginated)
 */
router.get('/genres/:genre', async (req, res) => {
    try {
        const genre = decodeURIComponent(req.params.genre);
        const page = parseInt(req.query.page) || 1;
        const feed = await opdsService.getBooksByGenre(genre, page);
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching books by genre:', error);
        res.status(500).send('Error fetching books');
    }
});

/**
 * GET /opds/series
 * List of all series
 */
router.get('/series', async (req, res) => {
    try {
        const feed = await opdsService.getSeries();
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching series:', error);
        res.status(500).send('Error fetching series');
    }
});

/**
 * GET /opds/series/:series
 * Books in specific series (paginated)
 */
router.get('/series/:series', async (req, res) => {
    try {
        const series = decodeURIComponent(req.params.series);
        const page = parseInt(req.query.page) || 1;
        const feed = await opdsService.getBooksBySeries(series, page);
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error fetching books by series:', error);
        res.status(500).send('Error fetching books');
    }
});

/**
 * GET /opds/search
 * Search books
 */
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q || req.query.query || '';
        if (!query) {
            return res.status(400).send('Search query required');
        }

        const page = parseInt(req.query.page) || 1;
        const feed = await opdsService.searchBooks(query, page);
        res.send(feed);
    } catch (error) {
        console.error('[OPDS] Error searching books:', error);
        res.status(500).send('Error searching books');
    }
});

/**
 * OpenSearch description document
 * Some e-readers use this to enable search
 */
router.get('/opensearch.xml', (req, res) => {
    const baseUrl = process.env.OPDS_BASE_URL || process.env.BASE_URL || 'http://localhost:5000';
    const title = process.env.OPDS_TITLE || 'BookServe Library';

    res.set('Content-Type', 'application/opensearchdescription+xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>${title}</ShortName>
  <Description>Search the ${title}</Description>
  <Url type="application/atom+xml;profile=opds-catalog;kind=acquisition" template="${baseUrl}/opds/search?q={searchTerms}"/>
</OpenSearchDescription>`);
});

module.exports = router;