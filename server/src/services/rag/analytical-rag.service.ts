import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { OpenAIService, ChatMessage } from '../ai/openai.service';
import { SandboxManagerService, SandboxExecutionResult } from '../sandbox/sandbox-manager.service';

export interface AnalyticalArtifact {
  type: 'code' | 'chart' | 'table' | 'file';
  name: string;
  content?: string;
  url?: string;
  mimeType?: string;
  size?: number;
}

export interface AnalyticalResponse {
  finalAnswer: string;
  artifacts: AnalyticalArtifact[];
  codeExecuted: string[];
  reasoning: string[];
  success: boolean;
  error?: string;
  executionTime: number;
}

interface AgentStep {
  thought: string;
  action?: {
    tool: string;
    code?: string;
  };
  observation?: string;
  timestamp: number;
}

@Injectable()
export class AnalyticalRAGService {
  private readonly logger = createServiceLogger(AnalyticalRAGService.name);
  private readonly maxIterations: number;
  private readonly analyticalModel: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly openAIService: OpenAIService,
    private readonly sandboxManager: SandboxManagerService,
  ) {
    this.maxIterations = parseInt(this.configService.get<string>('ANALYTICAL_MAX_ITERATIONS') || '10');
    this.analyticalModel = this.configService.get<string>('ANALYTICAL_MODEL') || 'gpt-4-turbo-preview';
    
    this.logger.info('AnalyticalRAGService initialized', {
      maxIterations: this.maxIterations,
      analyticalModel: this.analyticalModel,
    });
  }

  /**
   * Process an analytical query using the ReAct agent loop
   */
  async processAnalyticalQuery(
    sessionId: string,
    query: string,
    context?: string
  ): Promise<AnalyticalResponse> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    const codeExecuted: string[] = [];
    const artifacts: AnalyticalArtifact[] = [];

    this.logger.info(`Starting analytical query processing for session: ${sessionId}`, { query });

    try {
      // Initialize the agent conversation
      let conversationHistory: ChatMessage[] = [
        {
          id: 'system',
          role: 'system',
          content: this.getSystemPrompt(),
          timestamp: Date.now(),
          status: 'complete'
        },
        {
          id: 'user-query',
          role: 'user',
          content: this.formatInitialQuery(query, context),
          timestamp: Date.now(),
          status: 'complete'
        }
      ];

      let iteration = 0;
      let finalAnswer = '';
      let isComplete = false;

      // ReAct loop
      while (iteration < this.maxIterations && !isComplete) {
        iteration++;
        this.logger.debug(`Agent iteration ${iteration}/${this.maxIterations}`);

        // Get agent's next action
        const agentResponse = await this.getAgentResponse(conversationHistory);
        const step = this.parseAgentResponse(agentResponse);
        steps.push(step);

        // Add agent response to conversation
        conversationHistory.push({
          id: `agent-${iteration}`,
          role: 'assistant',
          content: agentResponse,
          timestamp: Date.now(),
          status: 'complete'
        });

        // Check if agent wants to execute code
        if (step.action && step.action.tool === 'Python' && step.action.code) {
          this.logger.debug(`Executing Python code in iteration ${iteration}`);
          
          try {
            // Execute code in sandbox
            const executionResult = await this.sandboxManager.executeCode(sessionId, step.action.code);
            codeExecuted.push(step.action.code);

            // Format observation
            const observation = this.formatExecutionObservation(executionResult);
            step.observation = observation;

            // Collect any new artifacts
            const newArtifacts = await this.collectArtifacts(sessionId, executionResult);
            artifacts.push(...newArtifacts);

            // Add observation to conversation
            conversationHistory.push({
              id: `observation-${iteration}`,
              role: 'user',
              content: `Observation: ${observation}`,
              timestamp: Date.now(),
              status: 'complete'
            });

          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.logger.error(`Code execution failed in iteration ${iteration}`, error);
            
            step.observation = `Error: ${errorMessage}`;
            conversationHistory.push({
              id: `error-${iteration}`,
              role: 'user',
              content: `Observation: Error executing code: ${errorMessage}`,
              timestamp: Date.now(),
              status: 'complete'
            });
          }
        }

        // Check if agent provided final answer
        if (this.isFinalAnswer(agentResponse)) {
          finalAnswer = this.extractFinalAnswer(agentResponse);
          isComplete = true;
          this.logger.info(`Agent completed analysis in ${iteration} iterations`);
        }
      }

      if (!isComplete) {
        this.logger.warn(`Agent reached max iterations (${this.maxIterations}) without completing`);
        finalAnswer = "I've reached the maximum number of analysis steps. Based on the work completed so far, here's what I found: " + 
                     (steps[steps.length - 1]?.thought || "Analysis was in progress but incomplete.");
      }

      const executionTime = Date.now() - startTime;

      return {
        finalAnswer,
        artifacts,
        codeExecuted,
        reasoning: steps.map(s => s.thought),
        success: true,
        executionTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Analytical query processing failed for session: ${sessionId}`, error);
      
      return {
        finalAnswer: `I encountered an error while processing your analytical query: ${errorMessage}`,
        artifacts,
        codeExecuted,
        reasoning: steps.map(s => s.thought),
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime
      };
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert data analyst and Python programmer. Your goal is to answer analytical queries by writing and executing Python code.

You have access to the following tool:
- Python: Execute Python code in a secure sandbox environment

You should follow this format for your responses:

Thought: [Your reasoning about what to do next]
Action: Python
\`\`\`python
# Your Python code here
\`\`\`

After executing code, you'll receive an observation with the output. Continue this process until you can provide a final answer.

When you're ready to give your final answer, use this format:
Final Answer: [Your comprehensive answer to the user's question]

Guidelines:
1. Always start by understanding the data and exploring it
2. Use appropriate data science libraries (pandas, numpy, matplotlib, seaborn, plotly, scikit-learn)
3. Create visualizations when helpful for understanding
4. Save plots using plt.savefig() or the save_plot() helper function
5. Provide clear, actionable insights
6. If you encounter errors, debug and try alternative approaches
7. Be thorough but efficient in your analysis

Available libraries are pre-imported:
- pandas as pd
- numpy as np
- matplotlib.pyplot as plt
- seaborn as sns
- plotly.express as px
- plotly.graph_objects as go
- sklearn (all modules)
- scipy

The sandbox has a /scratch directory for saving files. Use save_plot() helper function to save visualizations.`;
  }

  private formatInitialQuery(query: string, context?: string): string {
    let formattedQuery = `Please analyze the following query: ${query}`;
    
    if (context) {
      formattedQuery += `\n\nAdditional context: ${context}`;
    }
    
    formattedQuery += `\n\nPlease start by thinking about what analysis is needed and then proceed step by step.`;
    
    return formattedQuery;
  }

  private async getAgentResponse(conversationHistory: ChatMessage[]): Promise<string> {
    try {
      const response = await this.openAIService.generateChatCompletion(conversationHistory, {
        model: this.analyticalModel,
        temperature: 0.1, // Lower temperature for more consistent reasoning
        systemPrompt: this.getSystemPrompt()
      });

      const responseText = await response.text();
      const parsedResponse = JSON.parse(responseText);
      
      return parsedResponse.content || '';
    } catch (error) {
      this.logger.error('Failed to get agent response', error);
      throw new Error(`Failed to get agent response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseAgentResponse(response: string): AgentStep {
    const step: AgentStep = {
      thought: '',
      timestamp: Date.now()
    };

    // Extract thought - using multiline flag instead of dotall
    const thoughtMatch = response.match(/Thought:\s*([\s\S]*?)(?=\n(?:Action:|Final Answer:)|$)/);
    if (thoughtMatch) {
      step.thought = thoughtMatch[1].trim();
    }

    // Extract action - using multiline flag instead of dotall
    const actionMatch = response.match(/Action:\s*Python\s*```python\s*([\s\S]*?)\s*```/);
    if (actionMatch) {
      step.action = {
        tool: 'Python',
        code: actionMatch[1].trim()
      };
    }

    return step;
  }

  private formatExecutionObservation(result: SandboxExecutionResult): string {
    let observation = '';
    
    if (result.success) {
      observation += 'Code executed successfully.\n';
      
      if (result.stdout) {
        observation += `Output:\n${result.stdout}\n`;
      }
      
      if (result.files && result.files.length > 0) {
        observation += `Files created: ${result.files.map(f => f.name).join(', ')}\n`;
      }
    } else {
      observation += 'Code execution failed.\n';
      
      if (result.stderr) {
        observation += `Error:\n${result.stderr}\n`;
      }
      
      if (result.error) {
        observation += `Error message: ${result.error}\n`;
      }
    }
    
    observation += `Execution time: ${result.execution_time.toFixed(3)}s`;
    
    return observation;
  }

  private async collectArtifacts(sessionId: string, result: SandboxExecutionResult): Promise<AnalyticalArtifact[]> {
    const artifacts: AnalyticalArtifact[] = [];
    
    if (result.files && result.files.length > 0) {
      for (const file of result.files) {
        const artifact: AnalyticalArtifact = {
          type: this.getArtifactType(file.name),
          name: file.name,
          url: `/api/sandbox/${sessionId}/files/${file.name}`,
          size: file.size
        };
        
        // Set mime type based on file extension
        if (file.name.endsWith('.png')) {
          artifact.mimeType = 'image/png';
        } else if (file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
          artifact.mimeType = 'image/jpeg';
        } else if (file.name.endsWith('.csv')) {
          artifact.mimeType = 'text/csv';
        } else if (file.name.endsWith('.json')) {
          artifact.mimeType = 'application/json';
        }
        
        artifacts.push(artifact);
      }
    }
    
    return artifacts;
  }

  private getArtifactType(filename: string): AnalyticalArtifact['type'] {
    const ext = filename.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
        return 'chart';
      case 'csv':
      case 'json':
        return 'table';
      case 'py':
        return 'code';
      default:
        return 'file';
    }
  }

  private isFinalAnswer(response: string): boolean {
    return response.includes('Final Answer:');
  }

  private extractFinalAnswer(response: string): string {
    const match = response.match(/Final Answer:\s*(.*)/);
    return match ? match[1].trim() : response;
  }
} 