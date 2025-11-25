const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Cover storage directory
const COVERS_DIR = process.env.COVERS_STORAGE_PATH || './data/covers';

/**
 * Ensure covers directory exists
 */
async function ensureCoversDir() {
  try {
    await fs.mkdir(COVERS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating covers directory:', error);
  }
}

/**
 * Download and cache a cover image
 * @param {string} url - Cover image URL
 * @param {number} bookId - Book ID for filename
 * @returns {Promise<string>} - Local file path
 */
async function downloadCover(url, bookId) {
  if (!url) return null;

  try {
    await ensureCoversDir();

    // Generate filename from book ID
    const ext = path.extname(new URL(url).pathname) || '.jpg';
    const filename = `${bookId}${ext}`;
    const filepath = path.join(COVERS_DIR, filename);

    // Check if already cached
    try {
      await fs.access(filepath);
      console.log(`Cover already cached for book ${bookId}`);
      return filepath;
    } catch {
      // File doesn't exist, download it
    }

    // Download the image
    console.log(`Downloading cover for book ${bookId} from ${url}`);
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'BookServe/1.0'
      }
    });

    // Save to disk
    await fs.writeFile(filepath, response.data);
    console.log(`Cover cached for book ${bookId} at ${filepath}`);

    return filepath;
  } catch (error) {
    console.error(`Error downloading cover for book ${bookId}:`, error.message);
    return null;
  }
}

/**
 * Delete cached cover image
 * @param {string} filepath - Path to cover file
 */
async function deleteCover(filepath) {
  if (!filepath) return;

  try {
    await fs.unlink(filepath);
    console.log(`Deleted cover: ${filepath}`);
  } catch (error) {
    console.error(`Error deleting cover ${filepath}:`, error.message);
  }
}

/**
 * Get cover path for a book
 * @param {number} bookId - Book ID
 * @returns {Promise<string|null>} - Cover path if exists
 */
async function getCoverPath(bookId) {
  const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

  for (const ext of extensions) {
    const filepath = path.join(COVERS_DIR, `${bookId}${ext}`);
    try {
      await fs.access(filepath);
      return filepath;
    } catch {
      // Try next extension
    }
  }

  return null;
}

module.exports = {
  downloadCover,
  deleteCover,
  getCoverPath,
  COVERS_DIR
};
