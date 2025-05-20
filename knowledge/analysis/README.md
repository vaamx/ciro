# RAG System Analysis

This directory contains analysis artifacts generated during Phase 0 (Preparation) of the RAG system overhaul project. These artifacts provide baseline measurements and documentation of the current system's architecture and performance.

## Directory Structure

- `server-dependency-graph.svg` - Visual dependency graph of the server codebase
- `frontend-graph.svg` - Visual dependency graph of the frontend codebase
- `rag-performance-tests.json` - JSON data from performance tests of the RAG system
- `performance-report.md` - Markdown report summarizing performance metrics
- `database/` - Database schema analysis
  - `schema-report.md` - Markdown report of database schema
  - `er-diagram.mmd` - Entity-relationship diagram in Mermaid format
  - `tables.json` - Raw JSON data of database tables
  - `columns.json` - Raw JSON data of database columns
  - `foreign-keys.json` - Raw JSON data of foreign key relationships
  - `table-stats.json` - Raw JSON data of table statistics

## How to Update These Artifacts

### Dependency Graphs

To regenerate the dependency graphs:

```bash
npx madge --image analysis/server-dependency-graph.svg --exclude "node_modules" server/src/
npx madge --image analysis/frontend-graph.svg --exclude "node_modules" dashboard/src/
```

### Database Schema Analysis

To update the database schema analysis:

```bash
cd analysis
npx ts-node schema-analyzer.ts
```

This will connect to the database specified in your `.env` file and generate updated schema reports.

### Performance Tests

To run performance tests against the RAG system:

```bash
cd analysis
npx ts-node rag-performance-test.ts
```

## Integration with Existing System

The performance monitoring utilities can be integrated with the actual retrieval service by modifying `server/src/services/rag/retrieval.service.ts` to use the `PerformanceMonitoringService`.

Example integration:

```typescript
import { PerformanceMonitoringService } from '../../utils/performance-monitoring';

// In the RetrievalService class
private performanceMonitoring = new PerformanceMonitoringService();

async retrieveDocumentsFromAllSources(query: string, dataSourceIds: string[]) {
  return this.performanceMonitoring.measureRagPerformance(
    query, 
    dataSourceIds,
    () => this.actualRetrievalMethod(query, dataSourceIds)
  );
}
```

## Baseline Metrics

After running the performance tests, you'll have baseline metrics for:

1. Average query response time
2. Document retrieval count (max, min, average)
3. Success rate
4. Processing time distribution

These metrics will be essential for comparing the performance of the refactored system against the current implementation.

## Next Steps

After completing this analysis, proceed to Phase 1 of the project: Core Architecture Refactoring. 