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

    const maxSizeMB = 17.5;
    let fileSizeMB = await ebookConverter.getFileSizeMB(filePath);
    const isKindleAddress = email.toLowerCase().includes('@kindle.com');

    if (fileSizeMB > maxSizeMB) {
      console.log(`File size ${fileSizeMB.toFixed(2)}MB exceeds ${maxSizeMB}MB, attempting compression...`);
      if (filePath.toLowerCase().endsWith('.epub')) {
        filePath = await ebookConverter.compressEpub(filePath);
        fileSizeMB = await ebookConverter.getFileSizeMB(filePath);
        console.log(`Post-compression size: ${fileSizeMB.toFixed(2)}MB`);
      }

      if (fileSizeMB > maxSizeMB) {
        if (isKindleAddress) {
          // Kindle can't use download links - suggest alternatives
          const appUrl = 'https://books.drstang.xyz';
          return res.status(413).json({
            error: 'Book too large for email',
            message: `This book is ${fileSizeMB.toFixed(1)}MB which exceeds the ${maxSizeMB}MB email limit. For Kindle, please download the book directly and sideload via USB, or access it through OPDS at ${appUrl}/opds.`,
            sizeMB: fileSizeMB,
            isKindle: true
          });
        } else {
          // Regular email - send download link instead
          const appUrl = 'https://books.drstang.xyz';
          const downloadLink = `${appUrl}/book/${book.id}`;

          const transporter = createTransporter();
          const mailOptions = {
            from: `"BookServe" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
            to: email,
            subject: `Your book: ${book.title}`,
            text: `Your requested book "${book.title}" by ${book.author || 'Unknown'} is too large to attach (${fileSizeMB.toFixed(1)}MB). You can download it here: ${downloadLink}`,
            html: `
              <h2>Your Requested Book</h2>
              <p><strong>Title:</strong> ${book.title}</p>
              <p><strong>Author:</strong> ${book.author || 'Unknown'}</p>
              <p>This book is too large to send as an attachment (${fileSizeMB.toFixed(1)}MB).</p>
              <p>
                <a href="${downloadLink}" style="display: inline-block; padding: 10px 20px; background-color: #e50914; color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
                  Download Book
                </a>
              </p>
              <hr style="margin-top: 20px;">
              <p style="color: #666; font-size: 12px;">BookServe - Your Personal Book Library</p>
            `
          };

          await transporter.sendMail(mailOptions);

          // Save email if requested
          if (saveEmail && req.user?.id) {
            try {
              await User.saveKindleEmail(req.user.id, email);
            } catch (saveError) {
              console.error('Error saving email:', saveError);
            }
          }

          return res.json({
            message: `Book too large to attach. A download link was sent to ${email} instead.`,
            downloadLink: true
          });
        }
      }
    }
        
      

    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
