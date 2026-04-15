const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;

const execPromise = util.promisify(exec);

class EbookConverter {
  constructor() {
    this.convertedDir = process.env.CONVERTED_BOOKS_PATH || './data/converted';
    this.maxEmailSizeMB = 20;
    this.ensureConvertedDir();
  }

  async ensureConvertedDir() {
    try {
      await fs.mkdir(this.convertedDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create converted directory:', error);
    }
  }

  /**
   * Check if Calibre's ebook-convert is available
   */
  async isCalibreInstalled() {
    try {
      await execPromise('ebook-convert --version');
      return true;
    } catch (error) {
      return false;
    }
  }

    /**
   * Compress an EPUB file by optimizing images
   * @param {string} epubPath - Path to the EPUB file
   * @returns {Promise<string>} - Path to compressed EPUB
   */

  async compressEpub(epubPath) {
    const compressedPath = epubPath.replace('.epub', '_compressed.epub');

    try {
      const command = `ebook-polish --compress-images --jpeg-quality=45 "${epubPath}" "${compressedPath}"`;

      console.log('Compressing EPUB images...');
      await execPromise(command, {
        maxBuffer: 10 * 1024 * 1024
      });

      const originalStats = await fs.stat(epubPath);
      const compressedStats = await fs.stat(compressedPath);

      const originalMB = originalStats.size / (1024 * 1024);
      const compressedMB = compressedStats.size / (1024 * 1024);

      console.log(`Compression: ${originalMB.toFixed(2)}MB → ${compressedMB.toFixed(2)}MB`);

      if (compressedMB >= originalMB * 0.95) {
        await fs.unlink(compressedPath);
        return epubPath;
      }
      await fs.unlink(epubPath);
      await fs.rename(compressedPath, epubPath);

      return epubPath;
    } catch (error) {
      console.warn('EPUB compression failed, using original:', error.message);

      try {
        await fs.unlink(compressedPath);
      } catch (e) {}
      return epubPath;
    }
  }
  /**
   * Get file size in MB
   * @param {string} filePath - Path to file
   * @returns {Promise<number>} - File size in MB
   */
  async getFileSizeMB(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size / (1024 * 1024);
  }



  /**
   * Convert MOBI/AZW to EPUB format
   * @param {string} inputPath - Path to the input file
   * @param {string} bookId - Book ID for naming
   * @returns {Promise<string>} - Path to converted EPUB file
   */
  async convertToEpub(inputPath, bookId, options = {}) {
    const { forEmail = false } = options;
    const calibreInstalled = await this.isCalibreInstalled();

    if (!calibreInstalled) {
      throw new Error('Calibre ebook-convert is not installed. Please install Calibre to enable MOBI/AZW conversion.');
    }

    const ext = path.extname(inputPath).toLowerCase();
    const outputPath = path.join(this.convertedDir, `${bookId}.epub`);

    // Check if already converted
    try {
      await fs.access(outputPath);
      console.log(`Using cached conversion for book ${bookId}`);
      return outputPath;
    } catch (error) {
      // File doesn't exist, proceed with conversion
    }
    if (this.needsConversion(inputPath)) {
      console.log(`Converting ${ext} to EPUB for book ${bookId}...`);
    
      try {
      // Build ebook-convert command
      let command = `ebook-convert "${inputPath}" "${outputPath}" --enable-heuristics`;

  
        
      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      if (stderr && !stderr.includes('Conversion')) {
        console.warn('Conversion warnings:', stderr);
      }

      console.log(`✓ Conversion completed for book ${bookId}`);
      return outputPath;
    } catch (error) {
      console.error('Conversion failed:', error.message);

      // Clean up partial conversion
      try {
        await fs.unlink(outputPath);
      } catch (unlinkError) {
        // Ignore cleanup errors
      }

      throw new Error(`Failed to convert ${ext} to EPUB: ${error.message}`);
    }
  }

  if (forEmail) {
    const sizeMB = await this.getFileSizeMB(outputPath);
    console.log(`EPUB size: ${sizeMB.toFixed(2)}MB`);

    if (sizeMB > this.maxEmailSizeMB) {
      console.log(`File exceeds ${this.maxEmailSizeMB}MB, attempting compression...`);
      await this.compressEpub(outputPath);

      const finalSizeMB = await this.getFileSizeMB(outputPath);
      if (finalSizeMB > this.maxEmailSizeMB) {
        throw new Error(`File too large for email (${finalSizeMB.toFixed(1)}MB). Gmail limit is ~${this.maxEmailSizeMB}MB.`);
      }
    }
  }
  return outputPath;
}    


  /**
   * Convert PDF to text for indexing/search
   * @param {string} inputPath - Path to PDF file
   * @returns {Promise<string>} - Extracted text content
   */
  async extractPdfText(inputPath) {
    const calibreInstalled = await this.isCalibreInstalled();

    if (!calibreInstalled) {
      throw new Error('Calibre is not installed');
    }

    try {
      const tempTxtPath = path.join(this.convertedDir, `temp_${Date.now()}.txt`);
      const command = `ebook-convert "${inputPath}" "${tempTxtPath}"`;

      await execPromise(command);
      const text = await fs.readFile(tempTxtPath, 'utf-8');

      // Clean up temp file
      await fs.unlink(tempTxtPath);

      return text;
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      return '';
    }
  }

  /**
   * Get file format/type
   * @param {string} filePath - Path to file
   * @returns {string} - File format (epub, mobi, azw, azw3, pdf)
   */
  getFileFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext.substring(1); // Remove the dot
  }

  /**
   * Check if file needs conversion
   * @param {string} filePath - Path to file
   * @returns {boolean}
   */
  needsConversion(filePath) {
    const format = this.getFileFormat(filePath);
    return ['mobi', 'azw', 'azw3'].includes(format);
  }

  /**
   * Delete converted file
   * @param {string} bookId - Book ID
   */
  async deleteConverted(bookId) {
    try {
      const convertedPath = path.join(this.convertedDir, `${bookId}.epub`);
      await fs.unlink(convertedPath);
      console.log(`Deleted converted file for book ${bookId}`);
    } catch (error) {
      // File might not exist, ignore error
    }
  }
}

module.exports = new EbookConverter();
