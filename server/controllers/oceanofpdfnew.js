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
      //const res = await axios.get(url, {
      //headers: {
      //    "User-Agent":
      //      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
      //    Accept: "text/html,*/*",
      //    "Accept-Language": "en-US,en;q=0.9",
      //},
     // timeout: 30000,
    //});

    //const $ = cheerio.load(res.data);

    //const href = $("a[href*='pdf-epub']").first().attr('href');
        
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
    const { data } = await axios.get(bookUrl, {
        headers: {
            "User-Agent":
              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
            Accept: "text/html,*/*",
            "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 30000,
    });

    const $ = cheerio.load(data);
    
    const $form = $('input[name="filename"]').closest('form');

// 2. Grab the URL
    const actionUrl = $form.attr('action');

// 3. Grab the data
    const formData = {};
    $form.find('input').each((i, el) => {
      const name = $(el).attr('name');
      const value = $(el).attr('value');
      if (name) formData[name] = value;
    });

// 4. Log correctly
    console.log("Target URL:", actionUrl);
    console.log("Form Data:", formData);
    
      const res = await axios.post(actionUrl, formData, {
      headers: {
        "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        Accept: "text/html, */*",
        "Accept-Language": "en-US, en;q=0.9",
      },
      timeout: 30000,
        
    }); 
    console.log(res.data);
     await page.content(res.data);
     await page.goto(bookUrl);

    // 2. Listen for the download event BEFORE clicking/submitting
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    // 3. Submit the form using the actual browser engine
    // This ensures the server sees a "real" submit and sends the VM script
    await page.locator('input[name="filename"]').evaluate(el => el.closest('form').submit());

    try {
        console.log("Form submitted. Waiting for the 'VM' script to fire...");
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
      
   // await page.goto('https://oceanofpdf.com');
   // await page.setContent(res.data);
   // console.log("HTML loaded into Playwright. Waiting for download event...");

  
    {/*await page.goto(bookUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

    const pagePromise = context.waitForEvent('page');

    await page.click('input[type="image"][alt="Submit"]');

    const newTab = await pagePromise;
    await newTab.waitForLoadState();

    // Target the specific script tag using a text selector
    
    const scriptHandle = newPage.locator('script:has-text("location.href")');

    // Get the text content from that handle
    const scriptContent = await scriptHandle.textContent();

    const html = res.data;

    // Run your regex on the string
    const regex = /https?:\/\/[^'"]+?expires=[^'"]+/;
    const match = res.data.match(regex);
    console.log(match);
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
}*/}

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

getBook('Cujo', 'Stephen King');
