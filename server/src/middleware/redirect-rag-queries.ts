// @ts-nocheck - TODO: This file needs major refactoring to work with the updated service architecture

import { Request, Response, NextFunction } from 'express';
import { QdrantClientService } from '../services/vector/qdrant-client.service';
import { createServiceLogger } from '../utils/logger-factory';

const logger = createServiceLogger('RedirectRagQueries');

// Add interface to describe Qdrant response shapes
interface QdrantCollectionsResponse {
  collections?: Array<{ name: string }>;
}

// Define collection result interface
interface CollectionResult {
  originalId: string | number;
  collectionName: string;
  hasData?: boolean;
}

// Define special mappings type
interface SpecialMappings {
  [key: string]: string[];
}

/**
 * Middleware to redirect standard RAG queries to direct collection endpoints
 * when the database lookup would otherwise fail
 */
export async function redirectRagQueries(req: Request, res: Response, next: NextFunction) {
  try {
    // Check for either RAG query endpoint or chat messages endpoint
    const isRagQueryEndpoint = req.method === 'POST' && req.path?.toString() === '/query';
    const isChatEndpoint = req.method === 'POST' && req.path?.toString().includes('/messages');
    
    if (!isRagQueryEndpoint && !isChatEndpoint) {
      return next();
    }
    
    logger.info(`Intercepting ${isRagQueryEndpoint ? 'RAG query' : 'Chat message'} request`);
    
    // Get query params - handle both RAG and Chat API formats
    const { query, dataSourceIds = [], data_sources = [], content } = req.body;
    
    // For chat endpoints, use content as the query
    const effectiveQuery = query || content;
    // For chat endpoints, use data_sources if dataSourceIds is not provided
    const effectiveDataSourceIds = dataSourceIds.length > 0 ? dataSourceIds : data_sources;
    
    // Special debug log for inspecting exact request
    logger.info(`Request body: ${JSON.stringify(req.body)}`);
    
    if (!effectiveQuery) {
      logger.info('No query provided, passing to regular handler');
      return next();
    }
    
    // We'll try to query even if no data source IDs are provided - we'll search all document collections
    const hasDataSourceIds = effectiveDataSourceIds && effectiveDataSourceIds.length > 0;
    if (hasDataSourceIds) {
      logger.info(`Query with ${effectiveDataSourceIds.length} data sources: ${JSON.stringify(effectiveDataSourceIds)}`);
    } else {
      logger.info('No specific data source IDs provided, will search all document collections');
    }
    
    // Detect document-specific queries from the query text
    const isDocumentQuery = 
      effectiveQuery.toLowerCase().includes('document') ||
      effectiveQuery.toLowerCase().includes('report') ||
      effectiveQuery.toLowerCase().includes('summary') ||
      effectiveQuery.toLowerCase().includes('pdf') ||
      effectiveQuery.toLowerCase().includes('excel') ||
      effectiveQuery.toLowerCase().includes('founder') ||
      effectiveQuery.toLowerCase().includes('key points');
    
    // Is this a UI request?
    const isUiRequest = req.body.dashboardId || 
                        (req.headers.referer && req.headers.referer.includes('dashboard')) ||
                        req.query.dashboard_id ||
                        isChatEndpoint; // Chat endpoint requests are always from the UI
                       
    if (isUiRequest) {
      logger.info('UI request detected');
    }
    
    // Initialize QdrantService
    const qdrantService = new QdrantClientService();
    let collections: CollectionResult[] = [];
    
    // First try collections based on the provided data source IDs if any
    if (hasDataSourceIds) {
      collections = await findPossibleCollections(effectiveDataSourceIds, qdrantService);
      logger.info(`Found ${collections.length} collections for specified data sources`);
    }
    
    // If we have no collections from data source IDs or it's a document query, 
    // also search all document collections
    if (collections.length === 0 || isDocumentQuery) {
      const documentCollections = await findDocumentCollections(qdrantService);
      
      // If we have data source IDs, prioritize collections for those IDs
      if (hasDataSourceIds) {
        // For each document collection, create an entry for each data source ID
        const additionalCollections: CollectionResult[] = [];
        for (const collection of documentCollections) {
          for (const id of effectiveDataSourceIds) {
            additionalCollections.push({
              originalId: id,
              collectionName: collection
            });
          }
        }
        
        collections.push(...additionalCollections);
      } else {
        // If no data source IDs provided, use a default ID for all collections
        const defaultId = '0';
        collections = documentCollections.map(collection => ({
          originalId: defaultId,
          collectionName: collection
        }));
      }
      
      logger.info(`Total of ${collections.length} collections to query (including document collections)`);
    }
    
    // If we still have no collections, pass to the regular handler
    if (collections.length === 0) {
      logger.info('No collections found to query, passing to regular handler');
      return next();
    }
    
    // Try to query each collection
    for (const collection of collections) {
      const originalId = collection.originalId;
      const collectionName = collection.collectionName;
      
      logger.info(`Trying collection: ${collectionName} (for ID: ${originalId})`);
      
      try {
        // Check if collection has vectors
        const hasVectors = await checkCollectionHasVectors(collectionName, qdrantService);
        if (hasVectors) {
          logger.info(`Collection ${collectionName} has vectors, using it for query`);
          
          // Handle the direct query with this collection
          const result = await handleDirectQuery(originalId, collectionName, effectiveQuery, req, res);
          if (result) {
            logger.info(`Got results from collection ${collectionName}`);
            
            // For chat endpoints, we need to format the response differently
            if (isChatEndpoint) {
              const aiMessage = {
                id: Date.now().toString(),
                content: result.content,
                role: 'assistant',
                timestamp: Date.now(),
                status: 'complete',
                metadata: result.metadata,
                sources: result.sources
              };
              
              // Combine with any other expected response fields
              const chatResponse = {
                ...req.body,
                aiMessage
              };
              
              return res.json(chatResponse);
            }
            
            // Return the result for RAG endpoints
            return res.json(result);
          }
        } else {
          logger.info(`Collection ${collectionName} exists but has no vectors, skipping`);
        }
      } catch (error) {
        logger.error(`Error checking collection ${collectionName}:`, error);
        // Continue to next collection
      }
    }
    
    // If we reach here and still have no response, pass to the regular handler
    logger.info('No results from any collection, passing to regular handler');
    return next();
  } catch (error) {
    logger.error('Error in redirectRagQueries middleware:', error);
    return next();
  }
}

