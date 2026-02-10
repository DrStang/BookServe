import axios from 'axios';
import { chromium } from 'playwright-extra';
import { finished } from 'node:stream/promises';
import fs from 'fs';
import path from 'path';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth);
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

async function searchOceanOfPDF(title, author) {
  try {
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
  }
}

async function getBook(title, author) {
  const bookUrl = await searchOceanOfPDF(title, author);
  if (!bookUrl) {
    console.log('No Book URL found.');
    return null;
  }
  console.log(`Found ${bookUrl}`);
  try {
    await page.goto(bookUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const pagePromise = context.waitForEvent('page');

    await page.click('input[type="image"][alt="Submit"]');

    const newTab = await pagePromise;
    await newTab.waitForLoadState();

    // Target the specific script tag using a text selector
    const scriptHandle = newTab.locator('script:has-text("location.href")');

    // Get the text content from that handle
    const scriptContent = await scriptHandle.textContent();

    // Run your regex on the string
    const match = scriptContent.match(/location\.href\s*=\s*'(.*?)'/);
    const targetUrl = match ? match[1] : null;

    if (!targetUrl) {
      console.log('No target URL found');
      return null;
    }

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream'
    });

    const filename = getFilename(response, targetUrl);
    console.log(`Found ${filename}`);
    const filePath = path.resolve(process.env.BOOKS_STORAGE_PATH, filename);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    await finished(writer);

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
  const disposition = response.headers['content-disposition'];

  if (disposition && disposition.includes('filename=')) {
    rawName = disposition.split('filename=')[1].replace(/["']/g, "").split(';')[0].trim();
  } else {
    rawName = path.basename(new URL(url).pathname);
  }
  let cleanName = decodeURIComponent(rawName);

  cleanName = cleanName.replace(/[^a-z0-9. \-_]/gi, '_');

  const ext = path.extname(cleanName);
  const base = path.basename(cleanName, ext);

  const shortenedBase = base.substring(0, maxLength);

  return `${shortenedBase}${ext}`;
}

getBook('It', 'Stephen King');