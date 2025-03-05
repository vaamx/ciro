import { QdrantService } from '../services/qdrant.service';
import { v4 as uuidv4 } from 'uuid';
import { getServiceRegistry } from '../services/service-registry';

async function testQdrantIdFormat() {
  const qdrantService = QdrantService.getInstance();
  const collectionName = 'test_id_format_' + Date.now();
  
  console.log(`Creating collection: ${collectionName}`);
  await qdrantService.createCollection(collectionName, {
    vectors: {
      size: 3, // Small test vector size
      distance: 'Cosine'
    }
  });
  
  console.log('Upserting vectors with plain UUIDs...');
  
  const points = [
    {
      id: uuidv4(),
      vector: [0.1, 0.2, 0.3],
      payload: { text: 'Test point 1' }
    },
    {
      id: uuidv4(),
      vector: [0.4, 0.5, 0.6],
      payload: { text: 'Test point 2' }
    },
    {
      id: uuidv4(),
      vector: [0.7, 0.8, 0.9],
      payload: { text: 'Test point 3' }
    }
  ];
  
  console.log(`Points to upload: ${JSON.stringify(points.map(p => ({ id: p.id })))}`);
  
  try {
    await qdrantService.upsertVectors(collectionName, points);
    console.log('Successfully upserted points with UUID format');
    
    // Check if points were actually stored
    const info = await qdrantService.getCollectionInfo(collectionName);
    console.log(`Collection info: ${JSON.stringify(info)}`);
    
    // Search for the points - using the correct parameter order: collectionName, queryVector, filter, limit
    const searchResult = await qdrantService.search(collectionName, [0.1, 0.2, 0.3], undefined, 10);
    console.log(`Search found ${searchResult.length} points`);
    console.log(`First search result: ${JSON.stringify(searchResult[0])}`);
  } catch (error) {
    console.error(`Error testing UUID format: ${error}`);
    console.error(error);
  }
}

// Run the test
testQdrantIdFormat()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed:', err)); 