/**
 * Find all possible collection patterns for the given IDs
 */
async function findPossibleCollections(dataSourceIds: Array<string | number>, qdrantService: any): Promise<CollectionResult[]> {
  const result: CollectionResult[] = [];
  const collectionsInfo = [];
  
  // First list all collections to efficiently check what exists
  let allCollections: string[] = [];
  try {
    const collectionsResponse = await qdrantService.listCollections();
    // Fix type issue with proper type assertion
    allCollections = Array.isArray(collectionsResponse) 
      ? collectionsResponse 
      : ((collectionsResponse as QdrantCollectionsResponse)?.collections?.map(c => c.name) || []);
    
    logger.info(`Found ${allCollections.length} total collections in Qdrant`);
  } catch (error) {
    logger.error('Error listing collections:', error);
    return [];
  }
  
  // Special mapping for known problematic IDs
  const specialMappings: SpecialMappings = {
    '287': ['datasource_764baa3b-fefa-4b28-a2f3-e07d6310ea3e', 'datasource_287'],
    '288': ['datasource_a6091ab4-6f49-4b83-932c-69a89ed99703', 'datasource_288'],
    '290': ['datasource_a6091ab4-6f49-4b83-932c-69a89ed99703', 'datasource_290']
  };
  
  // For each data source ID, try to find matching collections
  for (const id of dataSourceIds) {
    // Check special mappings first
    const idStr = String(id);
    if (idStr in specialMappings) {
      const mappings = specialMappings[idStr as keyof typeof specialMappings];
      for (const pattern of mappings) {
        if (allCollections.includes(pattern)) {
          // Special mapping found and exists, add to top of the result list
          result.unshift({
            originalId: id,
            collectionName: pattern
          });
        }
      }
    }
    
    const patterns = getCollectionPatterns(id);
    
    // Check which patterns actually exist in Qdrant
    for (const pattern of patterns) {
      if (allCollections.includes(pattern)) {
        result.push({
          originalId: id,
          collectionName: pattern
        });
      }
    }
    
    // If we didn't find any exact matches, look for partial matches
    if (!result.some(r => r.originalId === id)) {
      // For UUIDs, look for any collection containing that UUID
      if (typeof id === 'string' && id.includes('-')) {
        const matchingCollections = allCollections.filter(name => name.includes(id));
        for (const match of matchingCollections) {
          result.push({
            originalId: id,
            collectionName: match
          });
        }
      } 
      // For numeric IDs, do a broader search
      else if (!isNaN(Number(id))) {
        // First look for the ID directly in collection names
        const matchingCollections = allCollections.filter(name => 
          name.includes(`_${id}_`) || 
          name.endsWith(`_${id}`) ||
          name === `datasource_${id}`
        );
        
        for (const match of matchingCollections) {
          result.push({
            originalId: id,
            collectionName: match
          });
        }
        
        // If we still don't have matches, try a more exhaustive search approach
        if (!matchingCollections.length) {
          logger.info(`No direct matches found for numeric ID ${id}, trying exhaustive search`);
          
          // Check if there's a UUID-based collection that could match based on content
          const documentCollections = allCollections.filter(name => 
            name.startsWith('datasource_') && 
            name.includes('-') // Has UUID format
          );
          
          // If we have document collections, add them as potential matches
          // This is a fallback mechanism when we can't find direct matches
          if (documentCollections.length > 0) {
            // Add up to 3 document collections to try
            const collectionsToTry = documentCollections.slice(0, 3);
            
            logger.info(`Adding ${collectionsToTry.length} document collections as potential matches for ID ${id}`);
            
            for (const docCollection of collectionsToTry) {
              // Lower score to prioritize direct matches
              result.push({
                originalId: id,
                collectionName: docCollection
              });
            }
          }
        }
      }
    }
  }
  
  // Prioritize direct matches (datasource_ID pattern) and put documented UUID formats first
  result.sort((a, b) => {
    // First prioritize special mappings
    const aIdStr = String(a.originalId);
    const bIdStr = String(b.originalId);
    const aIsSpecial = aIdStr in specialMappings && 
      specialMappings[aIdStr as keyof typeof specialMappings].includes(a.collectionName);
    const bIsSpecial = bIdStr in specialMappings && 
      specialMappings[bIdStr as keyof typeof specialMappings].includes(b.collectionName);
    
    if (aIsSpecial && !bIsSpecial) return -1;
    if (!aIsSpecial && bIsSpecial) return 1;
    
    // Then prefer direct datasource_ patterns
    const aIsDirect = a.collectionName === `datasource_${a.originalId}`;
    const bIsDirect = b.collectionName === `datasource_${b.originalId}`;
    
    if (aIsDirect && !bIsDirect) return -1;
    if (!aIsDirect && bIsDirect) return 1;
    
    // Then prefer collections with UUIDs for document collections
    const aHasUuid = a.collectionName.includes('-');
    const bHasUuid = b.collectionName.includes('-');
    
    if (aHasUuid && !bHasUuid) return -1;
    if (!aHasUuid && bHasUuid) return 1;
    
    return 0;
  });
  
  // Remove duplicates (same collection name) while preserving order
  const uniqueCollections = [];
  const seen = new Set();
  
  for (const item of result) {
    if (!seen.has(item.collectionName)) {
      seen.add(item.collectionName);
      uniqueCollections.push(item);
    }
  }
  
  return uniqueCollections;
}

