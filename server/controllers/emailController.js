const nodemailer = require('nodemailer');
const Book = require('../models/Book');
const User = require('../models/User');
const path = require('path');
const fs = require('fs').promises;
const ebookConverter = require('../services/ebookConverter');

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

exports.sendBookByEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, format, saveEmail } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    const book = await Book.findById(id);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    let filePath = path.resolve(book.file_path);
    let attachmentFilename = `${book.title}.${book.format}`;

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ error: 'Book file not found' });
    }

    // Convert to EPUB if requested and book needs conversion
    const requestedFormat = format?.toLowerCase();
    if (requestedFormat === 'epub' && ebookConverter.needsConversion(filePath)) {
      try {
        console.log(`Converting ${book.format} to EPUB for email...`);
        filePath = await ebookConverter.convertToEpub(filePath, book.id, { forEmail: true });
        filePath = path.resolve(filePath);
        attachmentFilename = `${book.title}.epub`;
      } catch (conversionError) {
        console.error('Conversion error:', conversionError);
        return res.status(500).json({
          error: 'Failed to convert book to EPUB',
          message: conversionError.message
        });
      }
    }

    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your book: ${book.title}`,
      text: `Here is your requested book: ${book.title} by ${book.author}`,
      html: `
        <h2>Your Requested Book</h2>
        <p><strong>Title:</strong> ${book.title}</p>
        <p><strong>Author:</strong> ${book.author || 'Unknown'}</p>
        <p>Enjoy your reading!</p>
      `,
      attachments: [
        {
          filename: attachmentFilename,
          path: filePath
        }
      ]
    };

    await transporter.sendMail(mailOptions);

    // Save email if requested
    if (saveEmail && req.user?.id) {
      try {
        await User.saveKindleEmail(req.user.id, email);
        console.log(`Saved kindle email for user ${req.user.id}: ${email}`);
      } catch (saveError) {
        console.error('Error saving kindle email:', saveError);
        // Don't fail the request if saving email fails
      }
    }

    res.json({ message: 'Book sent successfully to ' + email });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Error sending book by email' });
  }
};

// Save user's kindle email
exports.saveEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const userId = req.user.id;

    if (!email) {
      return res.status(400).json({ error: 'Email address required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const result = await User.saveKindleEmail(userId, email);
    res.json({ 
      message: 'Email saved successfully',
      kindle_email: result.kindle_email
    });
  } catch (error) {
    console.error('Error saving email:', error);
    res.status(500).json({ error: 'Error saving email' });
  }
};

// Clear user's saved kindle email
exports.clearSavedEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    await User.clearKindleEmail(userId);
    res.json({ message: 'Saved email cleared successfully' });
  } catch (error) {
    console.error('Error clearing saved email:', error);
    res.status(500).json({ error: 'Error clearing saved email' });
  }
};


// Get user's saved kindle email
exports.getSavedEmail = async (req, res) => {
  try {
    const userId = req.user.id;
    const kindleEmail = await User.getKindleEmail(userId);
    res.json({ kindle_email: kindleEmail });
  } catch (error) {
    console.error('Error fetching saved email:', error);
    res.status(500).json({ error: 'Error fetching saved email' });
  }
};



exports.testEmail = async (req, res) => {
  try {
    const transporter = createTransporter();

    await transporter.verify();

    res.json({ message: 'Email configuration is valid' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email configuration error: ' + error.message });
  }
};

// Send notification email (for retry service)
exports.sendNotificationEmail = async (to, subject, text, html) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      text: text,
      html: html
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Error sending notification email:', error);
    throw error;
  }
};
