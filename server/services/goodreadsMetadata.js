const { chromium } = require("playwright");

function cleanText(s) {
    if (!s) return null;
    return s.replace(/\s+/g, " ").trim() || null;
}

function parseIntFromText(s) {
    if (!s) return null;
    const digits = s.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : null;
}

async function getJsonLdBook(page) {
    const scripts = page.locator('script[type="application/ld+json"]');
    const count = Math.min(await scripts.count(), 12);

    for (let i = 0; i < count; i++) {
        try {
            const raw = (await scripts.nth(i).innerText({ timeout: 2000 })).trim();
            if (!raw) continue;

            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];

            for (const obj of items) {
                if (!obj || typeof obj !== "object") continue;

                const name = obj.name;
                const image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
                const page_count = obj.numberOfPages !=null
                    ? parseIntFromText(String(obj.numberOfPages))
                    : null;
                const language = obj.inLanguage;
                const agg = obj.aggregateRating || {};
                if (name && (agg.ratingValue || agg.ratingCount)) {
                    return {
                        title: cleanText(String(name)),
                        average_rating: agg.ratingValue != null ? Number(agg.ratingValue) : null,
                        ratings_count: agg.ratingCount != null ? Number(agg.ratingCount) : null,
                        cover_image_url: image,
                        page_count,
                        language,
                        isbn: obj.isbn != null ? String(obj.isbn) : null,

                    };
                }
            }
        } catch {
            // ignore
        }
    }
    return { title: null, average_rating: null, ratings_count: null, page_count: null, language: null, isbn:null, cover_image_url: null };

}

class GoodreadsMetadata {
    constructor(opts = {}) {
        this.headless = opts.headless ?? true;

        // Optional proxy parity with your Python script
        this.proxyServer = opts.proxyServer ?? process.env.PROXY_SERVER;
        this.proxyUser = opts.proxyUser ?? process.env.PROXY_USER;
        this.proxyPass = opts.proxyPass ?? process.env.PROXY_PASS;

        this.browser = null;
        this.context = null;
        this.page = null;
    }

    async init() {
        if (this.browser) return; // already initialized

        this.browser = await chromium.launch({
            executablePath: "/snap/bin/chromium",
            headless: this.headless,
            args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        });

        const contextOpts = {
            locale: "en-US",
            viewport: { width: 1280, height: 900 },
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        };

        if (this.proxyServer && this.proxyUser && this.proxyPass) {
            contextOpts.proxy = {
                server: this.proxyServer,
                username: this.proxyUser,
                password: this.proxyPass,
            };
        }

        this.context = await this.browser.newContext(contextOpts);
        //this.page = await this.context.newPage();
    }

    async close() {
        // Close in reverse order
        if (this.page) {
            try { await this.page.close(); } catch {}
            this.page = null;
        }
        if (this.context) {
            try { await this.context.close(); } catch {}
            this.context = null;
        }
        if (this.browser) {
            try { await this.browser.close(); } catch {}
            this.browser = null;
        }
    }

    async getMetadata(bookInfo) {
        const { isbn, isbn_13, title, author } = bookInfo;

        await this.init();
        const page = await this.context.newPage();

        try {
            await page.waitForTimeout(Math.floor(Math.random() * 2000) + 500);
            const isbnToTry = isbn || isbn_13;
            if (isbnToTry) {
                const result = await this.fetchByIsbn(isbnToTry, page);
                if (result && !result.error) return result;
            }

            if (isbn && isbn_13 && isbnToTry === isbn) {
                const result = await this.fetchByIsbn(isbn_13, page);
                if (result && !result.error) return result;
            }

            if (title) {
                const result = await this.searchByTitleAuthor(title, author, page);
                if (result) return result;
            }

            return null;
        } finally {
            await page.close().catch(() => {});
        }

    }

    async searchByTitleAuthor(title, author, page) {
        if (!title && !author) throw new Error("Missing Title/Author");
        if (!page) throw new Error("Client not initialized. Call init() first.");

        const url = new URL('https://www.goodreads.com/search');

        url.searchParams.set("q", author ? `${title} ${author}` : title);
        
        await page.goto(url.toString(), {waitUntil: "domcontentloaded", timeout: 60000});
        const href = await page.locator('a.bookTitle').first().getAttribute('href');
        if (!href) return null;

        const bookUrl = href.startsWith('http') ? href : `https://www.goodreads.com${href}`;

        await page.goto(bookUrl, {waitUntil: "domcontentloaded", timeout: 60000});

        return await this.scrapePage(page);

    }


