import { Test, TestingModule } from '@nestjs/testing';
import { QueryAnalysisService, ChartType } from './query-analysis.service';
import { OpenAIService } from '../ai/openai.service';
import { PreprocessedQuery, HeuristicOutput } from '../../types/router.types';
import * as fs from 'fs';
import * as path from 'path';

// Define or import KeywordConfigItem if not already available globally in tests
interface KeywordConfigItem { 
  keyword: string;
  weight: number;
}

// Mock OpenAIService
class MockOpenAIService {}

// Helper to load the actual config for testing, or a mock if preferred
const loadTestConfig = () => {
  try {
    const configPath = path.join(__dirname, '../../config/query-analysis.config.json');
    const configFile = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(configFile);
  } catch (e) {
    // Fallback to a minimal mock config if the actual one can't be loaded
    console.error("Failed to load actual config for tests, using minimal mock.", e);
    return {
      analyticalKeywords: [{ keyword: "analyze", weight: 1.0 }],
      retrievalKeywords: [{ keyword: "what is", weight: 1.0 }],
      visualizationKeywords: [{ keyword: "plot", weight: 1.0 }],
      datasetMentionPatterns: ["\\.csv"],
      codeMentionPatterns: ["python code"],
      scoring: {
        defaultAnalyticalScore: 0.1,
        defaultRetrievalScore: 0.1,
        maxScore: 1.0,
        minScore: 0.0,
        weights: {
          analyticalKeywordMatch: 1.0, // Simplified for testing if full config not loaded
          retrievalKeywordMatch: 1.0,   // Simplified
          visualizationRequest: 0.5,
          datasetMention: 0.6,
          codeMention: 0.5,
        },
      },
    };
  }
};


