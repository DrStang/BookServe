import axios from 'axios';
import { chromium } from 'playwright';
import { finished } from 'node:stream/promises';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const browser = await chromium.launch();
const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36"
});
const page = await context.newPage();

async function searchOceanOfPDF(title, author) {
  try {
    // Construct search query URL
    const params = new URLSearchParams();
    params.set('s', `${title} ${author}`);
    const url = `https://oceanofpdf.com/?${params.toString()}`;
    console.log(url);
    const res = await axios.get(url, {
      headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
          Accept: "text/html,*/*",
          "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 30000,
    });

    const $ = cheerio.load(res.data);

    const href = $("a[href*='pdf-epub']").first().attr('href');
        
    // Parse and extract relevant links
    //const linkSelector = 'a.entry-image-link';

    //const linkLocator = page.locator(linkSelector);
    //if (await linkLocator.count() === 0) {
    //  console.error("No search results found");
    //  await page.screenshot({ path: 'debug.png' });
    //  return null;
    //}

    //const href = await linkLocator.first().getAttribute('href');

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

     await page.goto(bookUrl);

    // 2. Listen for the download event BEFORE clicking/submitting
    const newPagePromise = context.waitForEvent('page');
    // 3. Submit the form using the actual browser engine
    // This ensures the server sees a "real" submit and sends the VM script
    await page.locator('input[name="filename"]').first().evaluate(el => el.closest('form').submit());
    const downloadPage = await NewPagePromise;
    const downloadPromise = downloadPage.waitForEvent('download', { timeout: 30000 });

    try {
        console.log("Form submitted. Waiting for the 'VM' script to fire...");
        console.log(await page.content());
        const download = await downloadPromise;
        
        // SUCCESS!
        const finalUrl = download.url();
        console.log("Captured Download URL:", finalUrl);
        
        await download.saveAs('./' + download.suggestedFilename());
        console.log("File saved!");

    } catch (err) {
        console.error("Download didn't start. Let's look for the link in the page content...");
        // If the download event doesn't fire, we check for the link in the HTML
        const html = await page.content();
        const match = html.match(/https?:\/\/[^'"]+?expires=[^'"]+/);
        if (match) console.log("Found URL via Regex in Playwright:", match[0]);
    }

    await browser.close();
}


getBook('Cujo', 'Stephen King');
