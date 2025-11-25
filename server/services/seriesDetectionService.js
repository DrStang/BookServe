/**
 * Service for detecting and extracting series information from book titles and metadata
 */

/**
 * Extract series information from book title
 * Common patterns:
 * - "Book Title (Series Name #1)"
 * - "Book Title (Series Name, Book 1)"
 * - "Series Name: Book Title"
 * - "Book Title - Series Name, Book 1"
 * - "Book Title (Series Name Book 1)"
 *
 * @param {string} title - The book title
 * @returns {Object|null} - { series: string, seriesNumber: number } or null
 */
function detectSeriesFromTitle(title) {
  if (!title) return null;

  // Pattern 1: "Book Title (Series Name #1)" or "Book Title (Series Name, #1)"
  const pattern1 = /^(.+?)\s*\(([^)]+?)[,\s]*#(\d+(?:\.\d+)?)\)$/i;
  let match = title.match(pattern1);
  if (match) {
    return {
      title: match[1].trim(),
      series: match[2].trim(),
      seriesNumber: parseFloat(match[3])
    };
  }

  // Pattern 2: "Book Title (Series Name, Book 1)"
  const pattern2 = /^(.+?)\s*\(([^)]+?)[,\s]*Book\s+(\d+(?:\.\d+)?)\)$/i;
  match = title.match(pattern2);
  if (match) {
    return {
      title: match[1].trim(),
      series: match[2].trim(),
      seriesNumber: parseFloat(match[3])
    };
  }

  // Pattern 3: "Series Name: Book Title" (no number detection)
  const pattern3 = /^([^:]+):\s*(.+)$/;
  match = title.match(pattern3);
  if (match && match[1].length < 50) { // Series name should be reasonably short
    return {
      title: match[2].trim(),
      series: match[1].trim(),
      seriesNumber: null
    };
  }

  // Pattern 4: "Book Title - Series Name, Book 1"
  const pattern4 = /^(.+?)\s*-\s*([^,]+),\s*Book\s+(\d+(?:\.\d+)?)$/i;
  match = title.match(pattern4);
  if (match) {
    return {
      title: match[1].trim(),
      series: match[2].trim(),
      seriesNumber: parseFloat(match[3])
    };
  }

  // Pattern 5: "Book Title (Series Name Book 1)"
  const pattern5 = /^(.+?)\s*\(([^)]+?)\s+Book\s+(\d+(?:\.\d+)?)\)$/i;
  match = title.match(pattern5);
  if (match) {
    return {
      title: match[1].trim(),
      series: match[2].trim(),
      seriesNumber: parseFloat(match[3])
    };
  }

  // Pattern 6: "Book Title, Book 1 (Series Name)"
  const pattern6 = /^(.+?),\s*Book\s+(\d+(?:\.\d+)?)\s*\(([^)]+)\)$/i;
  match = title.match(pattern6);
  if (match) {
    return {
      title: match[1].trim(),
      series: match[3].trim(),
      seriesNumber: parseFloat(match[2])
    };
  }

  return null;
}

/**
 * Extract series from EPUB metadata
 * @param {Object} metadata - Metadata object from EPUB
 * @returns {Object|null} - { series: string, seriesNumber: number } or null
 */
function detectSeriesFromMetadata(metadata) {
  if (!metadata) return null;

  // Check for series in metadata
  if (metadata.series) {
    return {
      series: metadata.series,
      seriesNumber: metadata.seriesNumber || metadata.sequence || null
    };
  }

  // Check calibre metadata
  if (metadata.calibre_series) {
    return {
      series: metadata.calibre_series,
      seriesNumber: metadata.calibre_series_index || null
    };
  }

  return null;
}

/**
 * Detect series from all available sources
 * Priority: Metadata > Title
 *
 * @param {string} title - Book title
 * @param {Object} metadata - Book metadata
 * @returns {Object} - { series: string|null, seriesNumber: number|null, cleanTitle: string }
 */
function detectSeries(title, metadata = {}) {
  // Try metadata first
  const metadataSeries = detectSeriesFromMetadata(metadata);
  if (metadataSeries) {
    return {
      series: metadataSeries.series,
      seriesNumber: metadataSeries.seriesNumber,
      cleanTitle: title // Keep original title when series comes from metadata
    };
  }

  // Try title parsing
  const titleSeries = detectSeriesFromTitle(title);
  if (titleSeries) {
    return {
      series: titleSeries.series,
      seriesNumber: titleSeries.seriesNumber,
      cleanTitle: titleSeries.title // Use cleaned title
    };
  }

  return {
    series: null,
    seriesNumber: null,
    cleanTitle: title
  };
}

module.exports = {
  detectSeriesFromTitle,
  detectSeriesFromMetadata,
  detectSeries
};
