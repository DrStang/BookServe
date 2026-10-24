process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const axios = require("axios");
const cheerio = require("cheerio");
const { HttpsProxyAgent } = require("https-proxy-agent");

const BASE = "https://www.goodreads.com";

function cleanText(s) {
    if (!s) return null;
    return s.replace(/\s+/g, " ").trim() || null;
}

function parseIntFromText(s) {
    if (!s) return null;
    const digits = s.replace(/[^\d]/g, "");
    return digits ? parseInt(digits, 10) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getJsonLdBook($) {
    const empty = {
        title: null,
        average_rating: null,
        ratings_count: null,
        page_count: null,
        language: null,
        isbn: null,
        cover_image_url: null,
    };

    const scripts = $('script[type="application/ld+json"]').slice(0, 12);

    for (const el of scripts.toArray()) {
        try {
            const raw = $(el).contents().text().trim();
            if (!raw) continue;

            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];

            for (const obj of items) {
                if (!obj || typeof obj !== "object") continue;

                const name = obj.name;
                const image = Array.isArray(obj.image) ? obj.image[0] : obj.image;
                const page_count =
                    obj.numberOfPages != null ? parseIntFromText(String(obj.numberOfPages)) : null;
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
            // ignore malformed JSON-LD
        }
    }
    return empty;
}

// Pull the Apollo cache out of the Next.js payload (server-rendered, so no JS needed)
function getApolloState($) {
    try {
        const raw = $("script#__NEXT_DATA__").contents().text();
        if (!raw) return null;
        return JSON.parse(raw)?.props?.pageProps?.apolloState || null;
    } catch {
        return null;
    }
}

class GoodreadsMetadata {
    constructor(opts = {}) {
        this.proxyServer = opts.proxyServer ?? process.env.PROXY_SERVER;
        this.timeout = opts.timeout ?? 60000;

        const config = {
            timeout: this.timeout,
            maxRedirects: 5,
            // Don't throw on 4xx/5xx; we handle status ourselves
            validateStatus: () => true,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                    "(KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        };

        if (this.proxyServer) {
            const agent = new HttpsProxyAgent(this.proxyServer);
            config.httpAgent = agent;
            config.httpsAgent = agent;
            config.proxy = false; // let the agent handle proxying
        }

        this.http = axios.create(config);
    }

    // Kept for API compatibility with the Playwright version
    async init() {}
    async close() {}

    async _get(url) {
        const resp = await this.http.get(url, { responseType: "text" });
        return {
            status: resp.status,
            html: typeof resp.data === "string" ? resp.data : String(resp.data ?? ""),
            finalUrl: resp.request?.res?.responseUrl || url,
        };
    }

    async getMetadata(bookInfo) {
        const { isbn, isbn_13, title, author } = bookInfo;

        await sleep(Math.floor(Math.random() * 2000) + 500);

        const isbnToTry = isbn || isbn_13;
        if (isbnToTry) {
            const result = await this.fetchByIsbn(isbnToTry);
            if (result && !result.error) return result;
        }

        if (isbn && isbn_13 && isbnToTry === isbn) {
            const result = await this.fetchByIsbn(isbn_13);
            if (result && !result.error) return result;
        }

        if (title) {
            const result = await this.searchByTitleAuthor(title, author);
            if (result) return result;
        }

        return null;
    }

    async searchByTitleAuthor(title, author) {
        if (!title && !author) throw new Error("Missing Title/Author");

        const url = new URL(`${BASE}/search`);
        url.searchParams.set("q", author ? `${title} ${author}` : title);

        const { status, html } = await this._get(url.toString());
        if (status >= 400) return null;

        const $ = cheerio.load(html);
        const href = $('a[href*="/book/show"]').first().attr("href");
        if (!href) return null;

        const bookUrl = href.startsWith("http") ? href : `${BASE}${href}`;
        const page = await this._get(bookUrl);
        if (page.status >= 400) return null;

        return this.scrapePage(page.html, page.finalUrl);
    }

    async fetchByIsbn(isbn) {
        if (!isbn) throw new Error("Missing ISBN");

        const url = `${BASE}/book/isbn/${encodeURIComponent(isbn)}`;

        let resp;
        try {
            resp = await this._get(url);
        } catch (err) {
            console.warn(`[GoodreadsMetadata] fetchByIsbn request failed for ${isbn}: ${err.message}`);
            return { isbn: String(isbn), error: err.message, book_url: url };
        }

        if (resp.status >= 400) {
            return { isbn: String(isbn), error: `HTTP ${resp.status}`, book_url: url };
        }

        return this.scrapePage(resp.html, resp.finalUrl);
    }

    scrapePage(html, pageUrl) {
        const $ = cheerio.load(html);

        // Description (the full text is already in the DOM; "Show more" only toggles CSS)
        let description = null;
        const desc = $('[data-testid="description"]').first();
        if (desc.length) description = cleanText(desc.text());

        // Genres
        const categories = [
            ...new Set(
                $(".BookPageMetadataSection__genreButton .Button__labelItem")
                    .map((_, el) => $(el).text().trim())
                    .get()
                    .filter(Boolean)
            ),
        ];

        // Apollo state (publication date, publisher, and fallbacks for edition details)
        let published_date = null;
        let publisher = null;
        let apolloPages = null;
        let apolloLanguage = null;
        let apolloIsbn = null;

        try {
            const apollo = getApolloState($);
            if (apollo) {
                const bookKey = Object.keys(apollo).find((k) => k.startsWith("Book:"));
                const book = bookKey ? apollo[bookKey] : null;

                if (book?.details) {
                    const d = book.details;
                    if (typeof d.publicationTime === "number") {
                        published_date = new Date(d.publicationTime).toISOString().slice(0, 10);
                    }
                    publisher = d.publisher || null;
                    apolloPages = d.numPages ?? null;
                    apolloLanguage = d.language?.name ?? null;
                    apolloIsbn = d.isbn13 || d.isbn || null;
                }

                if (!published_date) {
                    const workKey = Object.keys(apollo).find((k) => k.startsWith("Work:"));
                    const work = workKey ? apollo[workKey] : null;
                    const wt = work?.details?.publicationTime;
                    if (typeof wt === "number") {
                        published_date = new Date(wt).toISOString().slice(0, 10);
                    }
                }
            }
        } catch {
            // ignore
        }

        // Fallback reader for the EditionDetails block (only present if rendered in the HTML)
        const readDetail = (label) => {
            const dd = $("div.EditionDetails")
                .find("div.DescListItem")
                .filter((_, el) => $(el).find("dt").text().includes(label))
                .find('dd div[data-testid="contentContainer"]')
                .first();
            if (!dd.length) return null;
            const text = dd.text();
            if (label === "ISBN") return text.match(/\b97[89]\d{10}\b/)?.[0] || null;
            return cleanText(text);
        };

        // JSON-LD first (fast and stable)
        const jld = getJsonLdBook($);

        // Title
        let title = jld.title;
        if (!title) {
            const loc = $('[data-testid="bookTitle"], h1[data-testid="bookTitle"], h1#bookTitle').first();
            if (loc.length) title = cleanText(loc.text());
        }

        // Author
        let author = null;
        const a1 = $('.ContributorLink__name[data-testid="name"]').first();
        if (a1.length) author = cleanText(a1.text());
        if (!author) {
            const a2 = $("a.authorName span").first();
            if (a2.length) author = cleanText(a2.text());
        }

        // Rating fallback
        let average_rating = jld.average_rating;
        if (average_rating == null) {
            const loc = $(
                ".RatingStatistics__rating, [data-testid='ratingValue'], span[itemprop='ratingValue']"
            ).first();
            if (loc.length) {
                const raw = cleanText(loc.text());
                average_rating = raw ? Number(raw.replace(",", ".")) : null;
                if (Number.isNaN(average_rating)) average_rating = null;
            }
        }

        // Ratings count fallback
        let ratings_count = jld.ratings_count;
        if (ratings_count == null) {
            const loc = $("[data-testid='ratingsCount'], meta[itemprop='ratingCount']").first();
            if (loc.length) {
                const tag = (loc.get(0).tagName || "").toLowerCase();
                if (tag === "meta") {
                    const c = loc.attr("content");
                    ratings_count = c && /^\d+$/.test(c) ? Number(c) : null;
                } else {
                    ratings_count = parseIntFromText(loc.text());
                }
            }
        }

        // Cover image
        let cover_image_url = jld.cover_image_url;
        if (cover_image_url == null) {
            const img = $("img.ResponsiveImage").first();
            if (img.length) cover_image_url = img.attr("src") || null;
        }

        // Page count
        let page_count = jld.page_count;
        if (page_count == null) {
            page_count = apolloPages != null ? Number(apolloPages) : null;
        }
        if (page_count == null) {
            const raw = readDetail("Pages");
            page_count = raw ? parseIntFromText(raw) : null;
        }

        // Language
        let language = jld.language;
        if (language == null) language = apolloLanguage;
        if (language == null) language = readDetail("Language");

        // ISBN
        let isbn = jld.isbn;
        if (isbn == null) isbn = apolloIsbn;
        if (isbn == null) isbn = readDetail("ISBN");

        return {
            isbn: isbn != null ? String(isbn) : null,
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
            preview_link: pageUrl,
        };
    }
}

module.exports = new GoodreadsMetadata();
