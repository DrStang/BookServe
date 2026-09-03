const BookRequest = require('../models/BookRequest');
const folderScanService = require('../services/folderScanService');
const axios = require('axios');
const xml2js = require('xml2js');
const FormData = require('form-data');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { finished } = require ('node:stream/promises');
const {chromium} = require("playwright-extra");
const fsPromises = fs.promises;

// ============================================================================
// SEARCH HELPER FUNCTIONS
// ============================================================================

/**
 * Simplify title by removing common additions that might interfere with search
 */
function simplifyTitle(title) {
    if (!title) return '';
    return title
        // Remove series info in parentheses: "Book Title (Series Name #1)"
        .replace(/\s*\([^)]*#?\d+[^)]*\)\s*$/i, '')
        // Remove series info after dash: "Book Title - Series Name Book 1"
        .replace(/\s*-\s*[^-]+,?\s*(Book|Vol|Volume|Part)\s*\d+\s*$/i, '')
        // Remove "A Novel", "A Thriller", etc.
        .replace(/\s*:\s*A\s+(Novel|Thriller|Mystery|Romance|Memoir|Story|Tale)\s*$/i, '')
        // Remove edition info
        .replace(/\s*\(.*edition.*\)\s*$/i, '')
        // Remove "Book 1", "Volume 1", etc. at end
        .replace(/\s*,?\s*(Book|Volume|Vol\.?|Part)\s*\d+\s*$/i, '')
        // Remove trailing articles in parentheses "(The)" or ", The"
        .replace(/\s*\((The|A|An)\)\s*$/i, '')
        .replace(/,\s*(The|A|An)\s*$/i, '')
        // Remove year in parentheses
        .replace(/\s*\(\d{4}\)\s*$/i, '')
        .trim();
}

/**
 * Get author's last name for broader searches
 */
function getLastName(author) {
    if (!author) return '';
    // Handle "Last, First" format
    if (author.includes(',')) {
        return author.split(',')[0].trim();
    }
    // Handle "First Last" format
    const parts = author.trim().split(/\s+/);
    return parts[parts.length - 1];
}

/**
 * Get author's first name
 */
function getFirstName(author) {
    if (!author) return '';
    if (author.includes(',')) {
        const parts = author.split(',');
        return parts[1]?.trim().split(/\s+/)[0] || '';
    }
    return author.trim().split(/\s+/)[0] || '';
}

/**
 * Normalize text for comparison - removes special chars, normalizes unicode
 */
function normalizeText(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        // Normalize unicode quotes and dashes
        .replace(/[''`]/g, "'")
        .replace(/[""]/g, '"')
        .replace(/[—–−]/g, '-')
        // Remove possessives
        .replace(/'s\b/g, '')
        // Remove special characters but keep spaces
        .replace(/[^a-z0-9\s]/g, '')
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim();
}

function isExactTitleMatch(searchTitle, itemTitle) {
    if (!searchTitle || !itemTitle) return false;

    const escaped = searchTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const regex = new RegExp(`\\b${escaped}\\b`);
    return regex.test(itemTitle);
}

function containsWholeWord(text, word) {
    if (!text || !word) return false;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`);
    return regex.test(text);
}

function calculateStrictWordMatch(titleWords, itemTitle) {
    if (!titleWords.length) return { ratio: 0, matched: [], unmatched: [] };

    const significantWords = titleWords.filter(w => w.length >=3);
    const wordsToCheck = significantWords.length > 0 ? significantWords : titleWords;

    const matched = [];
    const unmatched = [];

    for (const word of wordsToCheck) {
        if (containsWholeWord(itemTitle, word)) {
            matched.push(word);
        } else {
            unmatched.push(word);
        }
    }
    return {
        ratio: matched.length / wordsToCheck.length,
        matched,
        unmatched
    };
}

/**
 * Calculate word match ratio between search title and result
 */
function calculateWordMatchRatio(searchTitle, resultTitle) {
    const searchWords = normalizeText(searchTitle).split(' ').filter(w => w.length >= 3);
    const resultNormalized = normalizeText(resultTitle);

    if (searchWords.length === 0) return 0;

    const matchedWords = searchWords.filter(word => resultNormalized.includes(word));
    return matchedWords.length / searchWords.length;
}

/**
 * Check if result appears to be an audiobook
 */
function isAudiobook(title) {
    return /audiobook|audio\s*book|mp3|m4b|audible|narrated\s+by|unabridged\s+audio/i.test(title);
}

/**
 * Check if result appears to be a bundle/collection
 */
function isBundle(title) {
    return /complete\s+(series|collection|works)|box\s*set|anthology|omnibus|books?\s+\d+\s*-\s*\d+|\d+\s+books?\s+in\s+one/i.test(title);
}

/**
 * Detect ebook format from title
 */
function detectFormat(title) {
    const lower = title.toLowerCase();
    if (lower.includes('epub')) return 'epub';
    if (lower.includes('mobi')) return 'mobi';
    if (lower.includes('azw3')) return 'azw3';
    if (lower.includes('azw')) return 'azw';
    if (lower.includes('pdf')) return 'pdf';
    return 'unknown';
}

// ============================================================================
// FAILED SEARCH LOGGING
// ============================================================================

/**
 * Log failed searches for analysis (helps identify patterns)
 */
async function logFailedSearch(requestId, title, author, isbn, strategies, reason) {
    const { db } = require('../database/init');

    // Create table if it doesn't exist
    await new Promise((resolve, reject) => {
        db.run(`
      CREATE TABLE IF NOT EXISTS search_failures (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER,
        title TEXT,
        author TEXT,
        isbn TEXT,
        strategies_tried TEXT,
        failure_reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO search_failures (request_id, title, author, isbn, strategies_tried, failure_reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
            [requestId, title, author, isbn, JSON.stringify(strategies), reason],
            (err) => {
                if (err) {
                    console.error('Failed to log search failure:', err);
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
}

/**
 * Get search failure statistics (for admin dashboard)
 */
async function getSearchFailureStats() {
    const { db } = require('../database/init');

    return new Promise((resolve, reject) => {
        db.all(`
      SELECT 
        failure_reason,
        COUNT(*) as count,
        GROUP_CONCAT(title, ' | ') as sample_titles
      FROM search_failures
      WHERE created_at > datetime('now', '-30 days')
      GROUP BY failure_reason
      ORDER BY count DESC
    `, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

// ============================================================================
// MAIN SEARCH FUNCTIONS
// ============================================================================

/**
 * Execute a single search against NZBHydra
 */
async function executeNZBHydraSearch(nzbhydraUrl, apiKey, searchQuery, categories = '7020,7040,7050') {
    const response = await axios.get(`${nzbhydraUrl}/api`, {
        params: {
            apikey: apiKey,
            t: 'search',
            q: searchQuery,
            cat: categories,
            extended: 1,
            limit: 100
        },
        timeout: 30000
    });

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(response.data);

    if (!result.rss?.channel?.[0]?.item) {
        return [];
    }

    return result.rss.channel[0].item;
}

/**
 * Score search results based on relevance to the original query
 */
function scoreSearchResults(items, originalTitle, originalAuthor, originalIsbn) {
    const normalizedTitle = normalizeText(originalTitle);
    const simplifiedTitle = normalizeText(simplifyTitle(originalTitle));
    const normalizedAuthor = normalizeText(originalAuthor);
    const authorLastName = normalizeText(getLastName(originalAuthor));
    const authorFirstName = normalizeText(getFirstName(originalAuthor));

    // Pre-compute title words for word-boundary matching
    const titleWords = normalizedTitle.split(' ').filter(w => w.length >= 2);

    return items.map(item => {
        const itemTitle = item.title?.[0] || '';
        const normalizedItemTitle = normalizeText(itemTitle);
        const link = item.link?.[0] || item.guid?.[0]?._ || item.guid?.[0];

        // Extract size from newznab attributes
        let size = null;
        if (item['newznab:attr']) {
            const sizeAttr = item['newznab:attr'].find(attr => attr.$?.name === 'size');
            if (sizeAttr) {
                size = parseInt(sizeAttr.$.value);
            }
        }

        let relevanceScore = 0;
        let matchDetails = [];
        let titleScore = 0;
        let authorScore = 0;

        // ========== TITLE MATCHING (stricter word-boundary checks) ==========

        // Check for EXACT title match using word boundaries
        // This prevents "the vigil" from matching "the vigilante"
        if (isExactTitleMatch(normalizedTitle, normalizedItemTitle)) {
            titleScore = 100;
            matchDetails.push('exact_title');
        }
        // Simplified title with word-boundary check
        else if (simplifiedTitle && isExactTitleMatch(simplifiedTitle, normalizedItemTitle)) {
            titleScore = 80;
            matchDetails.push('simplified_title');
        }
        // Word-based matching (strict: ALL significant words must match as whole words)
        else {
            const wordMatchResult = calculateStrictWordMatch(titleWords, normalizedItemTitle);
            if (wordMatchResult.ratio >= 1.0) {
                // All words matched as whole words
                titleScore = 70;
                matchDetails.push('all_words_match');
            } else if (wordMatchResult.ratio >= 0.8) {
                titleScore = 50;
                matchDetails.push('high_word_match');
            } else if (wordMatchResult.ratio >= 0.6) {
                titleScore = 30;
                matchDetails.push('medium_word_match');
            } else if (wordMatchResult.ratio >= 0.4) {
                titleScore = 15;
                matchDetails.push('low_word_match');
            }
            // else titleScore stays 0 - very poor match
        }

        // ========== AUTHOR MATCHING ==========

        if (normalizedAuthor) {
            // Full author name match
            if (normalizedItemTitle.includes(normalizedAuthor)) {
                authorScore = 40;
                matchDetails.push('full_author');
            }
            // Last name + first name
            else if (authorLastName && containsWholeWord(normalizedItemTitle, authorLastName)) {
                if (authorFirstName && containsWholeWord(normalizedItemTitle, authorFirstName)) {
                    authorScore = 35;
                    matchDetails.push('author_first_last');
                } else {
                    authorScore = 25;
                    matchDetails.push('author_lastname');
                }
            }

            // PENALTY: If we have an author to match against but found NO author match,
            // apply a significant penalty. This is the key fix for wrong-author downloads.
            if (authorScore === 0) {
                titleScore = Math.floor(titleScore * 0.4); // Slash title score by 60%
                matchDetails.push('no_author_match_penalty');
            }
        }

        relevanceScore = titleScore + authorScore;

        // ========== ISBN MATCHING (DEFINITIVE - overrides everything) ==========

        if (originalIsbn) {
            const cleanIsbn = originalIsbn.replace(/[^0-9X]/gi, '');
            if (normalizedItemTitle.includes(cleanIsbn) || itemTitle.includes(originalIsbn)) {
                relevanceScore = 200; // ISBN match is definitive, override other scoring
                matchDetails.push('isbn_match');
            }
        }

        // ========== FORMAT BONUSES ==========

        const format = detectFormat(itemTitle);
        if (format === 'epub') {
            relevanceScore += 15;
            matchDetails.push('epub');
        } else if (format === 'mobi' || format === 'azw' || format === 'azw3') {
            relevanceScore += 10;
            matchDetails.push(format);
        } else if (format === 'pdf') {
            relevanceScore += 5;
            matchDetails.push('pdf');
        }

        // ========== PENALTIES ==========

        // Audiobooks (we want ebooks)
        if (isAudiobook(itemTitle)) {
            relevanceScore -= 100;
            matchDetails.push('audiobook_penalty');
        }

        // Bundles/collections (usually not what user wants)
        if (isBundle(itemTitle)) {
            relevanceScore -= 30;
            matchDetails.push('bundle_penalty');
        }

        // Very long titles (often spam or bundles)
        if (itemTitle.length > 200) {
            relevanceScore -= 25;
            matchDetails.push('long_title_penalty');
        }

        // Foreign language indicators (unless original title has them)
        if (/\b(german|deutsch|french|français|spanish|español|italian|italiano|portuguese|português)\b/i.test(itemTitle) &&
            !/\b(german|deutsch|french|français|spanish|español|italian|italiano|portuguese|português)\b/i.test(originalTitle)) {
            relevanceScore -= 20;
            matchDetails.push('foreign_language_penalty');
        }

        // ========== SIZE-BASED HEURISTICS ==========

        if (size) {
            if (size < 100000) { // Less than 100KB
                relevanceScore -= 20;
                matchDetails.push('too_small');
            } else if (size > 50000000) { // More than 50MB
                relevanceScore -= 15;
                matchDetails.push('very_large');
            } else if (size >= 500000 && size <= 10000000) { // 500KB - 10MB sweet spot
                relevanceScore += 5;
                matchDetails.push('good_size');
            }
        }

        return {
            title: itemTitle,
            link: link,
            guid: item.guid?.[0]?._ || item.guid?.[0] || link,
            size: size,
            relevanceScore: Math.max(0, relevanceScore),
            titleScore: titleScore,
            authorScore: authorScore,
            matchDetails: matchDetails,
            format: format,
            isEpub: format === 'epub',
            isEbook: ['epub', 'mobi', 'azw', 'azw3', 'pdf'].includes(format),
            isAudiobook: isAudiobook(itemTitle),
            isBundle: isBundle(itemTitle)
        };
    }).filter(item => item.link && !item.isAudiobook);
}


/**
 * Main search function with multiple strategies
 */
async function searchNZBHydra(title, author, isbn = null, requestId = null) {
    try {
        const nzbhydraUrl = process.env.NZBHYDRA_URL;
        const apiKey = process.env.NZBHYDRA_API_KEY;

        if (!nzbhydraUrl || !apiKey) {
            console.error('NZBHydra configuration missing');
            return null;
        }

        const strategiesAttempted = [];
        const minScoreThreshold = 70; // Minimum score to consider a result valid

        // ========== STRATEGY 0: ISBN SEARCH (Most reliable) ==========
        if (isbn) {
            const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
            if (cleanIsbn.length >= 10) {
                console.log(`[Search] Strategy 0 - ISBN: "${cleanIsbn}"`);
                strategiesAttempted.push({ strategy: 'isbn', query: cleanIsbn });

                try {
                    const items = await executeNZBHydraSearch(nzbhydraUrl, apiKey, cleanIsbn);
                    if (items.length > 0) {
                        const scored = scoreSearchResults(items, title, author, isbn);
                        const goodResults = scored.filter(r => r.relevanceScore >= minScoreThreshold);
                        if (goodResults.length > 0) {
                            console.log(`[Search] ✓ Found ${goodResults.length} results via ISBN`);
                            return goodResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
                        }
                    }
                } catch (err) {
                    console.error('[Search] ISBN search failed:', err.message);
                }
            }
        }

        // ========== STRATEGY 1: Title + Full Author ==========
        const strategy1Query = `${title} ${author || ''}`.trim();
        console.log(`[Search] Strategy 1 - Title+Author: "${strategy1Query}"`);
        strategiesAttempted.push({ strategy: 'title_author', query: strategy1Query });

        try {
            const items1 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, strategy1Query);
            if (items1.length > 0) {
                const scored1 = scoreSearchResults(items1, title, author, isbn);
                const goodResults1 = scored1.filter(r => r.relevanceScore >= minScoreThreshold);
                if (goodResults1.length > 0) {
                    console.log(`[Search] ✓ Found ${goodResults1.length} results via title+author`);
                    return goodResults1.sort((a, b) => b.relevanceScore - a.relevanceScore);
                }
            }
        } catch (err) {
            console.error('[Search] Strategy 1 failed:', err.message);
        }

        // ========== STRATEGY 2: Title Only ==========
        console.log(`[Search] Strategy 2 - Title only: "${title}"`);
        strategiesAttempted.push({ strategy: 'title_only', query: title });

        try {
            const items2 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, title);
            if (items2.length > 0) {
                const scored2 = scoreSearchResults(items2, title, author, isbn);
                const goodResults2 = scored2.filter(r => r.relevanceScore >= minScoreThreshold);
                if (goodResults2.length > 0) {
                    console.log(`[Search] ✓ Found ${goodResults2.length} results via title only`);
                    return goodResults2.sort((a, b) => b.relevanceScore - a.relevanceScore);
                }
            }
        } catch (err) {
            console.error('[Search] Strategy 2 failed:', err.message);
        }

        // ========== STRATEGY 3: Simplified Title ==========
        const simplified = simplifyTitle(title);
        if (simplified && simplified !== title && simplified.length >= 3) {
            console.log(`[Search] Strategy 3 - Simplified title: "${simplified}"`);
            strategiesAttempted.push({ strategy: 'simplified_title', query: simplified });

            try {
                const items3 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, simplified);
                if (items3.length > 0) {
                    const scored3 = scoreSearchResults(items3, title, author, isbn);
                    const goodResults3 = scored3.filter(r => r.relevanceScore >= minScoreThreshold);
                    if (goodResults3.length > 0) {
                        console.log(`[Search] ✓ Found ${goodResults3.length} results via simplified title`);
                        return goodResults3.sort((a, b) => b.relevanceScore - a.relevanceScore);
                    }
                }
            } catch (err) {
                console.error('[Search] Strategy 3 failed:', err.message);
            }
        }

        // ========== STRATEGY 4: Title + Author Last Name ==========
        const lastName = getLastName(author);
        if (lastName) {
            const strategy4Query = `${title} ${lastName}`;
            console.log(`[Search] Strategy 4 - Title + lastname: "${strategy4Query}"`);
            strategiesAttempted.push({ strategy: 'title_lastname', query: strategy4Query });

            try {
                const items4 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, strategy4Query);
                if (items4.length > 0) {
                    const scored4 = scoreSearchResults(items4, title, author, isbn);
                    const goodResults4 = scored4.filter(r => r.relevanceScore >= minScoreThreshold);
                    if (goodResults4.length > 0) {
                        console.log(`[Search] ✓ Found ${goodResults4.length} results via title+lastname`);
                        return goodResults4.sort((a, b) => b.relevanceScore - a.relevanceScore);
                    }
                }
            } catch (err) {
                console.error('[Search] Strategy 4 failed:', err.message);
            }
        }

        // ========== STRATEGY 5: Simplified Title + Author Last Name ==========
        if (simplified && simplified !== title && lastName) {
            const strategy5Query = `${simplified} ${lastName}`;
            console.log(`[Search] Strategy 5 - Simplified + lastname: "${strategy5Query}"`);
            strategiesAttempted.push({ strategy: 'simplified_lastname', query: strategy5Query });

            try {
                const items5 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, strategy5Query);
                if (items5.length > 0) {
                    const scored5 = scoreSearchResults(items5, title, author, isbn);
                    const goodResults5 = scored5.filter(r => r.relevanceScore >= minScoreThreshold);
                    if (goodResults5.length > 0) {
                        console.log(`[Search] ✓ Found ${goodResults5.length} results via simplified+lastname`);
                        return goodResults5.sort((a, b) => b.relevanceScore - a.relevanceScore);
                    }
                }
            } catch (err) {
                console.error('[Search] Strategy 5 failed:', err.message);
            }
        }

        // ========== STRATEGY 6: Title + "epub" keyword ==========
        const strategy6Query = `${title} epub`;
        console.log(`[Search] Strategy 6 - Title + epub: "${strategy6Query}"`);
        strategiesAttempted.push({ strategy: 'title_epub', query: strategy6Query });

        try {
            const items6 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, strategy6Query);
            if (items6.length > 0) {
                const scored6 = scoreSearchResults(items6, title, author, isbn);
                const goodResults6 = scored6.filter(r => r.relevanceScore >= minScoreThreshold);
                if (goodResults6.length > 0) {
                    console.log(`[Search] ✓ Found ${goodResults6.length} results via title+epub`);
                    return goodResults6.sort((a, b) => b.relevanceScore - a.relevanceScore);
                }
            }
        } catch (err) {
            console.error('[Search] Strategy 6 failed:', err.message);
        }

        // ========== STRATEGY 7: Broader category search ==========
        // Try searching in ALL categories (not just ebooks) as a last resort
        console.log(`[Search] Strategy 7 - All categories: "${title}"`);
        strategiesAttempted.push({ strategy: 'all_categories', query: title });

        try {
            const items7 = await executeNZBHydraSearch(nzbhydraUrl, apiKey, title, ''); // Empty = all categories
            if (items7.length > 0) {
                const scored7 = scoreSearchResults(items7, title, author, isbn);
                // Higher threshold for non-ebook categories
                const goodResults7 = scored7.filter(r => r.relevanceScore >= 60 && r.isEbook);
                if (goodResults7.length > 0) {
                    console.log(`[Search] ✓ Found ${goodResults7.length} results via all categories`);
                    return goodResults7.sort((a, b) => b.relevanceScore - a.relevanceScore);
                }
            }
        } catch (err) {
            console.error('[Search] Strategy 7 failed:', err.message);
        }

        // ========== NO RESULTS FOUND ==========
        console.log(`[Search] ✗ No results found after ${strategiesAttempted.length} strategies`);

        // Log the failure for analysis
        try {
            await logFailedSearch(requestId, title, author, isbn, strategiesAttempted, 'no_results');
        } catch (logErr) {
            console.error('[Search] Failed to log search failure:', logErr.message);
        }

        return [];

    } catch (error) {
        console.error('NZBHydra search error:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
        }
        return null;
    }
}

// ============================================================================
// SABNZBD FUNCTIONS
// ============================================================================

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

// ============================================================================
// ANNAS ARCHIVE
// ============================================================================
async function getAAFilename(response, url, maxLength = 40) {
    let rawName = '';
    const disposition = response.headers['content-disposition'];

    if (disposition && disposition.includes('filename=')) {
        rawName = disposition.split('filename=')[1].replace(/["']/g, "").split(';')[0].trim();
    } else{
        rawName = path.basename(new URL(url).pathname);
    }
    let cleanName = decodeURIComponent(rawName);

    cleanName = cleanName.replace(/[^a-z0-9. \-_]/gi, '_');

    const ext = path.extname(cleanName);
    const base = path.basename(cleanName, ext);

    const shortenedBase = base.substring(0, maxLength);

    return `${shortenedBase}${ext}`;

}

function buildSearchUrl(q) {
    return `https://annas-archive.pk/search?${new URLSearchParams({ q: String(q).trim() }).toString()}`;
}

function isNoResults(html) {
    return(
        /no files found/i.test(html)
    )
}
async function searchAnna({ isbn, title, author }) {
    const queries = [];

    if (isbn) queries.push(String(isbn));
    const titleAuthor = `${title ?? ""} ${author ?? ""}`.replace(/\s+/g, " ").trim();
    if (titleAuthor) queries.push(titleAuthor);

    if (queries.length === 0) throw new Error("Need isbn or title/author");

    let lastErr;

    for (const q of queries) {
        const url = buildSearchUrl(q);

        try {
            const res = await axios.get(url, {
                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
                    Accept: "text/html,*/*",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                timeout: 30000,
            });
            if (isNoResults(res.data)) {
                lastErr = new Error(`No results for query: ${q}`);
                continue;
            }

            return { url, html: res.data, usedQuery: q };
        } catch (error) {
            lastErr = error;
        }
    }

    throw lastErr ?? new Error("AA search failed")
}

async function scrapeAnna(isbn, title, author){
    const { url, html, usedQuery } = await searchAnna({isbn, title, author });
    console.log("AA Used:", usedQuery, "URL:", url );

    try {
        // Fetch the search results page
        const $ = cheerio.load(html);

        // Parse and extract relevant links
        const href = $("a[href^='/md5/']").first().attr('href');
        if (!href) return null;

        const m = href.match(/^\/md5\/([a-f0-9]{32})\b/i);
        return m ? m[1].toLowerCase() : null;


    } catch (error) {
        console.error('Error searching AA:', error.message, error.response ? error.response.status : '');
        return null;
    }
}

async function getAABook(isbn, title, author) {
    try {
        const md5 = await scrapeAnna(isbn, title, author);
        if (!md5) return null;

        const API = process.env.ANNA_API;
        const url = `https://annas-archive.pk/dyn/api/fast_download.json?md5=${md5}&key=${API}`;



        const response = await fetch(url)
        if (!response){
            console.error('Failed to get book link:', response);
            return null;
        }

        const json = await response.json()

        const downloadLink = json.download_url;

        if (!downloadLink) {
            console.error('Failed to parse AA JSON:', response);
            return null;
        }

        const dlresponse = await axios({
            method: 'GET',
            url: downloadLink,
            responseType: 'stream'
        })
        const filename = await getAAFilename(dlresponse, downloadLink);
        const filePath = path.resolve(process.env.BOOKS_STORAGE_PATH, filename);
        const writer = fs.createWriteStream(filePath);

        dlresponse.data.pipe(writer);

        await finished(writer);

        const confirmed = await confirmAADownload(filename);

        if(!confirmed){
            console.error('AA download confirmation failed');
            return null;
        }

        return filePath;

    } catch (error) {
        console.error('[AA]Error downloading book:', error.message);
        return null;
    }
}
async function confirmAADownload(filename){
    const fileSource = path.join(process.env.BOOKS_STORAGE_PATH, filename);
    try {
        await fsPromises.access(fileSource);
        const stats = await fsPromises.stat(fileSource);
        if (stats.size > 0) {
            console.log(`Book successfully downloaded through Annas Archive`);
            return true;
        }
        console.error(`Book download failed`);
        return false;
    }catch(err) {
        return false;
    }
}

// ============================================================================
// SEARCH ARCHIVE
// ============================================================================

async function searchArchive(title, author) {
    let searchTerm = `${title} - ${author}`;
    let baseDir = '/mnt/storedbooks';
    let destDir = '/mnt/books';
    try {
        const allRelativePaths = fs.readdirSync(baseDir, { recursive: true, withFileTypes: true });
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matches = [];

        for (const entry of allRelativePaths) {
            if (entry.isFile() && entry.name.toLowerCase().includes(lowerSearchTerm)) {
                const fullPath = path.join(entry.parentPath ||baseDir, entry.name);
                matches.push({ fullPath, name: entry.name });

                }
            }
        if (matches.length === 0) {
            console.log(`(Search Archive) No Files found matching "${searchTerm}".`);
            return;
        }

        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
            console.log(`Created directory: ${destDir} to store the results of the search in the "books" directory (if it doesn't already exist)`);
        }
        console.log(`(Search Archive) Found ${matches.length} file(s). Starting copy...`);

        matches.forEach(file => {
            const destinationPath = path.join(destDir, file.name);

            fs.copyFileSync(file.fullPath, destinationPath);
            console.log(`Successfully copied: ${file.name} -> ${destDir}`);
        });
        console.log(`(Search Archive) All Files processed`);

    } catch (error) {
        console.error(`(Search Archive) Error while copying files: ${error.message}`);
    }
}

// ============================================================================
// OCEAN OF PDF
// ============================================================================

const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function searchOceanOfPDF(title, author, isbn) {
    const browser = await chromium.launch({ headless: true, proxy: {"server": 'http://155.138.227.76:3128'} });

    try {
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
        });
        const page = await context.newPage();
        // Construct search query URL
        const params = new URLSearchParams();

        if (isbn){
            params.set('s', isbn);
            const isbnurl = `https://oceanofpdf.com/?${params.toString()}`;
            console.log('Ocean directed to:', isbnurl);

            await page.goto(isbnurl, { waitUntil: "domcontentloaded", timeout: 60000 });



            // Parse and extract relevant links
            let linkLocator = page.locator('a.entry-image-link');
            if (await linkLocator.count() === 0) {
                linkLocator = page.locator('a.gs-title');
            }
            if (await linkLocator.count() > 0) {
                const href = await linkLocator.first().getAttribute('href');

                if (href) {
                    console.log("Found Ocean Page URL:", href);
                    return href;
                } else {
                    console.error("Link never appeared");
                    return null;
                }

            } else {
                console.log("[OCEAN] No search results found with ISBN. Falling back to title/author search.");
            }
        }
        params.set('s', `${title} ${author}`);


        const url = `https://oceanofpdf.com/?${params.toString()}`;
        console.log('Ocean directed to:', url);

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

        // Parse and extract relevant links
        let linkLocator = page.locator('a.entry-image-link');
        if (await linkLocator.count() === 0) {
            linkLocator = page.locator('a.gs-title');
        }

        const href = await linkLocator.first().getAttribute('href');

        if (href) {
            console.log("Found Ocean Page URL:", href);
        } else {
            console.error("Link never appeared");
            return null;
        }

        return href;


    } catch (error) {
        console.error('Error searching OceanOfPDF:', error.message, error.response ? error.response.status : '');
        return null;
    } finally {
        await browser.close();
    }
}
async function getOcean(title, author, isbn) {
    const bookUrl = await searchOceanOfPDF(title, author, isbn);
    if (!bookUrl) {
        console.log('No Ocean Book URL found.');
        return null;
    }
    console.log(`Found ${bookUrl}`);
    const browser = await chromium.launch({ headless: true , proxy: {"server": 'http://155.138.227.76:3128'}});
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    });
    const page = await context.newPage();


    try {

        await page.goto(bookUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

        //const pagePromise = context.waitForEvent('page');

        const epubBtn = page.locator('input[type="image"][src*="epub-button.jpg"]').first();
        const pdfBtn  = page.locator('input[type="image"][src*="pdf-button.jpg"]').first();

        let btnToClick = null;

        if (await epubBtn.count()) {
            btnToClick = epubBtn;
        } else if (await pdfBtn.count()) {
            btnToClick = pdfBtn;
        } else {
            console.error("[OCEAN] No EPUB or PDF button found");

            await page.screenshot({ path: "debug.png", fullPage: true });
            return null;
        }

// IMPORTANT: wait for the popup from THIS click
        const [newTab] = await Promise.all([
            page.waitForEvent("popup", { timeout: 60000 }),
            btnToClick.click({ timeout: 60000 })   // use click, not dispatchEvent
        ]);

        await newTab.waitForLoadState("domcontentloaded");

        //const newTab = await pagePromise;
        //await newTab.waitForLoadState();


        await newTab.waitForSelector('meta[http-equiv="Refresh"]', { state: 'attached' });
        const content = await newTab.getAttribute('meta[http-equiv="Refresh"]', 'content');


        const match = content.match(/url=(.+)$/i);
        //console.log(match);
        const targetUrl = match ? match[1] : null;


        if (!targetUrl) {
            console.log('[OCEAN] No download target URL found');
            return null;
        }

        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
                Accept: "text/html,*/*",
                "Accept-Language": "en-US,en;q=0.9",
            }
        });

        const filename = await getAAFilename(response, targetUrl);
        console.log(`[OCEAN] Found ${filename}`);
        const filePath = path.resolve(process.env.BOOKS_STORAGE_PATH, filename);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        await finished(writer);

        const confirmed = await confirmOceanDownload(filename);

        if(!confirmed){
            console.error('[OCEAN] Download confirmation failed');
            return null;
        }

        return filePath;



    } catch (error) {
        console.error('[OCEAN] Error fetching book :', error.message);
        return null;
    } finally {
        await browser.close();
    }
}
async function confirmOceanDownload(filename){
    const fileSource = path.join(process.env.BOOKS_STORAGE_PATH, filename);
    try {
        await fsPromises.access(fileSource);
        const stats = await fsPromises.stat(fileSource);
        if (stats.size > 0) {
            console.log(`Book successfully downloaded through Ocean`);
            return true;
        }
        console.error(`[OCEAN] Book download failed`);
        return false;
    }catch(err) {
        return false;
    }
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

// Search GoogleBooks
exports.searchBooks = async (req, res) => {
    try {
        const { q, author, title } = req.query;

        if (!q && !title) {
            return res.status(400).json({ error: 'Search query or title required' });
        }

        const googleBooksService = require('../services/googleBooksService');

        let searchQuery = q || '';
        if (!q && title) {
            searchQuery = title;
            if (author) searchQuery += ` by ${author}`;
        }

        const results = await googleBooksService.search(searchQuery, 20);

        const books = results.filter(r => r !== null).map(book => ({
            key: book.google_books_id,
            google_books_id: book.google_books_id,
            title: book.title,
            subtitle: book.subtitle || null,
            author: book.author || 'Unknown',
            publisher: book.publisher || null,
            published_date: book.published_date || null,
            description: book.description || null,
            isbn: book.isbn || null,
            isbn_13: book.isbn_13 || null,
            page_count: book.page_count || null,
            categories: book.categories || null,
            average_rating: book.average_rating || null,
            ratings_count: book.ratings_count || null,
            language: book.language || null,
            cover_url: book.cover_image_url || book.thumbnail || null,
            thumbnail: book.thumbnail || book.small_thumbnail || null,
            preview_link: book.preview_link || null,
            info_link: book.info_link || null,
        }));

        res.json({ books, total: books.length });
    } catch (error) {
        console.error('Google Books search error:', error);
        res.status(500).json({ error: 'Error searching for books' });
    }
};

exports.searchOpenLibrary = exports.searchBooks;

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

// Get all requests (admin only) - includes user info
exports.getAllRequests = async (req, res) => {
    try {
        const { limit = 100, offset = 0, status } = req.query;
        const requests = await BookRequest.findAll(parseInt(limit), parseInt(offset), status);

        res.json({ requests });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Error fetching requests' });
    }
};

// Get user's own requests only
exports.getUserRequests = async (req, res) => {
    try {
        const requests = await BookRequest.findByUserId(req.user.id);
        res.json({ requests });
    } catch (error) {
        console.error('Error fetching user requests:', error);
        res.status(500).json({ error: 'Error fetching requests' });
    }
};

// Get request by ID (user can only see own, admin can see all)
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

// Delete/cancel a request
exports.deleteRequest = async (req, res) => {
    try {
        const request = await BookRequest.findById(req.params.id);

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Admin can delete any request
        // Regular users can only delete their own pending requests
        if (req.user.role !== 'admin') {
            if (request.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Access denied' });
            }
            if (!['pending', 'failed'].includes(request.status)) {
                return res.status(400).json({ error: 'Can only cancel pending or failed requests' });
            }
        }

        await BookRequest.delete(req.params.id);
        res.json({ message: 'Request deleted successfully' });
    } catch (error) {
        console.error('Error deleting request:', error);
        res.status(500).json({ error: 'Error deleting request' });
    }
};

// Manual retry with custom search terms (admin or request owner)
exports.retryWithCustomSearch = async (req, res) => {
    try {
        const { id } = req.params;
        const { customTitle, customAuthor, customIsbn } = req.body;

        const request = await BookRequest.findById(id);

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        // Check permissions
        if (request.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Use custom search terms or fall back to original
        const searchTitle = customTitle || request.title;
        const searchAuthor = customAuthor || request.author;
        const searchIsbn = customIsbn || request.isbn;

        console.log(`[Manual Retry] Searching with: title="${searchTitle}", author="${searchAuthor}", isbn="${searchIsbn}"`);

        // Update status to searching
        await BookRequest.updateStatus(id, 'searching');

        const anna = await getAABook(searchIsbn, searchTitle, searchAuthor);

        const ocean = await getOcean(searchTitle, searchAuthor, searchIsbn);

        if (anna) {
            console.log(`[Manual Retry] Downloading through AA for request ${id}`);
            await BookRequest.updateStatus(id, 'completed');
            await folderScanService.triggerScan();
        } else if (ocean) {
            console.log(`[Manual Retry] AA failed, downloading through Ocean for request ${id}`);
            await BookRequest.updateStatus(id, 'completed');
            await folderScanService.triggerScan();
        } else {
            console.log('[Manual Retry] Ocean failed, trying NZB');

            const nzbResults = await searchNZBHydra(searchTitle, searchAuthor, searchIsbn, id);

            if (!nzbResults || nzbResults.length === 0) {
                await BookRequest.updateStatus(id, 'failed', {
                    error_message: `Manual retry: No results found for "${searchTitle}"`
                });
                return res.json({
                    success: false,
                    message: 'No results found with custom search terms',
                    searchTerms: { title: searchTitle, author: searchAuthor, isbn: searchIsbn }
                });
            }


            // Get the best result
            const bestResult = nzbResults[0];
            console.log(`[Manual Retry] Best result: "${bestResult.title}" (score: ${bestResult.relevanceScore})`);

            // Send to SABnzbd
            const sabnzbdId = await sendToSABnzbd(bestResult);

            if (!sabnzbdId) {
                await BookRequest.updateStatus(id, 'failed', {
                    error_message: 'Failed to add to SABnzbd'
                });
                return res.json({
                    success: false,
                    message: 'Found book but failed to add to SABnzbd',
                    searchResult: { title: bestResult.title, score: bestResult.relevanceScore }
                });
            }

            // Update request with SABnzbd ID
            await BookRequest.updateStatus(id, 'downloading', {
                sabnzbd_id: sabnzbdId
            });

        }



        res.json({
            success: true,
            message: 'Book found and queued for download',
            searchResult: {
                title: searchTitle,
            }
        });

    } catch (error) {
        console.error('Error in manual retry:', error);
        res.status(500).json({ error: 'Error processing manual retry' });
    }
};

// Get search failure statistics (admin only)
exports.getSearchFailureStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const stats = await getSearchFailureStats();
        res.json({ stats });
    } catch (error) {
        console.error('Error fetching search failure stats:', error);
        res.status(500).json({ error: 'Error fetching statistics' });
    }
};

