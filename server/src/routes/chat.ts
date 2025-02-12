import express from 'express';
import { OpenAIService } from '../infrastructure/llm/openai';
import { produceMessage, TOPICS } from '../infrastructure/kafka';
import { pool } from '../infrastructure/database';
import { executeQuery } from '../infrastructure/connectors/factory';

const router = express.Router();
const openai = new OpenAIService();

// Get chat history
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const result = await pool.query(
      'SELECT * FROM chat_messages WHERE session_id = $1 ORDER BY timestamp ASC',
      [sessionId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Send a message
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message, dataSource } = req.body;

    // 1. Save user message
    const userMessage = {
      sessionId,
      type: 'user',
      content: message,
      timestamp: new Date()
    };

    await pool.query(
      'INSERT INTO chat_messages (session_id, message_type, content) VALUES ($1, $2, $3)',
      [sessionId, 'user', message]
    );

    // 2. Parse the query using OpenAI
    const parsedQuery = await openai.parseDataQuery(message);

    // 3. If data source is specified, fetch data
    let contextData = null;
    if (dataSource || parsedQuery.dataSource) {
      const { data, error } = await executeQuery(
        dataSource || parsedQuery.dataSource,
        message
      );
      
      if (error) {
        throw new Error(error);
      }
      
      contextData = data;
    }

    // 4. Generate visualization suggestion if we have data
    let visualization = null;
    if (contextData) {
      visualization = await openai.suggestVisualization(contextData);
    }

    // 5. Generate AI response with context
    const chatResponse = await openai.generateChatResponse(
      [{ role: 'user', content: message }],
      contextData ? JSON.stringify(contextData) : undefined
    );

    // 6. Save AI response
    const responseMessage = {
      sessionId,
      type: 'assistant',
      content: chatResponse,
      timestamp: new Date(),
      metadata: {
        visualization,
        contextData
      }
    };

    await pool.query(
      'INSERT INTO chat_messages (session_id, message_type, content, metadata) VALUES ($1, $2, $3, $4)',
      [sessionId, 'assistant', chatResponse, JSON.stringify(responseMessage.metadata)]
    );

    // 7. Produce Kafka message for async processing if needed
    await produceMessage(TOPICS.CHAT_MESSAGES, {
      ...responseMessage,
      requiresFollowUp: false
    });

    res.json({
      message: responseMessage,
      visualization,
      contextData
    });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Export the router
export default router; 