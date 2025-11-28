const GoodreadsImportService = require('../services/goodreadsImportService');
const fs = require('fs').promises;

exports.importCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const userId = req.user.id;
    const filePath = req.file.path;

    // Parse the CSV file
    const importedBooks = await GoodreadsImportService.parseCSV(filePath);

    if (importedBooks.length === 0) {
      await fs.unlink(filePath); // Clean up
      return res.status(400).json({ error: 'No books found in CSV file' });
    }

    // Match books against existing library
    const matchResults = await GoodreadsImportService.matchBooks(importedBooks);

    // Optionally create requests for "to-read" books not in library
    const createRequests = req.body.createRequests === 'true' || req.body.createRequests === true;
    let createdRequests = [];

    if (createRequests && matchResults.notFoundToRead.length > 0) {
      createdRequests = await GoodreadsImportService.createRequests(
        matchResults.notFoundToRead,
        userId
      );
    }

    // Generate summary
    const summary = GoodreadsImportService.generateSummary(matchResults, createdRequests);

    // Clean up uploaded file
    await fs.unlink(filePath);

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Error importing Goodreads CSV:', error);

    // Clean up file if it exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }

    res.status(500).json({ error: 'Error importing CSV file', details: error.message });
  }
};

exports.previewCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const filePath = req.file.path;

    // Parse the CSV file
    const importedBooks = await GoodreadsImportService.parseCSV(filePath);

    // Take first 10 books for preview
    const preview = importedBooks.slice(0, 10).map(book => ({
      title: book.title,
      author: book.author,
      isbn: book.isbn13 || book.isbn,
      shelf: book.exclusiveShelf,
      rating: book.myRating
    }));

    // Clean up uploaded file
    await fs.unlink(filePath);

    res.json({
      success: true,
      totalBooks: importedBooks.length,
      preview
    });
  } catch (error) {
    console.error('Error previewing Goodreads CSV:', error);

    // Clean up file if it exists
    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Error cleaning up file:', unlinkError);
      }
    }

    res.status(500).json({ error: 'Error previewing CSV file', details: error.message });
  }
};
