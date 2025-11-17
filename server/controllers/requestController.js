const BookRequest = require('../models/BookRequest');
const axios = require('axios');
const xml2js = require('xml2js');
const FormData = require('form-data');

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

// Search NZBHydra - Parse XML response
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

    // Use Newznab API (returns XML)
    const response = await axios.get(`${nzbhydraUrl}/api`, {
      params: {
        apikey: apiKey,
        t: 'search',
        q: searchQuery,
        cat: 7020, // eBooks
        extended: 1
      },
      timeout: 30000
    });

    console.log('NZBHydra returned XML, parsing...');

    // Parse XML to JavaScript object
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);

    // Navigate the XML structure
    if (!result.rss || !result.rss.channel || !result.rss.channel[0].item) {
      console.log('No items found in XML response');
      return [];
    }

    const items = result.rss.channel[0].item;
    console.log(`NZBHydra returned ${items.length} results`);

    // Map XML items to our format
    return items.map(item => {
      // Extract the link - it's in the <link> or <guid> tag
      const link = (item.link && item.link[0]) || (item.guid && item.guid[0]._) || (item.guid && item.guid[0]);
      const title = item.title && item.title[0];
      
      // Extract newznab attributes if present
      let size = null;
      let guid = null;
      
      if (item['newznab:attr']) {
        item['newznab:attr'].forEach(attr => {
          if (attr.$ && attr.$.name === 'size') {
            size = parseInt(attr.$.value);
          }
          if (attr.$ && attr.$.name === 'guid') {
            guid = attr.$.value;
          }
        });
      }

      return {
        title: title,
        link: link,
        guid: guid || link,
        size: size
      };
    }).filter(item => item.link); // Only return items with valid links

  } catch (error) {
    console.error('NZBHydra search error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', response.data.substring(0, 500));
    }
    return null;
  }
}

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
    
    if (typeof nzbLink !== 'string') {
      console.error('Invalid NZB link type:', typeof nzbLink);
      return null;
    }

    // If link doesn't have the apikey, add it
    if (nzbLink.includes(nzbhydraUrl) && !nzbLink.includes('apikey=')) {
      nzbLink += (nzbLink.includes('?') ? '&' : '?') + `apikey=${nzbhydraApiKey}`;
    }
    
    console.log('Downloading NZB from:', nzbLink);

    const nzbResponse = await axios.get(nzbLink, {
      responseType: 'arraybuffer',
      timeout: 30000
    });

    console.log(`Downloaded NZB (${nzbResponse.data.length} bytes)`);

    const fileName = nzbData.title ? `${nzbData.title.replace(/[^a-z0-9]/gi, '_')}.nzb` : 'book.nzb';

    console.log(`Sending to SABnzbd as: ${fileName}`);

    // Create form data with the NZB file
    const formData = new FormData();
    formData.append('name', Buffer.from(nzbResponse.data), {
      filename: fileName,
      contentType: 'application/x-nzb'
    });
    formData.append('apikey', apiKey);
    formData.append('mode', 'addfile');
    formData.append('cat', 'books');
    formData.append('output', 'json');

    // Send as multipart/form-data
    const response = await axios.post(`${sabnzbdUrl}/api`, formData, {
      headers: formData.getHeaders(),
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

    // Sometimes SABnzbd returns success in a different format
    if (response.data.nzo_ids && response.data.nzo_ids[0]) {
      console.log('Successfully added to SABnzbd (alternate format):', response.data.nzo_ids[0]);
      return response.data.nzo_ids[0];
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
