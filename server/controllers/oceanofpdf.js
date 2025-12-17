const axios = require('axios');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');


async function searchOceanOfPDF(title, author) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  try {
    // Construct search query URL
    const query = `${title} ${author}`.replace(/\s+/g, '+');
    const url = `https://oceanofpdf.com/?s=${query}`;

    await page.goto(url, { waitUntil: 'networkidle2'});

    const html = await page.content();
      
    // Fetch the search results page
    const $ = cheerio.load(html);

    // Parse and extract relevant links
    const results = [];
    $('.bs > .item').each((index, element) => {
      const link = $(element).find('.tt a').attr('href');
      if (link && link.includes('/book/')) {
        results.push(link);
      }
    });
    return results;
  } catch (error) {
    console.error('Error searching OceanOfPDF:', error.message, error.response ? error.response.status : '');    return [];
  }
}
async function getBookDetails(bookUrl) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  try {
    await page.goto(bookUrl, { waitUntil: 'networkidle2' });
    const html = await page.content()
    const $ = cheerio.load(html);

    let pdfDownloadUrl = null;
    let epubDownloadUrl = null;

    // Extract the form action URL and hidden inputs for both PDF and EPUB
    $('form[action="https://oceanofpdf.com/Fetching_Resource.php"]').each((index, element) => {
      const id = $(element).find('input[name="id"]').attr('value');
      const filename = $(element).find('input[name="filename"]').attr('value');

      if (id && filename) {
        const downloadUrl = `https://oceanofpdf.com/Fetching_Resource.php?id=${id}&filename=${encodeURIComponent(filename)}`;

        if (filename.endsWith('.epub')) {
          epubDownloadUrl = downloadUrl;
        } else if (filename.endsWith('.pdf')) {
          pdfDownloadUrl = downloadUrl;
        }
      }
    });

    // Prefer EPUB over PDF
    return epubDownloadUrl || pdfDownloadUrl;
  } catch (error) {
    console.error('Error fetching book details:', error.message);
    return null;
  }
}
async function download(url, filePath) {
  try {
    const { data } = await axios({
      url,
      responseType: 'stream'
    });

    const writer = fs.createWriteStream(filePath);

    data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading PDF:', error.message);
    throw error;
  }
}

module.exports = { searchOceanOfPDF, getBookDetails, download };
