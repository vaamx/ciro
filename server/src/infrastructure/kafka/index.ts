import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'ciro-ai',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

// Initialize producer
export const producer = kafka.producer();

// Initialize consumer with a specific group ID
export const consumer = kafka.consumer({ 
  groupId: 'ciro-ai-group' 
});

// Topics
export const TOPICS = {
  CHAT_MESSAGES: 'chat-messages',
  DATA_REQUESTS: 'data-requests',
  VISUALIZATION_REQUESTS: 'visualization-requests',
  LLM_REQUESTS: 'llm-requests',
};

// Initialize Kafka connections
export async function initializeKafka() {
  try {
    await producer.connect();
    await consumer.connect();
    
    // Subscribe to relevant topics
    await consumer.subscribe({ 
      topics: Object.values(TOPICS),
      fromBeginning: false 
    });

    console.log('Kafka producer and consumer initialized successfully');
  } catch (error) {
    console.error('Error initializing Kafka:', error);
    throw error;
  }
}

// Helper function to produce messages
export async function produceMessage(topic: string, message: any) {
  try {
    await producer.send({
      topic,
      messages: [{ 
        value: JSON.stringify(message),
        timestamp: Date.now().toString()
      }],
    });
  } catch (error) {
    console.error(`Error producing message to ${topic}:`, error);
    throw error;
  }
}

// Start consuming messages
export async function startConsumer(messageHandler: (message: any) => Promise<void>) {
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        if (!message.value) return;
        
        const parsedMessage = JSON.parse(message.value.toString());
        await messageHandler(parsedMessage);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    },
  });
} 