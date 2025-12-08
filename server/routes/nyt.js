const express = require('express');
const router = express.Router();
const axios = require('axios');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const nytBestsellersService = require('../services/nytBestsellersService');

const NYT_API_KEY = process.env.NYT_API_KEY;
const NYT_BASE_URL = 'https://api.nytimes.com/svc/books/v3';

// Cache duration: 1 hour for lists (they update weekly anyway)
const CACHE_DURATION = 60 * 60;

// Try to get cache service if available
let cache = null;
try {
  cache = require('../services/cache');
} catch (e) {
  console.log('[NYT] Cache service not available, running without cache');
}

/**
 * Helper to fetch from NYT API with caching
 */
async function fetchNYT(endpoint, cacheKey) {
  // Try cache first
  if (cache?.isConnected) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        console.log(`[NYT] Cache hit for ${cacheKey}`);
        return JSON.parse(cached);
      }
    } catch (e) {
      console.error('[NYT] Cache read error:', e.message);
    }
  }

  // Fetch from NYT API
  console.log(`[NYT] Fetching from API: ${endpoint}`);
  const response = await axios.get(`${NYT_BASE_URL}${endpoint}`, {
    params: { 'api-key': NYT_API_KEY },
    timeout: 30000,
  });

  // Cache the result
  if (cache?.isConnected && response.data) {
    try {
      await cache.set(cacheKey, JSON.stringify(response.data), CACHE_DURATION);
      console.log(`[NYT] Cached ${cacheKey} for ${CACHE_DURATION}s`);
    } catch (e) {
      console.error('[NYT] Cache write error:', e.message);
    }
  }

  return response.data;
}

// ============================================
// PUBLIC ROUTES (all authenticated users)
// ============================================

/**
 * GET /api/nyt/overview
 * Get all bestseller lists with their books (overview endpoint)
 * Accessible to all authenticated users
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    if (!NYT_API_KEY) {
      return res.status(503).json({ 
        error: 'NYT API not configured',
        message: 'The NYT Bestsellers feature requires an API key' 
      });
    }

    const { date } = req.query;
    const endpoint = date 
      ? `/lists/overview.json?published_date=${date}`
      : '/lists/overview.json';
    
    const cacheKey = `nyt:overview:${date || 'current'}`;
    const data = await fetchNYT(endpoint, cacheKey);

    // Transform response for easier frontend consumption
    const result = {
      publishedDate: data.results?.published_date,
      previousPublishedDate: data.results?.previous_published_date,
      nextPublishedDate: data.results?.next_published_date,
      lists: data.results?.lists || [],
    };

    res.json(result);
  } catch (error) {
    console.error('[NYT] Error fetching overview:', error.message);
    
    if (error.response?.status === 401) {
      return res.status(503).json({ error: 'NYT API authentication failed' });
    }
    if (error.response?.status === 429) {
      return res.status(429).json({ error: 'NYT API rate limit exceeded. Please try again later.' });
    }
    
    res.status(500).json({ error: 'Failed to fetch bestseller lists' });
  }
});

/**
 * GET /api/nyt/lists/:date/:listName
 * Get specific bestseller list
 * Accessible to all authenticated users
 */
router.get('/lists/:date/:listName', authMiddleware, async (req, res) => {
  try {
    if (!NYT_API_KEY) {
      return res.status(503).json({ error: 'NYT API not configured' });
    }

    const { date, listName } = req.params;
    const endpoint = `/lists/${date}/${listName}.json`;
    const cacheKey = `nyt:list:${date}:${listName}`;
    
    const data = await fetchNYT(endpoint, cacheKey);

    res.json({
      listName: data.results?.list_name,
      displayName: data.results?.display_name,
      publishedDate: data.results?.published_date,
      books: data.results?.books || [],
    });
  } catch (error) {
    console.error('[NYT] Error fetching list:', error.message);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'List not found' });
    }
    
    res.status(500).json({ error: 'Failed to fetch bestseller list' });
  }
});

/**
 * GET /api/nyt/list-names
 * Get available list names
 * Accessible to all authenticated users
 */
router.get('/list-names', authMiddleware, async (req, res) => {
  try {
    if (!NYT_API_KEY) {
      return res.status(503).json({ error: 'NYT API not configured' });
    }

    // Use overview endpoint to get list names since /lists/names.json is deprecated
    const cacheKey = 'nyt:list-names';
    const data = await fetchNYT('/lists/overview.json', cacheKey);

    const listNames = (data.results?.lists || []).map(list => ({
      name: list.list_name_encoded,
      displayName: list.display_name,
      updated: list.updated,
    }));

    res.json({ lists: listNames });
  } catch (error) {
    console.error('[NYT] Error fetching list names:', error.message);
    res.status(500).json({ error: 'Failed to fetch list names' });
  }
});

/**
 * GET /api/nyt/reviews
 * Search book reviews
 * Accessible to all authenticated users
 */
router.get('/reviews', authMiddleware, async (req, res) => {
  try {
    if (!NYT_API_KEY) {
      return res.status(503).json({ error: 'NYT API not configured' });
    }

    const { title, author, isbn } = req.query;
    
    if (!title && !author && !isbn) {
      return res.status(400).json({ error: 'At least one search parameter required (title, author, or isbn)' });
    }

    const params = new URLSearchParams({ 'api-key': NYT_API_KEY });
    if (title) params.append('title', title);
    if (author) params.append('author', author);
    if (isbn) params.append('isbn', isbn);

    // Reviews endpoint doesn't cache well since queries vary
    const response = await axios.get(`${NYT_BASE_URL}/reviews.json?${params}`, {
      timeout: 30000,
    });

    res.json({
      reviews: response.data.results || [],
      numResults: response.data.num_results || 0,
    });
  } catch (error) {
    console.error('[NYT] Error searching reviews:', error.message);
    res.status(500).json({ error: 'Failed to search reviews' });
  }
});

// ============================================
// ADMIN-ONLY ROUTES
// ============================================

/**
 * GET /api/nyt/status
 * Get NYT Bestsellers service status (admin only)
 */
router.get('/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const status = await nytBestsellersService.getStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/nyt/trigger
 * Manually trigger a bestsellers check (admin only)
 */
router.post('/trigger', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const result = await nytBestsellersService.triggerCheck();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/nyt/admin/lists
 * Get available NYT bestseller lists with admin info (admin only)
 */
router.get('/admin/lists', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const lists = await nytBestsellersService.getAvailableLists();
    res.json({ lists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Keep the old /lists endpoint for backwards compatibility with admin panel
router.get('/lists', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const lists = await nytBestsellersService.getAvailableLists();
    res.json({ lists });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
