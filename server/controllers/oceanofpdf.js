const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

const instance = axios.create({
  baseURL:'https://oceanofpdf.com',
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
    'Accept-Language': 'en-US,en;q=0.9'
  },
  withCredentials: true
});    
async function searchOceanOfPDF(title, author) {
  try {
    // Construct search query URL
    const query = `${title} ${author}`.replace(/\s+/g, '+');
    const url = `/?s=${query}`;

    const { data, headers } await instance.get(url);
    // Fetch the search results page
    const $ = cheerio.load(data);

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
    console.error('Error searching OceanOfPDF:', error.message);
    return [];
  }
}
async function getBookDetails(bookUrl) {
  try {
    const { data, headers } = await instance.get(bookUrl);

    const $ = cheerio.load(data);

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
