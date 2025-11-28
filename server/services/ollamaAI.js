const { Ollama } = require('ollama');

class OllamaAIService {
  constructor() {
    this.client = null;
    this.model = process.env.OLLAMA_MODEL || 'llama2';
    this.host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    this.isAvailable = false;
  }

  async initialize() {
    try {
      this.client = new Ollama({ host: this.host });

      // Test connection
      await this.client.list();
      this.isAvailable = true;
      console.log(`✓ Ollama AI service connected (${this.host})`);
    } catch (error) {
      console.warn('Ollama AI service not available:', error.message);
      this.isAvailable = false;
    }
  }

  async isServiceAvailable() {
    return this.isAvailable;
  }

  /**
   * Generate book summary
   * @param {Object} book - Book object with title, author, description
   * @returns {Promise<string>} - AI-generated summary
   */
  async generateBookSummary(book) {
    if (!this.isAvailable) {
      throw new Error('Ollama AI service is not available');
    }

    const prompt = `Generate a concise 2-3 sentence summary for the following book:

Title: ${book.title}
Author: ${book.author}
${book.description ? `Description: ${book.description}` : ''}

Please provide an engaging summary that highlights the main themes and appeal of the book.`;

    try {
      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        stream: false
      });

      return response.response.trim();
    } catch (error) {
      console.error('Failed to generate summary:', error);
      throw new Error('Failed to generate book summary');
    }
  }

  /**
   * Get personalized book recommendations
   * @param {Array} readingHistory - Array of books user has read
   * @param {Array} availableBooks - Array of books in library
   * @param {number} limit - Number of recommendations
   * @returns {Promise<Array>} - Array of recommended book IDs with reasons
   */
  async getRecommendations(readingHistory, availableBooks, limit = 5) {
    if (!this.isAvailable) {
      throw new Error('Ollama AI service is not available');
    }

    const historyText = readingHistory
      .map(book => `- ${book.title} by ${book.author}`)
      .join('\n');

    const availableText = availableBooks
      .map((book, idx) => `${idx + 1}. ${book.title} by ${book.author} (ID: ${book.id})`)
      .join('\n');

    const prompt = `Based on the following reading history, recommend ${limit} books from the available library.

Reading History:
${historyText}

Available Books:
${availableText}

Please respond with ONLY a JSON array of recommendations in this exact format:
[
  {"id": book_id, "reason": "brief reason for recommendation"},
  ...
]`;

    try {
      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        stream: false
      });

      // Extract JSON from response
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return [];
    }
  }

  /**
   * Answer questions about a book
   * @param {Object} book - Book object
   * @param {string} question - User's question
   * @returns {Promise<string>} - AI-generated answer
   */
  async answerBookQuestion(book, question) {
    if (!this.isAvailable) {
      throw new Error('Ollama AI service is not available');
    }

    const prompt = `Answer the following question about this book:

Book: ${book.title} by ${book.author}
${book.description ? `Description: ${book.description}` : ''}
${book.series ? `Series: ${book.series}` : ''}

Question: ${question}

Please provide a helpful and informative answer based on the available information.`;

    try {
      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        stream: false
      });

      return response.response.trim();
    } catch (error) {
      console.error('Failed to answer question:', error);
      throw new Error('Failed to answer question about book');
    }
  }

  /**
   * Generate reading insights
   * @param {Array} readingHistory - Array of books with reading progress
   * @returns {Promise<Object>} - Reading insights and statistics
   */
  async generateReadingInsights(readingHistory) {
    if (!this.isAvailable) {
      throw new Error('Ollama AI service is not available');
    }

    const booksText = readingHistory
      .map(book => `- ${book.title} by ${book.author} (${book.genre || 'Unknown genre'})`)
      .join('\n');

    const prompt = `Analyze the following reading history and provide insights:

${booksText}

Please provide:
1. Preferred genres (top 3)
2. Reading patterns or themes
3. Suggested genres to explore

Format as JSON:
{
  "preferredGenres": ["genre1", "genre2", "genre3"],
  "readingPatterns": "brief description",
  "suggestedGenres": ["genre1", "genre2"]
}`;

    try {
      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        stream: false
      });

      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        preferredGenres: [],
        readingPatterns: 'Unable to analyze patterns',
        suggestedGenres: []
      };
    } catch (error) {
      console.error('Failed to generate insights:', error);
      return {
        preferredGenres: [],
        readingPatterns: 'Unable to analyze patterns',
        suggestedGenres: []
      };
    }
  }

  /**
   * Stream chat response (for interactive AI chat)
   * @param {string} message - User message
   * @param {Array} context - Previous messages for context
   * @returns {AsyncGenerator} - Streaming response
   */
  async *streamChat(message, context = []) {
    if (!this.isAvailable) {
      throw new Error('Ollama AI service is not available');
    }

    const messages = [
      ...context.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    try {
      const stream = await this.client.chat({
        model: this.model,
        messages: messages,
        stream: true
      });

      for await (const chunk of stream) {
        if (chunk.message?.content) {
          yield chunk.message.content;
        }
      }
    } catch (error) {
      console.error('Failed to stream chat:', error);
      throw new Error('Failed to stream chat response');
    }
  }
}

module.exports = new OllamaAIService();