// Get request statistics (admin only)
exports.getRequestStats = async (req, res) => {
    try {
        const stats = await BookRequest.getStats();
        res.json(stats);
    } catch (error) {
        console.error('Error fetching request stats:', error);
        res.status(500).json({ error: 'Error fetching request statistics' });
    }
};
// ============================================================================
// MARK AS FULFILLED (Admin manually added book)
// ============================================================================

exports.markAsFulfilled = async (req, res) => {
    try {
        const { id } = req.params;
        const { bookId, notes } = req.body;

        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const request = await BookRequest.findById(id);

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status !== 'failed') {
            return res.status(400).json({
                error: 'Can only mark failed requests as fulfilled',
                currentStatus: request.status
            });
        }

        const additionalData = {
            error_message: null,
            fulfilled_manually: 1,
            fulfilled_notes: notes || 'Manually added by admin',
        };

        if (bookId && !isNaN(parseInt(bookId))) {
            additionalData.fulfilled_book_id = parseInt(bookId);
        }

        await BookRequest.updateStatus(id, 'completed', additionalData);

        await BookRequest.resetRetryStatus(id);

        console.log(`[Fulfilled] Request ${id} marked as fulfilled by admin ${req.user.username}`);

        await sendFulfilledNotification(request, bookId);

        res.json({
            success: true,
            message: 'Request marked as fulfilled',
            request: {
                id: request.id,
                title: request.title,
                author: request.author,
                status: 'completed',
                linkedBookId: bookId || null
            }
        });
    } catch (error) {
        console.error('Error marking request as fulfilled:', error);
        res.status(500).json({ error: 'Error marking request as fulfilled'});
    }
};

