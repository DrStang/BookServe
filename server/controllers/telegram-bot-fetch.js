// telegram-bot-fetch.js
// Send a message to a Telegram bot (as your user account), "click" the
// /link_… it replies with, and download the first file it sends back.
//
// Use as a module:
//   const { connect, fetchFileFromBot } = require("./telegram-bot-fetch");
//   const client = await connect();
//   const result = await fetchFileFromBot(client, { bot: "@SomeBot", message: "/getfile" });
//   console.log(result.path);
//   await client.disconnect();
//
// Or from the command line (also how you do the one-time login):
//   TG_API_ID=12345 TG_API_HASH=abc123 TG_BOT=@SomeBot node telegram-bot-fetch.js "/getfile"

const fs = require("fs");
const path = require("path");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const DEFAULTS = {
  linkPattern: /\/book_\w+/,   // what the bot's link looks like
  linkTimeoutMs: 60_000,       // wait for the link
  fileTimeoutMs: 300_000,      // wait for the file after clicking
  pollMs: 2_000,
  //outDir: path.join(process.cwd(), "downloads"),
  outDir: process.env.BOOKS_STORAGE_PATH,
  saveToDisk: true,            // false = only return the Buffer
  nameFromInfo: true,         //name the file from the bot's message before the file
  nameLines: 2,               //how many lines of that message to use
  nameSeparator: "-",
  maxNameLength: 150,
  debug: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFile(m) {
  return !!m.media && m.media.className !== "MessageMediaWebPage";
}

function startParamFrom(url) {
  const match = /t\.me\/[\w_]+\?start=([\w-]+)/i.exec(url || "");
  return match ? match[1] : null;
}

// ---- File naming helpers ----

//Strip characters that are illegal in file names
function cleanPart(s) {
  return (s || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s.\-_]+|[\s.\-_]+$/g, "")
    .trim();
}

