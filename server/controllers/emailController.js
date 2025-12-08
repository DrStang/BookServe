const nodemailer = require('nodemailer');
const Book = require('../models/Book');
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
    const { email, format } = req.body;

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
        filePath = await ebookConverter.convertToEpub(filePath, book.id);
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

    res.json({ message: 'Book sent successfully to ' + email });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Error sending book by email' });
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