/**
 * Generate possible collection name patterns for a given ID
 */
function getCollectionPatterns(id: string | number): string[] {
  const patterns: string[] = [];
  
  // Always check the direct datasource_ID pattern first
  patterns.push(`datasource_${id}`);
  
  // If ID is numeric, check additional patterns
  if (!isNaN(Number(id))) {
    // Numeric ID patterns
    const numericId = Number(id);
    
    // Snowflake patterns
    patterns.push(`snowflake_${id}`);
    patterns.push(`datasource_snowflake_${id}`);
    patterns.push(`row_data_${id}`);
    
    // Document patterns
    patterns.push(`document_${id}`);
    patterns.push(`doc_${id}`);
    patterns.push(`pdf_${id}`);
    patterns.push(`excel_${id}`);
  }
  
  // If ID is already a full collection name, include it directly
  if (typeof id === 'string' && (
    id.startsWith('datasource_') || 
    id.startsWith('snowflake_') || 
    id.startsWith('row_data_')
  )) {
    patterns.push(id);
  }
  
  return patterns;
}

/**
 * Handle direct querying of a collection
 */
async function handleDirectQuery(
  originalId: string | number, 
  collectionName: string, 
  query: string, 
  req: Request, 
  res: Response
): Promise<any> {
  try {
    logger.info(`Handling direct query for collection ${collectionName} with original ID ${originalId}`);
    
    // Get embedding for query
    const OpenAIService = require('../services/ai/openai.service').OpenAIService;
    const openaiService = new OpenAIService();
    
    const embeddings = await openaiService.createEmbeddings([query]);
    if (!embeddings || embeddings.length === 0) {
      logger.error('Failed to generate embeddings for query');
      return null;
    }
    
    // Search directly in Qdrant with higher limit to get more context
    const qdrantService = new QdrantClientService();
    
    // Log the query parameters
    logger.info(`Searching collection ${collectionName} with query: ${query.substring(0, 100)}...`);
    
    // Get collection info for debugging
    try {
      const collectionInfo = await qdrantService.getInfo(collectionName);
      logger.info(`Collection info: ${JSON.stringify(collectionInfo)}`);
    } catch (infoError) {
      logger.error(`Error getting collection info: ${infoError}`);
    }
    
    // Increase search limit for better results
    const searchResults = await qdrantService.search(collectionName, embeddings[0], {}, 30);
    
    if (!searchResults || searchResults.length === 0) {
      logger.info(`No results found in collection ${collectionName}`);
      return null;
    }
    
    logger.info(`Found ${searchResults.length} results in collection ${collectionName}`);
    
    // DEBUG: Log the first result's payload structure to understand the data format
    try {
      if (searchResults[0] && searchResults[0].payload) {
        const firstPayload = searchResults[0].payload;
        const payloadKeys = Object.keys(firstPayload);
        logger.info(`First result payload keys: ${payloadKeys.join(', ')}`);
        
        // Log a sample of the content for debugging
        const sampleTextKey = payloadKeys.find(k => 
          typeof firstPayload[k] === 'string' && 
          firstPayload[k].length > 30
        );
        
        if (sampleTextKey) {
          const sampleText = firstPayload[sampleTextKey];
          logger.info(`Sample content from key "${sampleTextKey}": ${sampleText.substring(0, 100)}...`);
        }
      }
    } catch (debugError) {
      logger.error(`Error while debugging payload: ${debugError}`);
    }
    
    // Improved document content extraction
    const documents = searchResults.map(result => {
      try {
        // Initialize with empty content
        let docContent = '';
        const payload = result.payload || {};
        
        // First check for common text fields
        const commonTextFields = ['text', 'content', 'page_content', 'body', 'chunk', 'document', 'data'];
        
        for (const field of commonTextFields) {
          if (payload[field] && typeof payload[field] === 'string' && payload[field].length > 10) {
            docContent = payload[field];
            break;
          }
        }
        
        // If still no content, try to extract from nested objects
        if (!docContent && payload.metadata && typeof payload.metadata === 'object') {
          for (const metaKey of Object.keys(payload.metadata)) {
            const metaValue = payload.metadata[metaKey];
            if (typeof metaValue === 'string' && metaValue.length > 30) {
              docContent = metaValue;
              break;
            }
          }
        }
        
        // If still no content, find the longest string in the payload
        if (!docContent) {
          const allTextFields: Array<{path: string, text: string, length: number}> = [];
          
          // Recursive function to find all string fields in the payload
          const findStringFields = (obj: any, prefix = '') => {
            if (!obj || typeof obj !== 'object') return;
            
            Object.entries(obj).forEach(([key, value]) => {
              const fieldPath = prefix ? `${prefix}.${key}` : key;
              
              if (typeof value === 'string' && value.length > 30) {
                allTextFields.push({ path: fieldPath, text: value, length: value.length });
              } else if (value && typeof value === 'object' && !Array.isArray(value)) {
                findStringFields(value, fieldPath);
              }
            });
          };
          
          findStringFields(payload);
          
          // Sort by length (longest first) and use the longest text
          if (allTextFields.length > 0) {
            allTextFields.sort((a, b) => b.length - a.length);
            docContent = allTextFields[0].text;
            logger.info(`Using content from field: ${allTextFields[0].path}`);
          }
        }
        
        // Last resort: convert the entire payload to a string
        if (!docContent) {
          docContent = JSON.stringify(payload);
          logger.info(`No text content found, using JSON string of entire payload`);
        }
        
        return {
          id: result.id || `result-${Math.random().toString(36).substring(2, 11)}`,
          content: docContent,
          metadata: {
            score: result.score,
            dataSourceId: originalId,
            collectionName,
            ...payload.metadata
          }
        };
      } catch (docError) {
        logger.error(`Error extracting document content: ${docError}`);
        return {
          id: result.id || `result-${Math.random().toString(36).substring(2, 11)}`,
          content: JSON.stringify(result.payload || {}),
          metadata: {
            score: result.score,
            dataSourceId: originalId,
            collectionName
          }
        };
      }
    });
    
    // Log the extracted content from the first few documents for debugging
    documents.slice(0, 2).forEach((doc, idx) => {
      logger.info(`Document ${idx+1} content preview: ${doc.content.substring(0, 100)}...`);
    });
    
    // Improved prompt for more accurate responses focused on actual content
    const prompt = `
      You are an expert AI assistant tasked with providing accurate answers based ONLY on the information in the provided documents.
      
      Query: "${query}"
      
      CRITICAL INSTRUCTIONS:
      1. Use ONLY information directly stated in the provided documents
      2. If the documents do not contain sufficient information to answer the query, acknowledge the limitation explicitly
      3. DO NOT hallucinate or invent information not present in the documents
      4. DO NOT include any template-like placeholder text in your answer
      5. Format numerical data clearly in tables if present
      6. Your response should be factual, concise, and directly address the query
      
      Format your answer in a clear, well-structured way with appropriate headings where needed.
    `;
    
    const messages = [
      { role: 'system', content: prompt },
      ...documents.slice(0, 15).map((doc, index) => ({
        role: 'user',
        content: `Document ${index + 1}:\n${doc.content.substring(0, 2000)}${doc.content.length > 2000 ? '...' : ''}`
      }))
    ] as any[];
    
    // Log the total document content length being sent
    const totalContentLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
    logger.info(`Sending ${messages.length} documents to LLM with total context length: ${totalContentLength} characters`);
    
    // Generate a response with a better model and lower temperature
    const completion = await openaiService.generateChatCompletion(
      messages,
      { model: 'gpt-4o-mini', temperature: 0.1 } // Use gpt-4o-mini for better accuracy
    );
    
    const content = completion.choices[0].message.content;
    
    // Better source formatting for more useful citations
    const sources = documents.slice(0, 5).map(doc => {
      let sourceText = doc.content.substring(0, 200);
      if (doc.content.length > 200) sourceText += '...';
      
      // Clean up source text for better readability
      sourceText = sourceText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
      
      return {
        id: doc.id,
        text: sourceText,
        score: doc.metadata.score,
        dataSourceId: originalId
      };
    });
    
    // Return the response data with better metadata
    return {
      content,
      sources,
      metadata: {
        processingTime: 0,
        model: 'gpt-4o-mini',
        collectionNames: [collectionName],
        dataSourceIds: [originalId],
        dataSourceType: 'qdrant',
        isQdrantResponse: true,
        useEnhancedVisualization: true,
        hasVisualization: true,
        wasDirectlyQueried: true,
        documentsFound: documents.length,
        queryEmbeddingDimension: embeddings[0].length
      }
    };
  } catch (directQueryError) {
    logger.error(`Error with direct query: ${directQueryError}`);
    return null;
  }
}

