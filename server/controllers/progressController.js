const ReadingProgress = require('../models/ReadingProgress');

// Get progress for a specific book
exports.getBookProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.id;

    const progress = await ReadingProgress.getProgress(userId, bookId);

    res.json({
      success: true,
      progress: progress || { progress: 0, current_location: null }
    });
  } catch (error) {
    console.error('Error fetching book progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reading progress'
    });
  }
};

// Update progress for a specific book
exports.updateBookProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.id;
    const { progress, current_location } = req.body;

    // Validate progress
    if (progress < 0 || progress > 100) {
      return res.status(400).json({
        success: false,
        error: 'Progress must be between 0 and 100'
      });
    }

    await ReadingProgress.upsertProgress(userId, bookId, progress, current_location);

    res.json({
      success: true,
      message: 'Progress updated successfully'
    });
  } catch (error) {
    console.error('Error updating book progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update reading progress'
    });
  }
};

// Get all books with progress for the current user
exports.getAllProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const progress = await ReadingProgress.getAllProgress(userId);

    res.json({
      success: true,
      progress
    });
  } catch (error) {
    console.error('Error fetching all progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reading progress'
    });
  }
};

// Get recently read books
exports.getRecentlyRead = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const books = await ReadingProgress.getRecentlyRead(userId, limit);

    res.json({
      success: true,
      books
    });
  } catch (error) {
    console.error('Error fetching recently read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recently read books'
    });
  }
};

// Get books to continue reading
exports.getContinueReading = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const books = await ReadingProgress.getContinueReading(userId, limit);

    res.json({
      success: true,
      books
    });
  } catch (error) {
    console.error('Error fetching continue reading:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch continue reading books'
    });
  }
};

// Delete progress for a book
exports.deleteProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const bookId = req.params.id;

    await ReadingProgress.deleteProgress(userId, bookId);

    res.json({
      success: true,
      message: 'Progress deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete reading progress'
    });
  }
};
