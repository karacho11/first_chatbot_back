import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class OpenaiService {
  private readonly logger = new Logger(OpenaiService.name);

  constructor(
    private configService: ConfigService,
    private redisService: RedisService,
  ) {}

  /**
   * Store user name in cache
   */
  async cacheUserName(userName: string): Promise<void> {
    const cacheKey = `user:${userName}:profile`;
    await this.redisService.setJson(cacheKey, { name: userName, cachedAt: new Date() }, 86400); // 24 hours TTL
    this.logger.log(`User name cached: ${userName}`);
  }

  /**
   * Get cached user name
   */
  async getCachedUserName(userName: string): Promise<any | null> {
    const cacheKey = `user:${userName}:profile`;
    return await this.redisService.getJson(cacheKey);
  }

  /**
   * Cache conversation context
   */
  async cacheConversationContext(
    userName: string,
    timestamp: string,
    prompt: string,
    response: string,
  ): Promise<void> {
    const conversationKey = `conversation:${userName}:${timestamp}`;
    const contextData = {
      timestamp,
      prompt,
      response,
      createdAt: new Date(),
    };
    // Cache conversation for 7 days
    await this.redisService.setJson(conversationKey, contextData, 604800);
    this.logger.log(`Conversation cached for ${userName} at ${timestamp}`);
  }

  /**
   * Get cached conversation
   */
  async getCachedConversation(userName: string, timestamp: string): Promise<any | null> {
    const conversationKey = `conversation:${userName}:${timestamp}`;
    return await this.redisService.getJson(conversationKey);
  }

  /**
   * Get complete conversation history for a user
   */
  async getConversationHistory(userName: string): Promise<Array<{ role: string; content: string; timestamp?: string }>> {
    const historyKey = `conversation_history:${userName}`;
    const history = await this.redisService.getJson<Array<{ role: string; content: string; timestamp?: string }>>(historyKey);
    return history || [];
  }

  /**
   * Add message to conversation history
   */
  async addToConversationHistory(userName: string, role: 'user' | 'assistant', content: string): Promise<void> {
    const historyKey = `conversation_history:${userName}`;
    const currentHistory = await this.getConversationHistory(userName);
    
    currentHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });

    // Keep last 50 messages to avoid excessive memory usage
    const trimmedHistory = currentHistory.slice(-50);
    
    // Cache conversation history for 30 days
    await this.redisService.setJson(historyKey, trimmedHistory, 2592000);
    this.logger.log(`Message added to history for ${userName} (total: ${trimmedHistory.length})`);
  }

  /**
   * Clear conversation history for a user
   */
  async clearConversationHistory(userName: string): Promise<void> {
    const historyKey = `conversation_history:${userName}`;
    await this.redisService.del(historyKey);
    this.logger.log(`Conversation history cleared for ${userName}`);
  }

  async createChat(
    prompt: string,
    model?: string,
    temperature?: number,
    timestamp?: string,
    userName?: string,
    now?: string,
    initTime?: string,
    useRag?: boolean,
    documents?: string[],
    topK?: number,
    embeddingModel?: string,
  ): Promise<string> {
    this.logger.log(
      JSON.stringify({
        event: 'createChat',
        prompt,
        model,
        temperature,
        timestamp,
        userName,
        now,
        initTime,
        useRag,
        documentsCount: documents?.length ?? 0,
        topK,
        embeddingModel,
      }),
    );

    // Cache user name if provided
    if (userName) {
      await this.cacheUserName(userName);
    }

    try {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      this.logger.log(JSON.stringify({ event: 'apiKeyCheck', exists: !!apiKey }));

      // Build messages array with optional RAG context and conversation history
      let messages: Array<{ role: string; content: string }> = [];

      if (useRag && documents && documents.length > 0) {
        const selectedDocs = await this.selectTopKDocuments(
          prompt,
          documents,
          topK ?? 3,
          apiKey,
          embeddingModel || 'text-embedding-3-small',
        );

        const contextBlock = selectedDocs
          .map((doc, idx) => `(${idx + 1}) ${doc}`)
          .join('\n');

        messages.push({
          role: 'system',
          content:
            'You are a helpful assistant. Use the provided context to answer the user. ' +
            'If the answer is not in the context, say you do not know.\n\n' +
            `Context:\n${contextBlock}`,
        });
      }

      // Get conversation history if userName is provided
      if (userName) {
        const history = await this.getConversationHistory(userName);
        this.logger.log(`Loaded history for ${userName}:`, JSON.stringify(history));
        // Filter and map to OpenAI compatible format
        messages = history
          .filter(msg => msg && msg.role && msg.content)
          .map(msg => ({
            role: msg.role,
            content: msg.content,
          }));
        this.logger.log(`Processed ${messages.length} messages for OpenAI API`);
      }

      // Add current user message
      messages.push({ role: 'user', content: prompt });

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: model || 'gpt-3.5-turbo',
          messages,
          temperature: temperature ?? 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(JSON.stringify({ event: 'openaiResponse', response: response.data }));
      this.logger.log(JSON.stringify({ event: 'messageContent', content: response.data.choices[0].message.content }));
      const responseContent = response.data.choices[0].message.content || 'No response';

      // Add user message and assistant response to history
      if (userName) {
        await this.addToConversationHistory(userName, 'user', prompt);
        await this.addToConversationHistory(userName, 'assistant', responseContent);
      }

      // Cache conversation if timestamp and userName are provided
      if (timestamp && userName) {
        await this.cacheConversationContext(userName, timestamp, prompt, responseContent);
      }

      return responseContent;
    } catch (error) {
      this.logger.error(JSON.stringify({ event: 'openaiError', error: error.response?.data || error.message }));
      throw new Error(`OpenAI API error: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  private async selectTopKDocuments(
    query: string,
    documents: string[],
    topK: number,
    apiKey: string,
    embeddingModel: string,
  ): Promise<string[]> {
    const inputs = [query, ...documents];
    const embeddings = await this.getEmbeddings(inputs, embeddingModel, apiKey);
    const queryEmbedding = embeddings[0];
    const docEmbeddings = embeddings.slice(1);

    const scored = docEmbeddings.map((embedding, index) => ({
      index,
      score: this.cosineSimilarity(queryEmbedding, embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map(item => documents[item.index]);
  }

  private async getEmbeddings(
    inputs: string[],
    model: string,
    apiKey: string,
  ): Promise<number[][]> {
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model,
        input: inputs,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.data.map((item: { embedding: number[] }) => item.embedding);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}