// chatbot.service.js
// This service replicates the functionality of the ChatbotAPI class from the Flask code in Node.js Express.
// It uses the Google generative AI library (@google/generative-ai) for question/answer generation,
// Pinecone for vector resources, and you can integrate node-nlp or similar for text processing if needed.
//
// Note: This example code is approximate and may require additional configuration to fully work,
// including setting up the node-nlp usage or adopting an alternative embedding approach.
// Also, ensure that your environment variables are set.
//
// This version updates generateMessage as recommended by the official library doc, using prompt.messages
// to avoid the invalid argument error. Also note that the response property holding the text is “content”
// rather than “output.”

const { GoogleGenerativeAI } = require('@google/generative-ai');
// Try different import approach for Pinecone
const pineconeModule = require('@pinecone-database/pinecone');
const Pinecone = pineconeModule.Pinecone || pineconeModule.default || pineconeModule;

// Initialize Gemini AI
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY not found in environment variables');
}

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

// Pinecone initialization
let pineconeClient = null;
let pineconeIndex = null;
const pineconeApiKey = process.env.PINECONE_API_KEY || '';

// Initialize Pinecone asynchronously
async function initializePinecone() {
  if (pineconeApiKey) {
    try {
      // Check if Pinecone is a constructor
      if (typeof Pinecone === 'function') {
        pineconeClient = new Pinecone({
          apiKey: pineconeApiKey
        });
      } else if (typeof Pinecone === 'object' && Pinecone.Client) {
        // Alternative: Pinecone might export a Client class
        pineconeClient = new Pinecone.Client({
          apiKey: pineconeApiKey
        });
      } else {
        console.error('Pinecone import issue - unexpected export format:', typeof Pinecone);
        console.log('Pinecone module contents:', Object.keys(pineconeModule));
        return;
      }
      
      // Initialize Pinecone index
      pineconeIndex = pineconeClient.index('fidhacks');
      console.log('Pinecone index connected successfully.');
    } catch (err) {
      console.error('Pinecone connection error:', err);
    }
  } else {
    console.warn('PINECONE_API_KEY not found. Resource lookup will be disabled.');
  }
}

// Call initialization
initializePinecone().catch(console.error);

// A safe content prefix or instruction to ensure generation is safe
const SAFETY_INSTRUCTION = 'Please ensure generated content is safe and appropriate.';

// ChatbotService implements the same logic as the Python ChatbotAPI, adapted to Node.js
class ChatbotService {
  constructor() {
    // Here we store the last question and answer in memory
    // For a production system, consider a persistent store
    this.currentQuestion = '';
    this.correctAnswer = '';
    this.chat = null;
    this.initChat();
  }

  async initChat() {
    this.chat = model.startChat({
      history: [],
    });
  }

  // generateQuestion: returns a financial literacy question related to the chosen topic
  async generateQuestion(topic = 'financial literacy') {
    try {
      const instruction = `Generate a specific multiple choice or short answer question about ${topic}. Only provide the question, nothing else.`;
      const text = await this.callGeminiAPI(`${SAFETY_INSTRUCTION} ${instruction}`);
      const question = text.replace(/^Question:\s*/i, '').trim();
      this.currentQuestion = question;
      return question;
    } catch (error) {
      console.error('Error generating question:', error);
      this.currentQuestion = 'What factors should you consider when choosing a credit card?';
      return this.currentQuestion;
    }
  }

  // generateAnswer: provides an answer to the last question
  async generateAnswer() {
    if (!this.currentQuestion) {
      return 'No question available.';
    }

    try {
      const instruction = `Provide a clear, concise answer to this question: ${this.currentQuestion}. Give a direct answer without extra formatting.`;
      const text = await this.callGeminiAPI(`${SAFETY_INSTRUCTION} ${instruction}`);
      const answer = text.replace(/^Answer:\s*/i, '').trim();
      this.correctAnswer = answer;
      return answer;
    } catch (error) {
      console.error('Error generating answer:', error);
      this.correctAnswer = 'Unable to generate answer at this time.';
      return this.correctAnswer;
    }
  }