function tidyCase(s) {
  if (s === s.toUpperCase() && /\p{L}/u.test(s)) {
    return s.toLowerCase().replace(/(^|[\s(\-])(\p{L})/gu, (_, pre, ch) => pre + ch.toUpperCase());
  }
  return s;
}

function nameFromText(text, opts) {
  const lines = (text || "")
    .split(/\r?\n/)
    .map(cleanPart)
    .filter(Boolean)
    .slice(0, opts.nameLines)
    .map(tidyCase);
  return lines.length ? lines.join(opts.nameSeparator) : null;
}

function buildFileName(fileMsg, infoMsg, opts) {
  const original = fileMsg.file?.name || `file_${fileMsg.id}${fileMsg.file?.ext || ""}`;
  const ext = path.extname(original) || fileMsg.file?.ext || "";

  let base = null;
  if (opts.nameFromInfo) {
    base = nameFromText(infoMsg?.message, opts) || nameFromText(fileMsg.message, opts);
  }

  if (!base) base = cleanPart(path.basename(original, ext)) || `file_${fileMsg.id}`;

  return base.slice(0, opts.maxNameLength).trim() + ext;
}  
  

// Work out what "clicking" the link in this message means.
function findLinkAction(m, linkPattern) {
  const known = linkPattern.exec(m.message || "");
  if (known) return { kind: "send", text: known[0] };

  for (const [i, row] of (m.replyMarkup?.rows || []).entries()) {
    for (const [j, btn] of row.buttons.entries()) {
      if (btn.className === "KeyboardButtonCallback") return { kind: "callback", i, j };
      if (btn.className === "KeyboardButtonUrl") {
        const param = startParamFrom(btn.url);
        if (param) return { kind: "send", text: `/start ${param}` };
      }
      if (btn.className === "KeyboardButton") return { kind: "send", text: btn.text };
    }
  }

  const text = m.message || "";
  for (const e of m.entities || []) {
    const part = text.substr(e.offset, e.length);
    if (e.className === "MessageEntityBotCommand") return { kind: "send", text: part };
    const url = e.className === "MessageEntityTextUrl" ? e.url
              : e.className === "MessageEntityUrl" ? part : null;
    const param = startParamFrom(url);
    if (param) return { kind: "send", text: `/start ${param}` };
  }
  return null;
}

async function waitFor(client, bot, afterId, matches, what, timeoutMs, opts) {
  const deadline = Date.now() + timeoutMs;
  const seen = new Set();
  while (Date.now() < deadline) {
    await sleep(opts.pollMs);
    const replies = await client.getMessages(bot, { minId: afterId, limit: 50 });
    if (opts.debug) {
      for (const m of replies) {
        const key = `${m.id}:${m.editDate || 0}`;
        if (seen.has(key)) continue;
        seen.add(key);
        console.log(`[telegram-bot-fetch] #${m.id} ${m.out ? "me " : "bot"} ` +
          `media=${m.media?.className || "none"} text=${JSON.stringify(m.message)}`);
      }
    }
    const hit = replies.filter((m) => !m.out && matches(m)).sort((a, b) => a.id - b.id)[0];
    if (hit) return hit;
  }
  throw new Error(`Timed out waiting for ${what}`);
}

//The bots' last text-only message
async function findInfoMessage(client, bot, afterId, fileMsg) {
  const between = await client.getMessages(bot, { minId: afterId, maxId: fileMsg.id, limit: 20 });
  return between
    .filter((m) => !m.out && !hasFile(m) && (m.message || "").trim())
    .sort((a, b) => b.id - a.id)[0] || null;
}  

/**
 * Connect using a saved session. Set interactive: true only for the
 * one-time login (it prompts in the terminal for phone/code/password).
 */
async function connect({
  apiId = Number(process.env.TG_API_ID),
  apiHash = process.env.TG_API_HASH,
  sessionFile = path.join(__dirname, "session.txt"),
  interactive = false,
} = {}) {
  if (!apiId || !apiHash) {
    throw new Error("Missing apiId/apiHash (set TG_API_ID and TG_API_HASH, from https://my.telegram.org)");
  }
  const saved = fs.existsSync(sessionFile) ? fs.readFileSync(sessionFile, "utf8").trim() : "";
  const client = new TelegramClient(new StringSession(saved), apiId, apiHash, {
    connectionRetries: 5,
  });

  if (!saved && !interactive) {
    throw new Error(`No saved session at ${sessionFile}. Run "node telegram-bot-fetch.js" once to log in.`);
  }

  if (interactive) {
    const input = require("input");
    await client.start({
      phoneNumber: async () => input.text("Phone number (with +country code): "),
      password: async () => input.text("2FA password (if you have one): "),
      phoneCode: async () => input.text("Login code Telegram sent you: "),
      onError: (err) => console.error(err),
    });
    fs.writeFileSync(sessionFile, client.session.save());
  } else {
    await client.connect();
    if (!(await client.checkAuthorization())) {
      throw new Error(`Saved session at ${sessionFile} is no longer valid. Log in again from the command line.`);
    }
  }
  return client;
}

/**
 * Send `message` to `bot`, click the link it replies with, download the file.
 * Returns { name, buffer, path } (path is null when saveToDisk is false).
 */
async function fetchFileFromBot(client, { bot, message, ...options }) {
  if (!bot || !message) throw new Error("fetchFileFromBot needs { bot, message }");
  const given = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined));
  const opts = { ...DEFAULTS, ...given };
  const log = (...a) => opts.debug && console.log("[telegram-bot-fetch]", ...a);

  const botEntity = await client.getEntity(bot);

  const sent = await client.sendMessage(botEntity, { message });
  log(`Sent "${message}" to ${bot}`);

  const first = await waitFor(client, botEntity, sent.id,
    (m) => hasFile(m) || findLinkAction(m, opts.linkPattern),
    "the link", opts.linkTimeoutMs, opts);

  let fileMsg = first;
  let infoMsg = null;
  if (!hasFile(first)) {
    const action = findLinkAction(first, opts.linkPattern);
    let afterId = first.id;
    if (action.kind === "callback") {
      log("Pressing button");
      await first.click({ i: action.i, j: action.j });
    } else {
      log(`Clicking link -> sending "${action.text}"`);
      const reply = await client.sendMessage(botEntity, { message: action.text });
      afterId = reply.id;
    }
    fileMsg = await waitFor(client, botEntity, afterId, hasFile, "the file", opts.fileTimeoutMs, opts);

    if (opts.nameFromInfo) {
      infoMsg = await findInfoMessage(client, botEntity, afterId, fileMsg);
      log(infoMsg ? `Naming from #${infoMsg.id}: ${JSON.stringify(infoMsg.message)}`
                  : "No info message found; using the file's own name")
    }  
  }

  const buffer = await client.downloadMedia(fileMsg, {});
  //const name = path.basename(fileMsg.file?.name || `file_${fileMsg.id}${fileMsg.file?.ext || ""}`);
  const name = buildFileName(fileMsg, infoMsg, opts);
  
  let outPath = null;
  if (opts.saveToDisk) {
    fs.mkdirSync(opts.outDir, { recursive: true });
    outPath = path.join(opts.outDir, name);
    fs.writeFileSync(outPath, buffer);
    log(`Saved ${outPath} (${buffer.length} bytes)`);
  }
  return { name, buffer, path: outPath };
}

module.exports = { connect, fetchFileFromBot };

// ---- Command-line use: node telegram-bot-fetch.js "/getfile" ----
if (require.main === module) {
  (async () => {
    const client = await connect({ interactive: true });
    try {
      const result = await fetchFileFromBot(client, {
        bot: process.env.TG_BOT || "@SomeBot",
        message: process.argv[2] || "/start",
        outDir: path.join(__dirname, "downloads"),
        linkPattern: process.env.TG_LINK_PATTERN ? new RegExp(process.env.TG_LINK_PATTERN) : undefined,
        debug: true,
      });
      console.log(`Saved ${result.path} (${result.buffer.length} bytes)`);
    } finally {
      await client.disconnect();
    }
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
