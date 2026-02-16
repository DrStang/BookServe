const axios = require('axios');
const {chromium} = require("playwright-extra");
const path = require("path");
const fs = require("fs");
//const { finished } = require('fs/promises');
require('dotenv').config();

const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

async function searchOceanOfPDF(title, author) {
    const browser = await chromium.launch({ headless: true, proxy: {"server": 'http://155.138.227.76:3128'} });

    try {
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
        });
        const page = await context.newPage();
        // Construct search query URL
        const params = new URLSearchParams();
        params.set('s', `${title} ${author}`);
        const url = `https://oceanofpdf.com/?${params.toString()}`;
        console.log(url);

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });


        // Parse and extract relevant links
        const linkSelector = 'a.entry-image-link';

        const linkLocator = page.locator(linkSelector);
        if (await linkLocator.count() === 0) {
            console.error("No search results found");
            await page.screenshot({ path: 'debug.png' });
            return null;
        }

        const href = await linkLocator.first().getAttribute('href');

        if (href) {
            console.log("Found URL:", href);
        } else {
            console.error("Link never appeared");
            await page.screenshot({ path: 'debug.png' });
        }

        return href;

    } catch (error) {
        console.error('Error searching OceanOfPDF:', error.message, error.response ? error.response.status : '');
        return null;
    } finally {
        await browser.close();
    }
}
async function getBook(title, author) {
    const bookUrl = await searchOceanOfPDF(title, author);
    if (!bookUrl) {
        console.log('No Book URL found.');
        return null;
    }
    console.log(`Found ${bookUrl}`);
    const browser = await chromium.launch({ headless: true , proxy: {"server": 'http://155.138.227.76:3128'}});
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
    });
    const page = await context.newPage();


    try {

        await page.goto(bookUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

        //const pagePromise = context.waitForEvent('page');

        const epubBtn = page.locator('input[type="image"][src*="epub-button.jpg"]').first();
        const pdfBtn  = page.locator('input[type="image"][src*="pdf-button.jpg"]').first();

        let btnToClick = null;

        if (await epubBtn.count()) {
            btnToClick = epubBtn;
        } else if (await pdfBtn.count()) {
            btnToClick = pdfBtn;
        } else {
            console.error("No EPUB or PDF button found");
            await page.screenshot({ path: "debug.png", fullPage: true });
            return null;
        }

// IMPORTANT: wait for the popup from THIS click
        const [newTab] = await Promise.all([
            page.waitForEvent("popup", { timeout: 60000 }),
            btnToClick.click({ timeout: 60000 })   // use click, not dispatchEvent
        ]);

        await newTab.waitForLoadState("domcontentloaded");

        //const newTab = await pagePromise;
        //await newTab.waitForLoadState();


        await newTab.waitForSelector('meta[http-equiv="Refresh"]', { state: 'attached' });
        const content = await newTab.getAttribute('meta[http-equiv="Refresh"]', 'content');


        const match = content.match(/url=(.+)$/i);
        console.log(match);
        const targetUrl = match ? match[1] : null;


        if (!targetUrl) {
          console.log('No target URL found');
          return null;
        }

        const response = await axios({
            method: 'GET',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
                Accept: "text/html,*/*",
                   "Accept-Language": "en-US,en;q=0.9",
            }
        });

        const filename = getFilename(response, targetUrl);
        console.log(`Found ${filename}`);
        const filePath = path.resolve(process.env.BOOKS_STORAGE_PATH, filename);
        const writer = fs.createWriteStream(filePath);

        response.data.pipe(writer);

            // await finished(writer);

        return filePath;



    } catch (error) {
        console.error('Error fetching book details:', error.message);
        return null;
    } finally {
        await browser.close();
    }
}

    function getFilename(response, url, maxLength = 40) {
        let rawName = '';
        let disposition = response.headers['content-disposition'];

        if (Array.isArray(disposition)) {
            disposition = disposition[0];
        }

        if (disposition && typeof disposition === 'string' && disposition.includes('filename=')) {
            rawName = disposition.split('filename=')[1].replace(/["']/g, "").split(';')[0].trim();
        } else {
            try {
                rawName = path.basename(new URL(url).pathname);
            } catch (e) {
                rawName = 'downloaded_file';
            }
        }

        let cleanName = decodeURIComponent(rawName || 'file');

        cleanName = cleanName.replace(/[^a-z0-9. \-_]/gi, '_');

        const ext = path.extname(cleanName);
        const base = path.basename(cleanName, ext);

        const shortenedBase = base.substring(0, maxLength);

        return `${shortenedBase}${ext}`;
    }
getBook();