  // evaluateAnswer: compares user_answer with correctAnswer
  async evaluateAnswer(userAnswer) {
    if (!this.currentQuestion) {
      return { is_correct: false, message: 'No question available.' };
    }
    if (!this.correctAnswer) {
      await this.generateAnswer();
    }

    const instruction = `
Question: ${this.currentQuestion}
User's Answer: ${userAnswer}
Correct Answer: ${this.correctAnswer}

Compare the user's answer to the correct answer. If they are similar or the user answer covers key info, respond "CORRECT". Otherwise respond "INCORRECT" with a short explanation.
    `;

    try {
      const text = await this.callGeminiAPI(`${SAFETY_INSTRUCTION} ${instruction}`);
      const evaluationText = text.trim();
      const isCorrect = evaluationText.toUpperCase().includes('CORRECT') 
                     && !evaluationText.toUpperCase().includes('INCORRECT');

      const result = {
        is_correct: isCorrect,
        message: evaluationText,
        correct_answer: this.correctAnswer
      };

      // If incorrect, we can attempt to fetch a relevant resource from Pinecone
      if (!isCorrect && pineconeIndex) {
        const resource = await this.getRelevantResource(this.correctAnswer);
        if (resource) {
          result.resource = resource;
        }
      }
      return result;
    } catch (error) {
      console.error('Error evaluating answer:', error);
      return {
        is_correct: false,
        message: `Error completing evaluation: ${error.message}`,
        correct_answer: this.correctAnswer || 'Answer not available'
      };
    }
  }

  // getRelevantResource: queries Pinecone to find a resource
  async getRelevantResource(queryText) {
    if (!pineconeIndex) {
      return null;
    }

    try {
      // For a real app, you'd embed queryText using some Node-based embedding approach
      // or call out to a microservice or cloud-based embedding service.
      // For placeholder, we'll simulate an embedding as a static array or random.
      const fakeEmbedding = new Array(512).fill(0).map(() => Math.random());

      const queryResponse = await pineconeIndex.query({
        vector: fakeEmbedding,
        topK: 1,
        includeValues: false,
        includeMetadata: true,
        namespace: 'auto_loan_resources'
      });

      if (queryResponse.matches && queryResponse.matches.length) {
        const topMatch = queryResponse.matches[0];
        const meta = topMatch.metadata || {};
        return {
          title: meta.title || 'Financial Resource',
          link: meta.link || '#',
          description: meta.description || ''
        };
      }
    } catch (error) {
      console.error('Error fetching resource from Pinecone:', error);
    }

    return null;
  }

  // handleGeneralQuestion: provides a helpful, educational answer
  async handleGeneralQuestion(question) {
    const instruction = `Answer this financial literacy question: ${question}. Provide a helpful, educational response.`;
    try {
      const text = await this.callGeminiAPI(`${SAFETY_INSTRUCTION} ${instruction}`);
      return text;
    } catch (error) {
      console.error('Error in handleGeneralQuestion:', error);
      return 'I apologize, but I am having trouble answering that question at this time.';
    }
  }

  // generateQuestionWithAnswer: creates both Q and A
  async generateQuestionWithAnswer(topic = 'financial literacy') {
    const instruction = `
Create a financial literacy question about ${topic} and provide its answer.
Format it exactly like this:

QUESTION: [Your question here]
ANSWER: [The correct answer here]

Make the question practical and educational.
    `;

    try {
      const text = await this.callGeminiAPI(`${SAFETY_INSTRUCTION} ${instruction}`);
      const trimmed = text.trim();

      if (trimmed.includes('QUESTION:') && trimmed.includes('ANSWER:')) {
        const parts = trimmed.split('ANSWER:');
        const questionPart = parts[0].replace('QUESTION:', '').trim();
        const answerPart = parts[1].trim();

        this.currentQuestion = questionPart;
        this.correctAnswer = answerPart;
        return questionPart;
      } else {
        // fallback
        this.currentQuestion = 'What is an emergency fund and why is it important?';
        this.correctAnswer = 'An emergency fund is money set aside for unexpected expenses...';
        return this.currentQuestion;
      }
    } catch (error) {
      console.error('Error generating question with answer:', error);
      this.currentQuestion = 'What is an emergency fund and why is it important?';
      this.correctAnswer = 'An emergency fund is money set aside for unexpected expenses...';
      return this.currentQuestion;
    }
  }

  // Helper to send request to Google Generative AI (Gemini)
  async callGeminiAPI(prompt) {
    try {
      const result = await this.chat.sendMessage(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('callGeminiAPI error:', error);
      throw error;
    }
  }

  // Reset the chat context
  resetChat() {
    this.currentQuestion = '';
    this.correctAnswer = '';
    this.initChat();
  }
}

module.exports = new ChatbotService();
