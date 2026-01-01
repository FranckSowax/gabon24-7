const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const os = require('os');

class GeminiRAGService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️ GEMINI_API_KEY is not set. RAG Service will not function.');
    }
    
    // Initialize standard SDK for chat generation
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.modelName = 'gemini-flash-latest'; 
    this.storeDisplayName = 'Gabon24-7 Knowledge Base';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  getHeaders() {
    return {
      'x-goog-api-key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Find existing store by display name
   */
  async findStore() {
    try {
      let nextPageToken = null;
      do {
        const url = `${this.baseUrl}/fileSearchStores?pageSize=20${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const response = await axios.get(url, { headers: this.getHeaders() });
        
        const stores = response.data.fileSearchStores || [];
        const found = stores.find(s => s.displayName === this.storeDisplayName);
        if (found) return found;

        nextPageToken = response.data.nextPageToken;
      } while (nextPageToken);

      return null;
    } catch (error) {
      console.error('Error listing stores:', error.response?.data || error.message);
      return null;
    }
  }

  /**
   * Create a new store
   */
  async createStore() {
    try {
      const response = await axios.post(
        `${this.baseUrl}/fileSearchStores`,
        { displayName: this.storeDisplayName },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Error creating store:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get or Create the Store
   */
  async getOrCreateStore() {
    const existing = await this.findStore();
    if (existing) {
      return existing;
    }
    console.log(`Creating new store: ${this.storeDisplayName}`);
    return await this.createStore();
  }

  /**
   * Upload content directly to the store
   * content: string (the text content)
   * mimeType: string (default text/plain)
   */
  async uploadContentToStore(storeName, content) {
    try {
      // Use the GoogleAIFileManager for upload
      const { GoogleAIFileManager } = require('@google/generative-ai/server');
      const fileManager = new GoogleAIFileManager(this.apiKey);
      
      const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}.txt`);
      fs.writeFileSync(tempPath, content);
      
      console.log(`Uploading file to Gemini Files...`);
      const uploadResponse = await fileManager.uploadFile(tempPath, {
        mimeType: 'text/plain',
        displayName: `Articles Batch ${new Date().toISOString()}`
      });
      
      console.log(`File uploaded: ${uploadResponse.file.name}`);
      
      // Import to Store using REST
      console.log(`Importing ${uploadResponse.file.name} to store ${storeName}...`);
      const importUrl = `${this.baseUrl}/${storeName}:importFile`;
      const importResponse = await axios.post(importUrl, {
        fileName: uploadResponse.file.name
      }, { headers: this.getHeaders() });
      
      // Clean up temp file
      fs.unlinkSync(tempPath);
      
      return importResponse.data;
      
    } catch (error) {
      console.error('Error in uploadContentToStore:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Chat with RAG
   */
  async chat(query, history = []) {
    try {
      const store = await this.getOrCreateStore();
      const storeName = store.name;
      
      const model = this.genAI.getGenerativeModel({
        model: this.modelName,
        tools: [
          {
            fileSearch: {
                fileSearchStoreNames: [storeName]
            }
          }
        ]
      });

      // Convert history
      const formattedHistory = history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));

      const chatSession = model.startChat({
        history: formattedHistory,
        generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
        }
      });

      const result = await chatSession.sendMessage(query);
      const response = await result.response;
      const text = response.text();
      
      return {
        text,
        success: true
      };
    } catch (error) {
      console.error('Chat RAG Error:', error);
      return {
        success: false,
        error: error.message,
        text: "Désolé, je rencontre des difficultés pour accéder à ma base de connaissances pour le moment."
      };
    }
  }
}

module.exports = GeminiRAGService;
