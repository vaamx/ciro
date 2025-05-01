const { Logger } = require('@nestjs/common');
const fs = require('fs/promises');
const path = require('path');

interface PerformanceMetrics {
  totalTime: number;
  documentsRetrieved: number;
  averageSimilarity?: number;
  dataSourcesQueried: number;
  queryCost?: number;
  chunkCount?: number;
  timestamp: string;
  query: string;
  dataSourceIds: string[];
  success: boolean;
  error?: string;
}

interface Document {
  id: string;
  text?: string;
  similarity?: number;
  [key: string]: any;
}

class PerformanceMonitoringService {
  private readonly logger = new Logger(PerformanceMonitoringService.name);
  private readonly metricsPath: string;

  constructor(metricsPath?: string) {
    this.metricsPath = metricsPath || path.join(process.cwd(), 'analysis', 'performance-metrics.json');
    this.ensureMetricsDirectory();
  }

  private async ensureMetricsDirectory(): Promise<void> {
    try {
      const directory = path.dirname(this.metricsPath);
      await fs.mkdir(directory, { recursive: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create metrics directory: ${errorMessage}`);
    }
  }

  async measureRagPerformance(
    query: string, 
    dataSourceIds: string[], 
    executeFn: () => Promise<any>
  ): Promise<PerformanceMetrics> {
    const start = performance.now();
    let result;
    let success = true;
    let error: string | undefined;

    try {
      result = await executeFn();
    } catch (err: unknown) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Performance measurement failed: ${error}`);
    }
    
    const end = performance.now();
    
    const metrics: PerformanceMetrics = {
      totalTime: end - start,
      documentsRetrieved: success && result?.documents ? result.documents.length : 0,
      averageSimilarity: success && result?.documents ? this.calculateAverageSimilarity(result.documents) : 0,
      dataSourcesQueried: dataSourceIds.length,
      queryCost: success ? this.estimateTokenUsage(query, result) : 0,
      timestamp: new Date().toISOString(),
      query,
      dataSourceIds,
      success,
      error
    };

    await this.saveMetrics(metrics);
    return metrics;
  }

  private calculateAverageSimilarity(documents: Document[]): number {
    if (!documents || documents.length === 0) return 0;
    
    const similarities = documents
      .filter(doc => doc.similarity !== undefined)
      .map(doc => doc.similarity as number);
      
    if (similarities.length === 0) return 0;
    
    return similarities.reduce((sum, curr) => sum + curr, 0) / similarities.length;
  }

  private estimateTokenUsage(query: string, result: any): number {
    // Simple token estimation 
    const queryTokens = query.split(/\s+/).length;
    const responseTokens = result?.documents 
      ? result.documents.reduce((sum: number, doc: Document) => sum + (doc.text?.split(/\s+/).length || 0), 0)
      : 0;
      
    return queryTokens + responseTokens;
  }

  private async saveMetrics(metrics: PerformanceMetrics): Promise<void> {
    try {
      let existingMetrics: PerformanceMetrics[] = [];
      
      try {
        const data = await fs.readFile(this.metricsPath, 'utf8');
        existingMetrics = JSON.parse(data);
      } catch (err) {
        // File may not exist yet, that's okay
        existingMetrics = [];
      }
      
      existingMetrics.push(metrics);
      
      await fs.writeFile(
        this.metricsPath, 
        JSON.stringify(existingMetrics, null, 2),
        'utf8'
      );
      
      this.logger.log(`Performance metrics saved to ${this.metricsPath}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save performance metrics: ${errorMessage}`);
    }
  }

  async getStoredMetrics(): Promise<PerformanceMetrics[]> {
    try {
      const data = await fs.readFile(this.metricsPath, 'utf8');
      return JSON.parse(data);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read performance metrics: ${errorMessage}`);
      return [];
    }
  }

  async generatePerformanceReport(): Promise<string> {
    const metrics = await this.getStoredMetrics();
    
    if (metrics.length === 0) {
      return 'No performance metrics recorded yet.';
    }
    
    const averageTime = metrics.reduce((sum, m) => sum + m.totalTime, 0) / metrics.length;
    const averageDocsRetrieved = metrics.reduce((sum, m) => sum + m.documentsRetrieved, 0) / metrics.length;
    const successRate = (metrics.filter(m => m.success).length / metrics.length) * 100;
    
    // Find slowest and fastest queries
    const sortedByTime = [...metrics].sort((a, b) => b.totalTime - a.totalTime);
    const slowest = sortedByTime[0];
    const fastest = sortedByTime[sortedByTime.length - 1];
    
    return `
Performance Report
=================

Total Queries Measured: ${metrics.length}
Success Rate: ${successRate.toFixed(2)}%
Average Query Time: ${averageTime.toFixed(2)}ms
Average Documents Retrieved: ${averageDocsRetrieved.toFixed(2)}

Slowest Query: "${slowest.query.substring(0, 50)}..." (${slowest.totalTime.toFixed(2)}ms)
Fastest Query: "${fastest.query.substring(0, 50)}..." (${fastest.totalTime.toFixed(2)}ms)

Last 5 Queries:
${metrics.slice(-5).map(m => `- "${m.query.substring(0, 30)}..." (${m.totalTime.toFixed(2)}ms, ${m.documentsRetrieved} docs)`).join('\n')}
`;
  }
}

module.exports = {
  PerformanceMonitoringService
}; 