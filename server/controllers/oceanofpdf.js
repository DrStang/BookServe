const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function searchOceanOfPDF(title, author) {
  try {
    // Construct search query URL
    const query = `${title} ${author}`.replace(/\s+/g, '+');
    const url = `https://www.oceanofpdf.com/?s=${query}`;

    // Fetch the search results page
    const { data } = await axios.get(url);
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
    const { data } = await axios.get(bookUrl);
    const $ = cheerio.load(data);

    let downloadUrl = null;
      $('form[action="https://oceanofpdf.com/Fetching_Resource.php"]').each((index, element) => {
      const id = $(element).find('input[name="id"]').attr('value');
      const filename = $(element).find('input[name="filename"]').attr('value');

      if (id && filename) {
      downloadUrl = `https://oceanofpdf.com/Fetching_Resource.php?id=${id}&filename=${encodeURIComponent(filename)}`;
      }
    });

    return downloadUrl;
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