async function sendFulfilledNotification(request, linkedBookId = null) {
    try {
        const { db } = require('../database/init');

        const user = await new Promise((resolve, reject) => {
            db.get(
                'SELECT email, username, email_notifications FROM users WHERE id = ?',
                [request.user_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!user) {
            console.log(`[Fulfilled] User not found for request ${request.id}`);
            return;
        }

        if (user.email_notifications === 0) {
            console.log(`[Fulfilled] User ${user.username} has email notifications disabled`);
            return;
        }

        if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) {
            console.log('[Fulfilled] Email not configured, skipping notification');
            return;
        }

        const emailController = require('./emailController');
        const appUrl = 'https://books.drstang.xyz';


        const bookLink = linkedBookId
            ? `${appUrl}/book/${linkedBookId}`
            : appUrl;

        const buttonText = linkedBookId ? 'View Your Book' : 'Go to Library';


        const subject = `Book Now Available: ${request.title}`;

        const text = `Great news! Your requested book is now available in the library.

Book: ${request.title}
Author: ${request.author || 'Unknown'}
Status: Available

The book has been manually added to the library and is ready for you to read or download.

${linkedBookId ? `View your book: ${bookLink}` : `Go to library: ${bookLink}`}

---
BookServe - Your Personal Book Library`;

        const html = `
      <h2>🎉 Great news! Your book is now available</h2>
        <p>The book you requested has been added to the library:</p>
        <table style="border-collapse: collapse; margin: 15px 0;">
          <tr>
            <td style="padding: 5px 10px; font-weight: bold;">Title:</td>
            <td style="padding: 5px 10px;">${request.title}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; font-weight: bold;">Author:</td>
            <td style="padding: 5px 10px;">${request.author || 'Unknown'}</td>
          </tr>
          <tr>
            <td style="padding: 5px 10px; font-weight: bold;">Status:</td>
            <td style="padding: 5px 10px; color: green; font-weight: bold;">✓ Available</td>
          </tr>
        </table>
        <p>The book has been manually added to the library and is ready for you to read or download.</p>
        <p>
          <a href="${bookLink}" style="display: inline-block; padding: 10px 20px; background-color: #e50914; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
            ${buttonText}
          </a>
        </p>
        <hr style="margin-top: 20px;">
        <p style="color: #666; font-size: 12px;">BookServe - Your Personal Book Library</p>
      `;

        await emailController.sendNotificationEmail(user.email, subject, text, html);
        console.log(`[Fulfilled] Notification sent to ${user.email} for book: "${request.title}"`);

    } catch (error) {
        console.error('[Fulfilled] Error sending notification:', error.message);
    }
}




// ============================================================================
// BACKGROUND PROCESSING
// ============================================================================

async function processBookRequest(requestId) {
    try {
        const request = await BookRequest.findById(requestId);
        if (!request) return;

        // Update status to searching
        await BookRequest.updateStatus(requestId, 'searching');
        console.log(`[BookRequest] Trying Search Archive for "${request.title}"`);

        try {
            const archive = await searchArchive(request.title, request.author);
            if (archive) {
                console.log(`[BookRequest - SearchArchive] Updating status to completed for request ${requestId}`);
                await BookRequest.updateStatus(requestId, 'completed');
                await folderScanService.triggerScan();
                console.log(`[BookRequest - SearchArchive] Status updated successfully`);
                return archive;
            }
        } catch (err) {
            console.error(`[BookRequest - SearchArchive failed:`, err.message);
        }    

        console.log(`[BookRequest] Trying AA for "${request.title}"`);

        try {
            const anna = await getAABook(request.isbn, request.title, request.author);
            if (anna) {
                console.log(`[BookRequest - AA] Updating status to completed for request ${requestId}`);
                await BookRequest.updateStatus(requestId, 'completed');
                await folderScanService.triggerScan();
                console.log(`[BookRequest - AA] Status updated successfully`);
                return anna;
            }
        } catch (err) {
            console.error('[BookRequest - AA] AA failed:', err.message);
        }

        console.log(`[BookRequest] Trying Ocean for "${request.title}"`);
        try {
            const ocean = await getOcean(request.title, request.author, request.isbn);
            if (ocean) {
                console.log(`[BookRequest - Ocean] Updating status to completed for request ${requestId}`);
                await BookRequest.updateStatus(requestId, 'completed');
                await folderScanService.triggerScan();
                console.log(`[BookRequest - Ocean] Status updated successfully`);
                return ocean;
            }
        } catch (err) {
            console.error('[BookRequest - Ocean] Ocean failed:', err.message);
        }

        console.log('[BookRequest] Ocean failed, trying NZB');

        try {
            const nzbResults = await searchNZBHydra(request.title, request.author, request.isbn, requestId);
            if (!nzbResults || nzbResults.length === 0) {
                await nzbFailed(requestId);
                return
            }
            const bestResult = nzbResults[0];
            console.log(`[BookRequest] Best result for "${request.title}": "${bestResult.title}" (score: ${bestResult.relevanceScore})`);

            // Send to SABnzbd
            const sabnzbdId = await sendToSABnzbd(bestResult);

            if (!sabnzbdId) {
                await sabFailed(requestId);
                return;
            }

            // Update request with SABnzbd ID
            await BookRequest.updateStatus(requestId, 'downloading', {
                sabnzbd_id: sabnzbdId
            });

        } catch (err) {
            console.error('[BookRequest - NZB] NZB failed:', err.message);
        }


    } catch (error) {
        console.error('Error processing book request:', error.message);
        await genFailed(requestId, `Failed to download: ${error.message}`);
    }
}

async function nzbFailed (requestId) {
    await BookRequest.updateStatus(requestId, 'failed', {
        error_message: 'No books found for download. Will retry.'
    });
    await notifyUser(requestId);
    const retryIntervalDays = parseInt(process.env.RETRY_INTERVAL_DAYS) || 3;
    await BookRequest.scheduleRetry(requestId, retryIntervalDays);
    console.log(`Scheduled retry for request ${requestId} in ${retryIntervalDays} days`);
}

async function sabFailed (requestId) {
    await BookRequest.updateStatus(requestId, 'failed', {
        error_message: 'Failed to add to SABnzbd'
    });
    await notifyUser(requestId);
    const retryIntervalDays = parseInt(process.env.RETRY_INTERVAL_DAYS) || 3;
    await BookRequest.scheduleRetry(requestId, retryIntervalDays);
    console.log(`Scheduled retry for request ${requestId} in ${retryIntervalDays} days`);
}
async function genFailed (requestId, errorMessage) {
    await BookRequest.updateStatus(requestId, 'failed', {
        error_message: errorMessage
    });
    await notifyUser(requestId);
    const retryIntervalDays = parseInt(process.env.RETRY_INTERVAL_DAYS) || 3;
    await BookRequest.scheduleRetry(requestId, retryIntervalDays);
    console.log(`Scheduled retry for request ${requestId} in ${retryIntervalDays} days`);
}
async function notifyUser(requestId) {
    try {
        const request = await BookRequest.findById(requestId);

        const emailController = require('./emailController');
        const subject = 'Requested Book Failed';
        const text = `Book requested by user ${request.username} has failed.
    Book: ${request.title}
    Author: ${request.author || 'Unknown' }`;

        const html = `
    <h2>Book requested by ${request.username} has failed. </h2>
    <p> Book: ${request.title} </p>
    <p> Author: ${request.author || 'Unknown'}
    `;
        const adminEmail = process.env.ADMIN_EMAIL || 'dandolewski@gmail.com';
        await emailController.sendNotificationEmail(adminEmail,subject,text,html);
        console.log('Email sent to admin');
    } catch (error) {
        console.error('Error sending email to admin:', error.message);
    }
}


// Export for use in other modules
module.exports.processBookRequest = processBookRequest;
module.exports.searchNZBHydra = searchNZBHydra;
module.exports.getAABook = getAABook;
module.exports.getOcean = getOcean;
