import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

const HOST = 'localhost';

async function main() {
  try {
    // 1. Search for the MD5 hash
    console.log('Searching for book...');
    const searchRes = await fetch(`http://${HOST}:8001/search?title=linux&per_page=1`);
    const searchData = await searchRes.json();
    const md5 = searchData.results?.[0]?.md5;

    if (!md5) {
      throw new Error('No results or MD5 found.');
    }
    console.log(`Found MD5: ${md5}`);

    // 2. Queue the download
    console.log('Queueing download...');
    const queueRes = await fetch(`http://${HOST}:8000/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ md5 })
    });
    const queueData = await queueRes.json();
    const dlId = queueData.id;
    console.log(`Download queued. ID: ${dlId}`);

    // 3. Poll progress until status is "done" (or equivalent completion status)
    let isDone = false;
    while (!isDone) {
      // Wait 2 seconds between polls so you don't spam the server
      await new Promise(resolve => setTimeout(resolve, 2000));

      const progressRes = await fetch(`http://${HOST}:8000/downloads/${dlId}`);
      const progress = await progressRes.json();
      
      const { status, pieces_have, pieces_total } = progress;
      console.log(`Status: ${status} | Pieces: ${pieces_have}/${pieces_total}`);

      // Adjust "done" or "finished" based on your specific API's success status
      if (status === 'done' || status === 'finished' || pieces_have === pieces_total) {
        isDone = true;
      }
    }

    // 4. Retrieve and save the file
    console.log('Downloading file...');
    const fileRes = await fetch(`http://${HOST}:8000/downloads/${dlId}/file`);
    
    if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.statusText}`);

    // Parse filename from Content-Disposition header, or fallback to a default name
    const contentDisposition = fileRes.headers.get('content-disposition');
    const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `downloaded_${dlId}.file`;

    // Stream the file directly to disk to keep memory usage low
    const fileStream = fs.createWriteStream(filename);
    await pipeline(fileRes.body, fileStream);
    
    console.log(`🎉 File successfully saved as: ${filename}`);

  } catch (error) {
    console.error('❌ An error occurred:', error.message);
  }
}

main();
