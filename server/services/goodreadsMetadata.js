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
                const numPages = obj.numberOfPages !=null
                    ? parseIntFromText(String(obj.numberOfPages))
                    : null;
                const language = obj.inLanguage;
                const agg = obj.aggregateRating || {};
                if (name && (agg.ratingValue || agg.ratingCount)) {
                    return {
                        title: cleanText(String(name)),
                        rating: agg.ratingValue != null ? Number(agg.ratingValue) : null,
                        ratings_count: agg.ratingCount != null ? Number(agg.ratingCount) : null,
                        image_url: image,
                        numPages,
                        language,
                    };
                }
            }
        } catch {
            // ignore
        }
    }
    return { title: null, rating: null, ratings_count: null, numPages: null, language: null };

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
            headless: this.headless,
            args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
        });

        const contextOpts = {
            locale: "en-US",
            viewport: { width: 1280, height: 900 },
            userAgent:
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        };

        if (this.proxyServer && this.proxyUser && this.proxyPass) {
            contextOpts.proxy = {
                server: this.proxyServer,
                username: this.proxyUser,
                password: this.proxyPass,
            };
        }

        this.context = await this.browser.newContext(contextOpts);
        this.page = await this.context.newPage();
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

    async fetchByIsbn(isbn) {
        if (!isbn) throw new Error("Missing ISBN");
        if (!this.page) throw new Error("Client not initialized. Call init() first.");

        const url = `https://www.goodreads.com/book/isbn/${encodeURIComponent(isbn)}`;

        const resp = await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        const status = resp ? resp.status() : null;
        if (status && status >= 400) {
            return {
                isbn: String(isbn),
                error: `HTTP ${status}`,
                book_url: url,
            };
        }

        try {
            const showMoreBtn = this.page.locator(
                '[data-testid="description"] button, [data-testid="description"] a'
            );

            if ((await showMoreBtn.count()) > 0) {
                const text = (await showMoreBtn.first().innerText()).toLowerCase();
                if (text.includes("show more") || text.includes("more")) {
                    await showMoreBtn.first().click({ timeout: 3000});
                    await this.page.waitForTimeout(300);
                }
            }
        } catch {
        }

        let description = null;
        const desc = this.page.locator('[data-testid="description"]');
        if ((await desc.count()) > 0) {
            description = cleanText(await desc.first().innerText());
        }

        let genres = [];
        const genreEls = this.page.locator(
            '.BookPageMetadataSection__genreButton .Button__labelItem'
        );

        if ((await genreEls.count()) > 0) {
            genres = await genreEls.evaluateAll(els =>
                els
                    .map(e => (e.textContent || '').trim())
                    .filter(Boolean)
            );

            genres = [...new Set(genres)];
        }


        // --- After clicking detailsButton and waiting a moment ---
        const detailsRoot = this.page.locator("div.EditionDetails");

// Helper to read a DescListItem value by its <dt> label text
        const readDetail = async (label) => {
            const dd = detailsRoot.locator(
                `div.DescListItem:has(dt:has-text("${label}")) dd div[data-testid="contentContainer"]`
            );
            if ((await dd.count()) === 0) return null;
            return cleanText(await dd.first().innerText());
        };

        let publishedOn = null;
        let publishedBy = null;

        try {
            const nd = this.page.locator("script#__NEXT_DATA__");
            if (await nd.count()) {
                const data = JSON.parse(await nd.first().innerText());

                const apollo = data?.props?.pageProps?.apolloState;

                if (apollo) {
                    const bookKey = Object.keys(apollo).find(k => k.startsWith("Book:"));
                    const book = bookKey ? apollo[bookKey] : null;

                    if (book?.details) {
                        const t = book.details.publicationTime;
                        if (typeof t === "number") {
                            publishedOn = new Date(t).toISOString().slice(0, 10);
                        }
                        publishedBy = book.details.publisher || null;
                    }
                    if (!publishedOn) {
                        const workKey = Object.key(apollo).find(k => k.startsWith("Work:"));
                        const work = workKey ? apollo[workKey] : null;

                        const wt = work?.details?.publicationTime;
                        if (typeof wt === "number") {
                            publishedOn = new Date(wt).toISOString().slice(0, 10);
                        }
                    }
                }
            }
        } catch {

        }


        // JSON-LD first (fast and stable)
        const jld = await getJsonLdBook(this.page);


        // Title fallback
        let title = jld.title;
        if (!title) {
            const loc = this.page.locator('[data-testid="bookTitle"], h1[data-testid="bookTitle"], h1#bookTitle');
            if ((await loc.count()) > 0) title = cleanText(await loc.first().innerText());
        }

        // Author (new Goodreads UI)
        let author = null;
        const a1 = this.page.locator('.ContributorLink__name[data-testid="name"]');
        if ((await a1.count()) > 0) author = cleanText(await a1.first().innerText());
        if (!author) {
            const a2 = this.page.locator("a.authorName span");
            if ((await a2.count()) > 0) author = cleanText(await a2.first().innerText());
        }

        // Rating fallback
        let rating = jld.rating;
        if (rating == null) {
            const loc = this.page.locator(".RatingStatistics__rating, [data-testid='ratingValue'], span[itemprop='ratingValue']");
            if ((await loc.count()) > 0) {
                const raw = cleanText(await loc.first().textContent());
                rating = raw ? Number(raw.replace(",", ".")) : null;
                if (Number.isNaN(rating)) rating = null;
            }
        }

        // Ratings count fallback
        let ratings_count = jld.ratings_count;
        if (ratings_count == null) {
            const loc = this.page.locator("[data-testid='ratingsCount'], meta[itemprop='ratingCount']");
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
        let image_url = jld.image_url;
        if (image_url == null) {
            const img = this.page.locator("img.ResponsiveImage");
            if ((await img.count()) > 0) image_url = await img.first().getAttribute("src");
        }
        let numPages = jld.numPages;
        if (numPages == null) {
            const pagesRaw = await readDetail("Pages");
            numPages = pagesRaw ? parseIntFromText(pagesRaw) : null;
        }
        let language = jld.language;
        if (language == null) {
            language = await readDetail("Language");
        }


        return {
            isbn: String(isbn),
            title,
            author,
            rating,
            ratings_count,
            image_url,
            description,
            genres,
            publishedOn,
            publishedBy,
            numPages,
            language,
            book_url: this.page.url(),
        };
    }
}

module.exports = { GoodreadsMetadata };
