const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { finished } = require ('node:stream/promises');
const fsPromises = fs.promises;
require('dotenv').config();

async function getFilename(response, url, maxLength = 40) {
    let rawName = '';
    const disposition = response.headers['content-disposition'];

    if (disposition && disposition.includes('filename=')) {
        rawName = disposition.split('filename=')[1].replace(/["']/g, "").split(';')[0].trim();
    } else{
        rawName = path.basename(new URL(url).pathname);
    }
    let cleanName = decodeURIComponent(rawName);

    cleanName = cleanName.replace(/[^a-z0-9. \-_]/gi, '_');

    const ext = path.extname(cleanName);
    const base = path.basename(cleanName, ext);

    const shortenedBase = base.substring(0, maxLength);

    return `${shortenedBase}${ext}`;

}
async function searchAnna(isbn) {

    try {
        // Construct search query URL
        const url = `https://annas-archive.li/search?q=${isbn}`;

        const res = await axios.get(url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
                Accept: "text/html,*/*",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 30000,
        });

        // Fetch the search results page
        const $ = cheerio.load(res.data);

        // Parse and extract relevant links
        const href = $("a[href^='/md5/']").first().attr('href');
        if (!href) return null;

        const m = href.match(/^\/md5\/([a-f0-9]{32})\b/i);
        return m ? m[1].toLowerCase() : null;


    } catch (error) {
        console.error('Error searching AA:', error.message, error.response ? error.response.status : '');    return [];
    }
}
async function getBookDetails(isbn) {

    const md5 = await searchAnna(isbn);
    const API = process.env.ANNA_API || 'CdSzk5n7WFSrbD5AbG353s7HJqpb4';
    const url = `https://annas-archive.li/dyn/api/fast_download.json?md5=${md5}&key=${API}`;



    const response = await fetch(url)
    if (!response){
        console.error('Failed to get book link:', response);
        return null;
    }

    const json = await response.json()

    const downloadLink = json.download_url;

    if (!downloadLink) {
        console.error('Failed to parse AA JSON:', response);
        return null;
    }

    try {

        const response = await axios({
            method: 'GET',
            url: downloadLink,
            responseType: 'stream'
        })
        const filename = await getFilename(response, downloadLink);
        const filePath = path.resolve(process.env.BOOKS_STORAGE_PATH, filename);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

        await finished(writer);

        await confirmAADownload(filename);

        return filePath;

    } catch (error) {
        console.error('Error downloading book:', error.message);
    }
}
async function confirmAADownload(filename){
    const fileSource = path.join(process.env.BOOKS_STORAGE_PATH, filename);
    try {
        await fsPromises.access(fileSource);
        const stats = await fsPromises.stat(fileSource);
        if (stats.size > 0) {
            console.log(`Book successfully downloaded`);
            return true;
        }
        console.error(`Book download failed`);
        return false;
    }catch(err) {
        return false;
    }
}
(async () => {
    const download = await getBookDetails('9781472855190');
    console.log('Main process received:', download);
})();