describe('QueryAnalysisService', () => {
  let service: QueryAnalysisService;
  const testConfig = loadTestConfig();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryAnalysisService,
        { provide: OpenAIService, useClass: MockOpenAIService },
      ],
    }).compile();

    service = module.get<QueryAnalysisService>(QueryAnalysisService);
    // Manually set the config for the service instance for each test
    // This bypasses the onModuleInit and ensures consistent config for tests
    (service as any).config = testConfig; 
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runHeuristics', () => {
    it('should identify an analytical query', async () => {
      const query: PreprocessedQuery = { originalQuery: 'analyze sales data', normalizedQuery: 'analyze sales data' };
      const result: HeuristicOutput = await service.runHeuristics(query);
      expect(result.isAnalyticalIntent).toBe(true);
      expect(result.analyticalScore).toBeGreaterThan(testConfig.scoring.defaultAnalyticalScore);
    });

    it('should identify a retrieval query', async () => {
      const query: PreprocessedQuery = { originalQuery: 'what is nestjs', normalizedQuery: 'what is nestjs' };
      const result: HeuristicOutput = await service.runHeuristics(query);
      expect(result.isRetrievalIntent).toBe(true);
      expect(result.retrievalScore).toBeGreaterThan(testConfig.scoring.defaultRetrievalScore);
    });

    it('should identify a visualization request', async () => {
      const query: PreprocessedQuery = { originalQuery: 'plot revenue over time', normalizedQuery: 'plot revenue over time' };
      const result: HeuristicOutput = await service.runHeuristics(query);
      expect(result.requestsVisualization).toBe(true);

      // "plot" is an analyticalKeyword with weight 0.9 and a visualizationKeyword.
      // The analyticalScore will be Math.max(defaultAnalyticalScore, analyticalKeyword.weight_for_plot, scoring.weights.visualizationRequest)
      // If "plot" is an analytical keyword:
      const plotAsAnalyticalKeyword = testConfig.analyticalKeywords.find((k: KeywordConfigItem) => k.keyword === 'plot');
      const expectedScore = plotAsAnalyticalKeyword ? 
                              Math.max(plotAsAnalyticalKeyword.weight, testConfig.scoring.weights.visualizationRequest) :
                              testConfig.scoring.weights.visualizationRequest; // Fallback if plot wasn't an analytical keyword
      // Ensure the default score is also considered in the Math.max if it were higher, though unlikely here.
      const finalExpectedScore = Math.max(testConfig.scoring.defaultAnalyticalScore, expectedScore);

      expect(result.analyticalScore).toEqual(finalExpectedScore); 
    });
    
    it('should identify a dataset mention', async () => {
      const query: PreprocessedQuery = { originalQuery: 'load data from sales.csv', normalizedQuery: 'load data from sales.csv' };
      const result: HeuristicOutput = await service.runHeuristics(query);
      expect(result.mentionsDataset).toBe(true);
      expect(result.analyticalScore).toEqual(testConfig.scoring.weights.datasetMention);
    });

    it('should identify a code mention', async () => {
      const query: PreprocessedQuery = { originalQuery: 'give me python code for this', normalizedQuery: 'give me python code for this' };
      const result: HeuristicOutput = await service.runHeuristics(query);
      expect(result.mentionsCode).toBe(true);
      expect(result.analyticalScore).toEqual(testConfig.scoring.weights.codeMention);
    });

    it('should handle an empty query', async () => {
      const query: PreprocessedQuery = { originalQuery: '', normalizedQuery: '' };
      const result: HeuristicOutput = await service.runHeuristics(query);
      expect(result.isAnalyticalIntent).toBe(false);
      expect(result.isRetrievalIntent).toBe(false);
      expect(result.requestsVisualization).toBe(false);
      expect(result.mentionsDataset).toBe(false);
      expect(result.mentionsCode).toBe(false);
      expect(result.analyticalScore).toEqual(testConfig.scoring.defaultAnalyticalScore);
      expect(result.retrievalScore).toEqual(testConfig.scoring.defaultRetrievalScore);
    });
    
    it('should return default scores for a neutral query', async () => {
        const query: PreprocessedQuery = { originalQuery: 'hello there', normalizedQuery: 'hello there' };
        const result: HeuristicOutput = await service.runHeuristics(query);
        expect(result.isAnalyticalIntent).toBe(false);
        expect(result.isRetrievalIntent).toBe(false);
        expect(result.analyticalScore).toEqual(testConfig.scoring.defaultAnalyticalScore);
        expect(result.retrievalScore).toEqual(testConfig.scoring.defaultRetrievalScore);
      });

    it('should handle a query with mixed signals (analytical and visualization)', async () => {
        const query: PreprocessedQuery = { originalQuery: 'analyze and plot user engagement', normalizedQuery: 'analyze and plot user engagement' };
        const analyticalKeyword = testConfig.analyticalKeywords.find((k: KeywordConfigItem) => k.keyword === 'analyze');
        const plotKeywordWeight = testConfig.scoring.weights.visualizationRequest;
        
        const expectedAnalyticalScore = Math.max(
            analyticalKeyword ? analyticalKeyword.weight : testConfig.scoring.defaultAnalyticalScore, 
            plotKeywordWeight
        );

        const result: HeuristicOutput = await service.runHeuristics(query);
        expect(result.isAnalyticalIntent).toBe(true);
        expect(result.requestsVisualization).toBe(true);
        expect(result.analyticalScore).toEqual(expectedAnalyticalScore);
    });

    it('should correctly apply score clamping (max)', async () => {
        // A query designed to hit multiple high-score triggers for analytical score
        const query: PreprocessedQuery = { 
            originalQuery: 'analyze sales.csv and plot python code for prediction', 
            normalizedQuery: 'analyze sales.csv and plot python code for prediction' 
        };
        // In this setup, 'analyze' (1.0) + dataset (0.6) + viz (0.5) + code (0.5) would exceed 1.0 if simply summed.
        // The current Math.max logic will take the highest single contributor or the default.
        // Let's verify it doesn't exceed maxScore based on current logic using Math.max
        // The actual score will be Math.max(default, analyze.weight, datasetMention.weight, viz.weight, code.weight)
        // and then clamped.
        
        let expectedMaxScoreContribution = testConfig.scoring.defaultAnalyticalScore;
        const analyzeKeyword = testConfig.analyticalKeywords.find((k: KeywordConfigItem) => k.keyword === "analyze");
        if(analyzeKeyword) expectedMaxScoreContribution = Math.max(expectedMaxScoreContribution, analyzeKeyword.weight);
        expectedMaxScoreContribution = Math.max(expectedMaxScoreContribution, testConfig.scoring.weights.datasetMention);
        expectedMaxScoreContribution = Math.max(expectedMaxScoreContribution, testConfig.scoring.weights.visualizationRequest);
        expectedMaxScoreContribution = Math.max(expectedMaxScoreContribution, testConfig.scoring.weights.codeMention);


        const result: HeuristicOutput = await service.runHeuristics(query);
        expect(result.analyticalScore).toBeLessThanOrEqual(testConfig.scoring.maxScore);
        expect(result.analyticalScore).toEqual(Math.min(testConfig.scoring.maxScore, Math.max(testConfig.scoring.minScore, expectedMaxScoreContribution)));
      });

      it('should correctly apply score clamping (min)', async () => {
        // Temporarily set a default score that's below minScore to test clamping
        const tempConfig = JSON.parse(JSON.stringify(testConfig)); // deep clone
        tempConfig.scoring.defaultAnalyticalScore = -0.5; // Below minScore
        tempConfig.scoring.minScore = 0.0;
        (service as any).config = tempConfig; // Override config for this test
    
        const query: PreprocessedQuery = { originalQuery: 'neutral phrase', normalizedQuery: 'neutral phrase' };
        const result: HeuristicOutput = await service.runHeuristics(query);
    
        expect(result.analyticalScore).toEqual(tempConfig.scoring.minScore);
        expect(result.analyticalScore).toBeGreaterThanOrEqual(tempConfig.scoring.minScore);
        
        // Reset config for subsequent tests
        (service as any).config = testConfig; 
      });
  });
}); 