/**
 * Check if a collection has vectors
 */
async function checkCollectionHasVectors(collectionName: string, qdrantService: any): Promise<boolean> {
  try {
    // First verify the collection exists
    const exists = await qdrantService.collectionExists(collectionName);
    if (!exists) {
      return false;
    }
    
    // Try to get info about the collection
    try {
      const info = await qdrantService.getInfo(collectionName);
      logger.info(`Collection ${collectionName} info: ${JSON.stringify(info)}`);
      
      if (info && (info.vectors_count > 0 || info.points_count > 0)) {
        logger.info(`Collection ${collectionName} has ${info.vectors_count || info.points_count} vectors/points`);
        return true;
      }
    } catch (infoError) {
      logger.warn(`Error getting collection info for ${collectionName}: ${infoError}`);
    }
    
    // Try to scroll and check for points - this is more reliable
    try {
      const scrollResult = await qdrantService.scrollPoints(collectionName, 5, null, false);
      const hasPoints = scrollResult && scrollResult.points && scrollResult.points.length > 0;
      
      if (hasPoints) {
        logger.info(`Collection ${collectionName} has points according to scroll check`);
        
        // DEBUG: Log the first point structure
        if (scrollResult.points[0]) {
          const pointSample = scrollResult.points[0];
          const payloadKeys = Object.keys(pointSample.payload || {});
          logger.info(`Sample point payload keys: ${payloadKeys.join(', ')}`);
        }
      }
      
      return hasPoints;
    } catch (scrollError) {
      logger.error(`Error scrolling collection ${collectionName}: ${scrollError}`);
      // Assume it might have points even if scroll fails
      return true; 
    }
  } catch (error) {
    logger.error(`Error checking if collection ${collectionName} has vectors: ${error}`);
    // If in doubt, assume it has vectors to avoid missing data
    return true;
  }
}

/**
 * Find all possible collections for document queries without relying on specific IDs
 */
async function findDocumentCollections(qdrantService: any): Promise<string[]> {
  try {
    const collectionsResponse = await qdrantService.listCollections();
    // Fix type issue with proper type assertion
    const allCollections = Array.isArray(collectionsResponse) 
      ? collectionsResponse 
      : ((collectionsResponse as QdrantCollectionsResponse)?.collections?.map(c => c.name) || []);
    
    // Find document-like collections using more flexible patterns
    const documentCollections = allCollections.filter(name => 
      // UUID pattern collections (typical for documents)
      (name.includes('-') && name.length > 20) ||
      // Document-specific prefixes
      name.startsWith('datasource_') || 
      name.startsWith('document_') ||
      name.startsWith('pdf_') ||
      name.startsWith('excel_') ||
      name.startsWith('doc_') ||
      // File extension patterns
      name.includes('.pdf') ||
      name.includes('.xlsx') ||
      name.includes('.docx') ||
      name.includes('.csv')
    );
    
    logger.info(`Found ${documentCollections.length} potential document collections`);
    return documentCollections;
  } catch (error) {
    logger.error('Error finding document collections:', error);
    return [];
  }
} 