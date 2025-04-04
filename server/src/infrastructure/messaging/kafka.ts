// Handle the import conditionally to avoid build errors
let Kafka: any;
let kafkaImportSucceeded = false;

try {
  const kafkajs = require('kafkajs');
  Kafka = kafkajs.Kafka;
  kafkaImportSucceeded = true;
} catch (error) {
  console.warn('KafkaJS not available:', error);
  // Fallback placeholder
  Kafka = class MockKafka {
    constructor() {
      console.warn('Using mock Kafka implementation');
    }
    producer() { return { connect: async () => {}, send: async () => {} }; }
    consumer() { return { connect: async () => {}, subscribe: async () => {}, run: async () => {} }; }
  };
}

// Define types for clarity
interface KafkaMessage {
  value: Buffer | null;
  timestamp?: string;
  key?: Buffer | null;
  headers?: Record<string, Buffer>;
}

interface EachMessagePayload {
  topic: string;
  partition: number;
  message: KafkaMessage;
}

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
  if (!kafkaImportSucceeded) {
    console.warn('Skipping Kafka initialization as the library is not available');
    return;
  }
  
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
  if (!kafkaImportSucceeded) {
    console.warn('Skipping message production as Kafka is not available');
    return;
  }
  
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
  if (!kafkaImportSucceeded) {
    console.warn('Skipping consumer start as Kafka is not available');
    return;
  }
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
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