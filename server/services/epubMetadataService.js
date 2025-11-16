const AdmZip = require('adm-zip');
const path = require('path');

class EpubMetadataService {
  /**
   * Extract metadata from EPUB file
   * @param {string} epubPath - Path to EPUB file
   * @returns {Object} Metadata object with title, author, etc.
   */
  extractMetadata(epubPath) {
    try {
      const zip = new AdmZip(epubPath);

      // Find the container.xml file to locate the content.opf file
      const containerEntry = zip.getEntry('META-INF/container.xml');
      if (!containerEntry) {
        console.warn('No META-INF/container.xml found in EPUB');
        return this.getFallbackMetadata(epubPath);
      }

      const containerXml = zip.readAsText(containerEntry);
      const opfPath = this.extractOpfPath(containerXml);

      if (!opfPath) {
        console.warn('Could not find OPF path in container.xml');
        return this.getFallbackMetadata(epubPath);
      }

      // Read the content.opf file
      const opfEntry = zip.getEntry(opfPath);
      if (!opfEntry) {
        console.warn(`OPF file not found at path: ${opfPath}`);
        return this.getFallbackMetadata(epubPath);
      }

      const opfXml = zip.readAsText(opfEntry);
      const metadata = this.parseOpfMetadata(opfXml);

      console.log(`Extracted metadata from EPUB: ${metadata.title} by ${metadata.author}`);
      return metadata;
    } catch (error) {
      console.error('Error extracting EPUB metadata:', error);
      return this.getFallbackMetadata(epubPath);
    }
  }

  /**
   * Extract OPF file path from container.xml
   * @param {string} containerXml - Container XML content
   * @returns {string|null} Path to OPF file
   */
  extractOpfPath(containerXml) {
    // Look for <rootfile full-path="..." media-type="application/oebps-package+xml"/>
    const match = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  /**
   * Parse metadata from OPF XML
   * @param {string} opfXml - OPF XML content
   * @returns {Object} Metadata object
   */
  parseOpfMetadata(opfXml) {
    const metadata = {
      title: null,
      author: null,
      publisher: null,
      published_date: null,
      description: null,
      language: null,
      isbn: null,
      isbn_13: null,
    };

    // Extract title
    const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    if (titleMatch) {
      metadata.title = this.cleanText(titleMatch[1]);
    }

    // Extract author(s) - there can be multiple authors
    const authorMatches = opfXml.matchAll(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/gi);
    const authors = [];
    for (const match of authorMatches) {
      authors.push(this.cleanText(match[1]));
    }
    if (authors.length > 0) {
      metadata.author = authors.join(', ');
    }

    // Extract publisher
    const publisherMatch = opfXml.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i);
    if (publisherMatch) {
      metadata.publisher = this.cleanText(publisherMatch[1]);
    }

    // Extract publication date
    const dateMatch = opfXml.match(/<dc:date[^>]*>([^<]+)<\/dc:date>/i);
    if (dateMatch) {
      metadata.published_date = this.cleanText(dateMatch[1]);
    }

    // Extract description
    const descMatch = opfXml.match(/<dc:description[^>]*>([^<]+)<\/dc:description>/i);
    if (descMatch) {
      metadata.description = this.cleanText(descMatch[1]);
    }

    // Extract language
    const langMatch = opfXml.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
    if (langMatch) {
      metadata.language = this.cleanText(langMatch[1]);
    }

    // Extract ISBN from identifier fields
    const identifierMatches = opfXml.matchAll(/<dc:identifier[^>]*>([^<]+)<\/dc:identifier>/gi);
    for (const match of identifierMatches) {
      const identifier = this.cleanText(match[1]);
      // Check if it's an ISBN
      const isbnDigits = identifier.replace(/[^0-9X]/gi, '');
      if (isbnDigits.length === 10) {
        metadata.isbn = isbnDigits;
      } else if (isbnDigits.length === 13) {
        metadata.isbn_13 = isbnDigits;
      }
    }

    return metadata;
  }

  /**
   * Clean text by decoding HTML entities and trimming
   * @param {string} text - Text to clean
   * @returns {string} Cleaned text
   */
  cleanText(text) {
    if (!text) return text;

    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .trim();
  }

  /**
   * Get fallback metadata from filename
   * @param {string} epubPath - Path to EPUB file
   * @returns {Object} Basic metadata from filename
   */
  getFallbackMetadata(epubPath) {
    const filename = path.basename(epubPath, path.extname(epubPath));

    // Try to parse "Author - Title" or "Title - Author" format
    if (filename.includes(' - ')) {
      const parts = filename.split(' - ').map(p => p.trim());

      // Heuristic: if first part starts with "The", "A", "An", it's probably the title
      const firstPartIsTitle = /^(The|A|An)\s/i.test(parts[0]);

      if (firstPartIsTitle) {
        return {
          title: parts[0],
          author: parts[1] || null,
        };
      } else {
        return {
          title: parts[1] || parts[0],
          author: parts[0],
        };
      }
    }

    // Just use filename as title
    return {
      title: filename,
      author: null,
    };
  }
}

module.exports = new EpubMetadataService();
