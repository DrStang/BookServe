const BookRequest = require('../models/BookRequest');
const axios = require('axios');

// Search OpenLibrary
exports.searchOpenLibrary = async (req, res) => {
  try {
    const { q, author, title } = req.query;

    if (!q && !title) {
      return res.status(400).json({ error: 'Search query or title required' });
    }

    let searchUrl = 'https://openlibrary.org/search.json?';

    if (q) {
      searchUrl += `q=${encodeURIComponent(q)}`;
    } else {
      if (title) searchUrl += `title=${encodeURIComponent(title)}`;
      if (author) searchUrl += `&author=${encodeURIComponent(author)}`;
    }

    const response = await axios.get(searchUrl);

    const books = response.data.docs.slice(0, 20).map(doc => ({
      key: doc.key,
      title: doc.title,
      author: doc.author_name ? doc.author_name.join(', ') : 'Unknown',
      first_publish_year: doc.first_publish_year,
      isbn: doc.isbn ? doc.isbn[0] : null,
      publisher: doc.publisher ? doc.publisher[0] : null,
      cover_id: doc.cover_i,
      cover_url: doc.cover_i
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : null
    }));

    res.json({ books, total: response.data.numFound });
  } catch (error) {
    console.error('OpenLibrary search error:', error);
    res.status(500).json({ error: 'Error searching OpenLibrary' });
  }
};

// Create a book request
exports.createRequest = async (req, res) => {
  try {
    const { title, author, isbn, openlibrary_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Book title required' });
    }

    const requestData = {
      user_id: req.user.id,
      title,
      author: author || null,
      isbn: isbn || null,
      openlibrary_id: openlibrary_id || null
    };

    const request = await BookRequest.create(requestData);

    // Trigger background processing
    processBookRequest(request.id).catch(err => {
      console.error('Error processing request:', err);
    });

    res.status(201).json({
      message: 'Book request created successfully',
      request
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ error: 'Error creating book request' });
  }
};

// Get all requests (admin)
exports.getAllRequests = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const requests = await BookRequest.findAll(parseInt(limit), parseInt(offset));

    res.json({ requests });
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Error fetching requests' });
  }
};

// Get user's requests
exports.getUserRequests = async (req, res) => {
  try {
    const requests = await BookRequest.findByUserId(req.user.id);
    res.json({ requests });
  } catch (error) {
    console.error('Error fetching user requests:', error);
    res.status(500).json({ error: 'Error fetching requests' });
  }
};

// Get request by ID
exports.getRequestById = async (req, res) => {
  try {
    const request = await BookRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // Check if user owns this request or is admin
    if (request.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ request });
  } catch (error) {
    console.error('Error fetching request:', error);
    res.status(500).json({ error: 'Error fetching request' });
  }
};

// Background processing function
async function processBookRequest(requestId) {
  try {
    const request = await BookRequest.findById(requestId);
    if (!request) return;

    // Update status to searching
    await BookRequest.updateStatus(requestId, 'searching');

    // Search NZBHydra
    const nzbResults = await searchNZBHydra(request.title, request.author);

    if (!nzbResults || nzbResults.length === 0) {
      await BookRequest.updateStatus(requestId, 'failed', {
        error_message: 'No results found in NZBHydra'
      });
      return;
    }

    // Get the best result (first one)
    const bestResult = nzbResults[0];

    // Send to SABnzbd
    const sabnzbdId = await sendToSABnzbd(bestResult);

    if (!sabnzbdId) {
      await BookRequest.updateStatus(requestId, 'failed', {
        error_message: 'Failed to add to SABnzbd'
      });
      return;
    }

    // Update request with SABnzbd ID
    await BookRequest.updateStatus(requestId, 'downloading', {
      sabnzbd_id: sabnzbdId
    });

  } catch (error) {
    console.error('Error processing book request:', error);
    await BookRequest.updateStatus(requestId, 'failed', {
      error_message: error.message
    });
  }
}

