const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;

const execPromise = util.promisify(exec);

class EbookConverter {
  constructor() {
    this.convertedDir = process.env.CONVERTED_BOOKS_PATH || './data/converted';
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
   * Convert MOBI/AZW to EPUB format
   * @param {string} inputPath - Path to the input file
   * @param {string} bookId - Book ID for naming
   * @returns {Promise<string>} - Path to converted EPUB file
   */
  async convertToEpub(inputPath, bookId) {
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

    console.log(`Converting ${ext} to EPUB for book ${bookId}...`);

    try {
      // Build ebook-convert command
      const command = `ebook-convert "${inputPath}" "${outputPath}" --enable-heuristics`;

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
