# RAG System Architecture Guide

This document outlines the architecture of our Retrieval-Augmented Generation (RAG) system, explaining key components, recent improvements, and best practices for maintenance.

## Table of Contents

1. [System Overview](#system-overview)
2. [Key Components](#key-components)
3. [Data Flow](#data-flow)
4. [Recent Improvements](#recent-improvements)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Best Practices](#best-practices)
7. [Maintenance Tasks](#maintenance-tasks)

## System Overview

Our RAG system combines vector database search with large language models to answer questions based on our knowledge base. The system processes user queries by:

1. Converting the query to a vector embedding
2. Searching the Qdrant vector database for relevant documents
3. Retrieving the most relevant content
4. Generating a response using OpenAI's language models
5. Presenting the results with appropriate visualization

## Key Components

### Backend Components

- **RagService**: Core service that orchestrates the end-to-end RAG process
- **QdrantService**: Handles interactions with the Qdrant vector database
- **OpenAIService**: Manages API calls to OpenAI for embeddings and completions
- **DocumentProcessorService**: Processes and indexes various document types

### Frontend Components

- **VisualizationAdapter**: Processes RAG responses for visualization
- **EnhancedStepByStepVisualization**: Displays structured data from RAG responses
- **DocumentTypeHandlers**: Detects and processes different document types

## Data Flow

1. **Query Processing**: 
   - User submits a query to the RAG system
   - Query is processed by the RagService
   - RagService converts the query to an embedding using OpenAIService

2. **Document Retrieval**:
   - The embedding is used to search Qdrant collections via QdrantService
   - Relevant documents are retrieved and ranked by similarity
   - Documents are deduplicated and filtered

3. **Response Generation**:
   - Retrieved documents are sent to OpenAI with the original query
   - A structured response is generated
   - Metadata is prepared for visualization

4. **Visualization**:
   - The VisualizationAdapter processes the response
   - EnhancedStepByStepVisualization displays the content
   - Additional data visualization is applied if needed

## Recent Improvements

We've made several key improvements to stabilize and enhance the RAG system:

### 1. Streamlined Query Processing

- Simplified the `processQuery` method to focus on reliable retrieval
- Removed complex branching logic that was causing inconsistencies
- Implemented parallel document retrieval from multiple collections

### 2. Enhanced Document Type Detection

- Prioritized Qdrant responses for consistent handling
- Simplified detection logic to reduce errors
- Improved handling of metadata for better visualization

### 3. Visualization Improvements

- Enhanced the VisualizationAdapter to better handle any RAG response
- Disabled all mock data generation that was causing confusion
- Improved extraction of structured data from responses

### 4. Error Handling

- Added consistent error response formatting
- Improved error logging and reporting
- Created diagnostics tools for system monitoring

## Troubleshooting Guide

### Common Issues and Solutions

#### No Results Returned

**Symptoms**: Query returns "I couldn't find any relevant information" despite relevant data existing.

**Possible Causes and Solutions**:
1. **Collection naming mismatch**: Ensure collection names follow the `datasource_ID` format
2. **Embedding issues**: Check OpenAI API connectivity and embedding generation
3. **Index problems**: Run the diagnostic tool to check collection health

#### Inconsistent Visualization

**Symptoms**: RAG responses sometimes use the correct visualization and sometimes don't.

**Possible Causes and Solutions**:
1. **Data source type detection**: Check logs for data source type detection values
2. **Metadata consistency**: Ensure metadata from server includes required visualization flags
3. **Content structure**: Structured data must be properly formatted in the response

#### Server Errors

**Symptoms**: Server crashes or returns 500 errors when making RAG queries.

**Possible Causes and Solutions**:
1. **Memory issues**: Check server memory usage during large queries
2. **Connection timeout**: Verify Qdrant connection settings
3. **Token limit exceeded**: Check document slice sizes in RagService

### Using the Diagnostic Tool

Run the diagnostic tool to check system health:

```bash
cd server
npx ts-node src/scripts/rag-diagnostics.ts
```

The tool will check:
- OpenAI connectivity
- Qdrant connectivity
- Database connections
- Collection health
- Embedding generation
- Vector search functionality
- End-to-end RAG process

## Best Practices

### Data Source Management

1. **Consistent Naming**: Use consistent naming patterns for all data sources
2. **Collection Prefixing**: Always prefix Qdrant collections with `datasource_`
3. **Metadata Standards**: Include source information in document metadata

### Query Optimization

1. **Limit Document Count**: Retrieve only necessary documents (5-10 is usually sufficient)
2. **Chunk Size**: Use appropriate chunk sizes when indexing (250-500 tokens recommended)
3. **Context Length**: Be mindful of token limits in completion requests

### Visualization Design

1. **Type Detection**: Always include `dataSourceType` in response metadata
2. **Structured Data**: Use consistent data structures for visualization
3. **Insight Extraction**: Extract key insights for enhanced visualizations

## Maintenance Tasks

### Regular Maintenance

1. **Collection Health Check**: Run diagnostics weekly
2. **Cache Cleanup**: Clear cached embeddings monthly
3. **Log Rotation**: Ensure logs don't consume excessive disk space

### Scaling Considerations

1. **Collection Sharding**: For large collections, consider Qdrant sharding
2. **Embedding Cache**: Implement proper caching for frequent queries
3. **Load Distribution**: Monitor system load and distribute if necessary

### Updating Dependencies

1. **OpenAI Updates**: Check for OpenAI API changes quarterly
2. **Qdrant Upgrades**: Test Qdrant upgrades in staging environment first
3. **Library Compatibility**: Verify compatibility when updating dependencies

## Appendix: Running the Restart Script

For a clean restart of the system, use the `restart-ciro.sh` script:

```bash
cd server
chmod +x restart-ciro.sh
./restart-ciro.sh
```

This script:
1. Stops existing Node processes
2. Clears caches and temporary files
3. Rebuilds the application
4. Restarts the server

## Appendix: Diagnostic and Testing Tools

### RAG Diagnostics Tool

We've created a comprehensive diagnostics tool to help identify issues with the RAG system:

```bash
cd server
./src/scripts/run-diagnostics.sh
```

This tool performs checks on:
- OpenAI API connectivity
- Qdrant database connectivity
- Database connections
- Collection health
- Embedding generation
- Vector search functionality
- End-to-end RAG process

The diagnostics tool bypasses TypeScript type checking to run even if there are type compatibility issues.

### RAG Testing CLI

For direct testing of RAG functionality, use the testing CLI:

```bash
cd server
./src/scripts/run-test-rag.sh
```

This interactive CLI allows you to:
- Test queries against specific data sources
- List available data sources
- View detailed query results including content, sources, and metadata
- Troubleshoot RAG responses in isolation from the rest of the application

---

By following this guide and maintaining best practices, our RAG system should provide stable and consistent responses across all Qdrant collections. 