// Search NZBHydra
async function searchNZBHydra(title, author) {
  try {
    const nzbhydraUrl = process.env.NZBHYDRA_URL;
    const apiKey = process.env.NZBHYDRA_API_KEY;

    if (!nzbhydraUrl || !apiKey) {
      console.error('NZBHydra configuration missing');
      return null;
    }

    let searchQuery = title;
    if (author) {
      searchQuery += ` ${author}`;
    }

    console.log(`Searching NZBHydra for: "${searchQuery}"`);

    const response = await axios.get(`${nzbhydraUrl}/api`, {
      params: {
        apikey: apiKey,
        t: 'search',
        q: searchQuery,
        cat: 7020,
        extended: 1,
        output: 'json'
      }
    });

    // Debug: log the actual response structure
    console.log('NZBHydra response structure:', JSON.stringify(response.data).substring(0, 500));

    // Handle different response formats from NZBHydra
    let results = [];
    
    if (response.data.results) {
      results = response.data.results;
    } else if (response.data.searchResults) {
      results = response.data.searchResults;
    } else if (Array.isArray(response.data)) {
      results = response.data;
    }
    
    console.log(`NZBHydra returned ${results.length} results`);

    // Map results to a consistent format with proper link extraction
    return results.map(result => {
      // Try different possible field names for the download link
      const downloadLink = result.link || result.guid || result.downloadUrl || result.url;
      
      return {
        title: result.title,
        link: typeof downloadLink === 'string' ? downloadLink : null,
        guid: result.guid,
        indexer: result.indexer || result.indexerName,
        size: result.size,
        category: result.category
      };
    }).filter(r => r.link); // Only return results that have a valid link

  } catch (error) {
    console.error('NZBHydra search error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data).substring(0, 500));
    }
    return null;
  }
}

// Send to SABnzbd - Downloads NZB content first, then sends to SABnzbd
async function sendToSABnzbd(nzbData) {
  try {
    const sabnzbdUrl = process.env.SABNZBD_URL;
    const apiKey = process.env.SABNZBD_API_KEY;
    const nzbhydraApiKey = process.env.NZBHYDRA_API_KEY;
    const nzbhydraUrl = process.env.NZBHYDRA_URL;

    if (!sabnzbdUrl || !apiKey) {
      console.error('SABnzbd configuration missing');
      return null;
    }

    let nzbLink = nzbData.link;
    
    // Ensure link is a string
    if (typeof nzbLink !== 'string') {
      console.error('Invalid NZB link type:', typeof nzbLink);
      console.error('NZB data:', JSON.stringify(nzbData));
      return null;
    }

    // If the link is relative, make it absolute with NZBHydra URL
    if (nzbLink.startsWith('/')) {
      nzbLink = `${nzbhydraUrl}${nzbLink}`;
    }
    
    console.log('Downloading NZB from:', nzbLink);

    // Download the NZB file content from NZBHydra
    const nzbResponse = await axios.get(nzbLink, {
      params: nzbhydraApiKey ? { apikey: nzbhydraApiKey } : {},
      responseType: 'arraybuffer',
      timeout: 30000
    });

    console.log(`Downloaded NZB (${nzbResponse.data.length} bytes)`);

    const nzbContent = Buffer.from(nzbResponse.data).toString('base64');
    const fileName = nzbData.title ? `${nzbData.title.replace(/[^a-z0-9]/gi, '_')}.nzb` : 'book.nzb';

    console.log(`Sending to SABnzbd as: ${fileName}`);

    // Send the NZB file content directly to SABnzbd using addfile mode
    const response = await axios.post(`${sabnzbdUrl}/api`, null, {
      params: {
        apikey: apiKey,
        mode: 'addfile',
        name: nzbContent,
        cat: 'books',
        output: 'json'
      },
      timeout: 30000
    });

    console.log('SABnzbd response:', JSON.stringify(response.data));

    if (response.data.status && response.data.nzo_ids && response.data.nzo_ids.length > 0) {
      console.log('Successfully added to SABnzbd:', response.data.nzo_ids[0]);
      return response.data.nzo_ids[0];
    }

    if (response.data.error) {
      console.error('SABnzbd returned error:', response.data.error);
    }

    return null;
  } catch (error) {
    console.error('SABnzbd error:', error.message);
    if (error.response) {
      console.error('SABnzbd response status:', error.response.status);
      console.error('SABnzbd response data:', JSON.stringify(error.response.data));
    }
    return null;
  }
}

module.exports.processBookRequest = processBookRequest;
