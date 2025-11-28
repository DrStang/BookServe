# AI Features Setup & Usage Guide

## 🎯 Quick Start

### Step 1: Configure Your Ollama Server

Edit your `.env` file in the BookServe root directory:

```bash
# Update these lines with your Ollama server details
OLLAMA_HOST=http://YOUR_OLLAMA_SERVER_IP:11434
OLLAMA_MODEL=llama2
```

**Example configurations:**
```bash
# Local Ollama
OLLAMA_HOST=http://localhost:11434

# Remote server on local network
OLLAMA_HOST=http://192.168.1.100:11434

# Remote server with custom port
OLLAMA_HOST=http://ollama-server.local:11434
```

### Step 2: Test Your Connection

```bash
# Test from your BookServe server
curl http://YOUR_OLLAMA_SERVER_IP:11434/api/tags
```

If successful, you'll see a JSON response with available models.

### Step 3: Restart BookServe

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

You should see:
```
✓ Ollama AI
```

## 🚀 Accessing AI Features

Once configured, access AI features through these URLs:

### 1. **AI Recommendations**
**URL:** `http://localhost:3000/ai/recommendations`

- Get personalized book recommendations
- Based on your reading history
- Shows match percentage and reasoning
- Refresh anytime for new suggestions

### 2. **Reading Insights**
**URL:** `http://localhost:3000/ai/insights`

- View your preferred genres
- Analyze reading patterns
- Discover suggested genres to explore
- Updates as you read more books

### 3. **AI Chat**
**URL:** `http://localhost:3000/ai/chat`

- Ask questions about books
- Get reading recommendations
- Discuss book themes and characters
- Interactive conversation interface

## 🔧 Troubleshooting

### "AI service not available"

**Check 1: Verify Ollama is running**
```bash
curl http://YOUR_OLLAMA_SERVER:11434/api/version
```

**Check 2: Verify model is installed**
```bash
# SSH into your Ollama server
ollama list
```

If your model isn't listed:
```bash
ollama pull llama2
# or
ollama pull mistral
```

**Check 3: Check .env configuration**
```bash
cat .env | grep OLLAMA
```

Make sure:
- `OLLAMA_HOST` points to your server (not localhost if it's remote)
- Port is correct (default: 11434)
- No typos in the URL

**Check 4: Network connectivity**
```bash
# From your BookServe server, ping the Ollama server
ping YOUR_OLLAMA_SERVER_IP

# Test the port specifically
nc -zv YOUR_OLLAMA_SERVER_IP 11434
```

### "Unexpected token '<', \"<!DOCTYPE\"..."

This error means BookServe is connecting to something that returns HTML instead of JSON.

**Common causes:**
1. **Wrong URL** - You're hitting a web server instead of Ollama
   - ✅ Correct: `http://192.168.1.100:11434`
   - ❌ Wrong: `http://192.168.1.100` (missing port)
   - ❌ Wrong: `https://192.168.1.100:11434` (HTTPS instead of HTTP)

2. **Ollama not running** - The port is open but Ollama isn't listening
   - Check: `systemctl status ollama` (if using systemd)
   - Or: `ps aux | grep ollama`

3. **Proxy/firewall** - Something is intercepting the request
   - Try accessing from the same machine first
   - Check firewall rules on Ollama server

### Still not working?

**Enable debug logging:**

Edit `server/services/ollamaAI.js` and add more logging:

```javascript
async initialize() {
  try {
    console.log('Connecting to Ollama at:', this.host);
    this.client = new Ollama({ host: this.host });

    const models = await this.client.list();
    console.log('Available models:', models);

    this.isAvailable = true;
    console.log(`✓ Ollama AI service connected (${this.host})`);
  } catch (error) {
    console.error('Ollama connection failed:');
    console.error('Host:', this.host);
    console.error('Error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    this.isAvailable = false;
  }
}
```

## 📊 API Endpoints

For developers or API access:

```bash
# Get AI service status
GET /api/ai/status

# Get recommendations
GET /api/ai/recommendations?limit=5
Authorization: Bearer YOUR_TOKEN

# Get reading insights
GET /api/ai/insights
Authorization: Bearer YOUR_TOKEN

# Get book summary
GET /api/ai/summary/:bookId
Authorization: Bearer YOUR_TOKEN

# Ask question about a book
POST /api/ai/ask/:bookId
Authorization: Bearer YOUR_TOKEN
Body: { "question": "What are the main themes?" }
```

## 🎨 Customization

### Change AI Model

In `.env`:
```bash
# Faster, smaller model
OLLAMA_MODEL=mistral

# Larger, more capable model (requires more RAM)
OLLAMA_MODEL=llama2:13b

# Even larger (requires lots of RAM)
OLLAMA_MODEL=llama2:70b

# Code-focused model
OLLAMA_MODEL=codellama
```

### Adjust Cache Duration

Edit `server/routes/ai.js`:

```javascript
// Cache recommendations for 2 hours instead of 1
await cache.set(cacheKey, enriched, 7200);  // was 3600

// Cache summaries for 48 hours instead of 24
await cache.set(cacheKey, summary, 172800);  // was 86400
```

## 🚦 Performance Tips

1. **Use smaller models for faster responses**
   - `mistral` or `llama2` (7B) are good choices
   - Larger models (13B, 70B) are slower but more capable

2. **Enable Redis caching**
   - AI responses are cached automatically
   - Recommendations: 1 hour
   - Summaries: 24 hours
   - Insights: 6 hours

3. **Dedicated Ollama server**
   - Run Ollama on a separate machine with good CPU/RAM
   - BookServe can be lightweight, Ollama does the heavy lifting

## 📝 Example Workflow

1. **Read some books** in BookServe
2. **Visit** `/ai/insights` to see your reading patterns
3. **Check** `/ai/recommendations` for personalized suggestions
4. **Chat** at `/ai/chat` to ask "What should I read next based on my history?"
5. **Get summaries** of books before reading by visiting a book detail page

## 🎯 Next Steps

- Add AI features to the main Dashboard sidebar
- Integrate recommendations into book detail pages
- Add "AI Summary" button to book cards
- Create reading group discussions with AI

---

**Need help?** Check the main README_NEW_FEATURES.md for more details.