    async fetchByIsbn(isbn, page) {
        if (!isbn) throw new Error("Missing ISBN");
        if (!page) throw new Error("Client not initialized. Call init() first.");

        const url = `https://www.goodreads.com/book/isbn/${encodeURIComponent(isbn)}`;

        let resp;
        try {
            resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        } catch (err) {
            console.warn(`[GoodreadsMetadata] fetchByIsbn navigation failed for ${isbn}: ${err.message}`);
            return { isbn: String(isbn), error: err.message, book_url: url };
        }
        
        const status = resp ? resp.status() : null;
        if (status && status >= 400) {
            return {
                isbn: String(isbn),
                error: `HTTP ${status}`,
                book_url: url,
            };
        }
        return await this.scrapePage(page);


    }
    async scrapePage(page) {

        try {
            const showMoreBtn = page.locator(
                '[data-testid="description"] button, [data-testid="description"] a'
            );

            if ((await showMoreBtn.count()) > 0) {
                const text = (await showMoreBtn.first().innerText()).toLowerCase();
                if (text.includes("show more") || text.includes("more")) {
                    await showMoreBtn.first().click({ timeout: 3000});
                    await page.waitForTimeout(300);
                }
            }
        } catch {
        }

        let description = null;
        const desc = page.locator('[data-testid="description"]');
        if ((await desc.count()) > 0) {
            description = cleanText(await desc.first().innerText());
        }

        let categories = [];
        const genreEls = page.locator(
            '.BookPageMetadataSection__genreButton .Button__labelItem'
        );

        if ((await genreEls.count()) > 0) {
            categories = await genreEls.evaluateAll(els =>
                els
                    .map(e => (e.textContent || '').trim())
                    .filter(Boolean)
            );

            categories = [...new Set(categories)];
        }


        // --- After clicking detailsButton and waiting a moment ---
        const detailsRoot = page.locator("div.EditionDetails");

// Helper to read a DescListItem value by its <dt> label text
        const readDetail = async (label) => {
            const dd = detailsRoot.locator(
                `div.DescListItem:has(dt:has-text("${label}")) dd div[data-testid="contentContainer"]`
            );
            if ((await dd.count()) === 0) return null;
            if (label === 'isbn') {
                const text = await dd.first().innerText()
                return text.match(/\b97[89]\d{10}\b/)?.[0] || null;
            } else {
                return cleanText(await dd.first().innerText());
            }
        };

        let published_date = null;
        let publisher = null;

        try {
            const nd = page.locator("script#__NEXT_DATA__");
            if (await nd.count()) {
                const data = JSON.parse(await nd.first().innerText());

                const apollo = data?.props?.pageProps?.apolloState;

                if (apollo) {
                    const bookKey = Object.keys(apollo).find(k => k.startsWith("Book:"));
                    const book = bookKey ? apollo[bookKey] : null;

                    if (book?.details) {
                        const t = book.details.publicationTime;
                        if (typeof t === "number") {
                            published_date = new Date(t).toISOString().slice(0, 10);
                        }
                        publisher = book.details.publisher || null;
                    }
                    if (!published_date) {
                        const workKey = Object.keys(apollo).find(k => k.startsWith("Work:"));
                        const work = workKey ? apollo[workKey] : null;

                        const wt = work?.details?.publicationTime;
                        if (typeof wt === "number") {
                            published_date = new Date(wt).toISOString().slice(0, 10);
                        }
                    }
                }
            }
        } catch {

        }


        // JSON-LD first (fast and stable)
        const jld = await getJsonLdBook(page);

        // Title fallback
        let title = jld.title;
        if (!title) {
            const loc = page.locator('[data-testid="bookTitle"], h1[data-testid="bookTitle"], h1#bookTitle');
            if ((await loc.count()) > 0) title = cleanText(await loc.first().innerText());
        }

        // Author (new Goodreads UI)
        let author = null;
        const a1 = page.locator('.ContributorLink__name[data-testid="name"]');
        if ((await a1.count()) > 0) author = cleanText(await a1.first().innerText());
        if (!author) {
            const a2 = page.locator("a.authorName span");
            if ((await a2.count()) > 0) author = cleanText(await a2.first().innerText());
        }

        // Rating fallback
        let average_rating = jld.average_rating;
        if (average_rating == null) {
            const loc = page.locator(".RatingStatistics__rating, [data-testid='ratingValue'], span[itemprop='ratingValue']");
            if ((await loc.count()) > 0) {
                const raw = cleanText(await loc.first().textContent());
                average_rating = raw ? Number(raw.replace(",", ".")) : null;
                if (Number.isNaN(average_rating)) average_rating = null;
            }
        }

        // Ratings count fallback
        let ratings_count = jld.ratings_count;
        if (ratings_count == null) {
            const loc = page.locator("[data-testid='ratingsCount'], meta[itemprop='ratingCount']");
            if ((await loc.count()) > 0) {
                const tag = await loc.first().evaluate((el) => el.tagName.toLowerCase());
                if (tag === "meta") {
                    const c = await loc.first().getAttribute("content");
                    ratings_count = c && /^\d+$/.test(c) ? Number(c) : null;
                } else {
                    const raw = await loc.first().textContent();
                    ratings_count = parseIntFromText(raw);
                }
            }
        }

        // Cover image (best effort)
        let cover_image_url = jld.cover_image_url;
        if (cover_image_url == null) {
            const img = page.locator("img.ResponsiveImage");
            if ((await img.count()) > 0) cover_image_url = await img.first().getAttribute("src");
        }
        let page_count = jld.page_count;
        if (page_count == null) {
            const pagesRaw = await readDetail("Pages");
            page_count = pagesRaw ? parseIntFromText(pagesRaw) : null;
        }
        let language = jld.language;
        if (language == null) {
            language = await readDetail("Language");
        }

        let isbn = jld.isbn;
        if (isbn == null) {
            isbn = await readDetail("ISBN");
        }


        return {
            isbn: String(isbn),
            title,
            author,
            average_rating,
            ratings_count,
            cover_image_url,
            description,
            categories,
            published_date,
            publisher,
            page_count,
            language,
            preview_link: page.url(),
        };
    }


}

module.exports = new GoodreadsMetadata();

