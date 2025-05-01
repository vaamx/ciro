import { Injectable } from '@nestjs/common';
import { Document, ContextBuilderOptions, ContextFormat } from '../vector/vector.interfaces';

/**
 * Context builder service for creating appropriate context for LLM from retrieved documents
 */
@Injectable()
export class ContextBuilderService {
  /**
   * Builds context from a list of documents
   */
  buildContext(documents: Document[], options: ContextBuilderOptions = {}): string {
    const {
      maxChars = 8000,
      maxDocuments = 10,
      format = ContextFormat.STRING
    } = options;

    // Limit the number of documents
    const limitedDocs = documents.slice(0, maxDocuments);

    // Process based on format
    switch (format) {
      case ContextFormat.MARKDOWN:
        return this.buildMarkdownContext(limitedDocs, maxChars);
      case ContextFormat.ARRAY:
        return this.buildArrayContext(limitedDocs, maxChars);
      case ContextFormat.STRING:
      default:
        return this.buildStringContext(limitedDocs, maxChars);
    }
  }

  /**
   * Builds a plain string context
   */
  private buildStringContext(documents: Document[], maxChars: number): string {
    let context = '';
    let totalChars = 0;

    for (const doc of documents) {
      const content = doc.content || '';
      if (totalChars + content.length > maxChars) {
        // Add as much as we can to stay within the limit
        const remainingChars = maxChars - totalChars;
        if (remainingChars > 50) { // Only add if there's enough space for meaningful content
          context += content.substring(0, remainingChars) + '...';
        }
        break;
      }

      context += content + '\n\n';
      totalChars += content.length + 2; // +2 for the newlines
    }

    return context.trim();
  }

  /**
   * Builds a markdown-formatted context with document metadata
   */
  private buildMarkdownContext(documents: Document[], maxChars: number): string {
    let context = '';
    let totalChars = 0;

    for (const [index, doc] of documents.entries()) {
      const metadata = doc.metadata || {};
      const title = metadata.title || `Document ${index + 1}`;
      const source = metadata.source || 'Unknown source';
      
      const header = `## ${title}\nSource: ${source}\n\n`;
      const content = doc.content || '';
      
      const thisDocLength = header.length + content.length + 4; // +4 for the separators
      
      if (totalChars + thisDocLength > maxChars) {
        // Add as much as we can to stay within the limit
        const remainingChars = maxChars - totalChars - header.length - 4;
        if (remainingChars > 100) { // Only add if there's enough space for meaningful content
          context += header + content.substring(0, remainingChars) + '...\n\n---\n\n';
        }
        break;
      }

      context += header + content + '\n\n---\n\n';
      totalChars += thisDocLength;
    }

    return context.trim();
  }

  /**
   * Builds a JSON-like array string representation
   */
  private buildArrayContext(documents: Document[], maxChars: number): string {
    const contextItems = [];
    let totalChars = 2; // Account for [] brackets

    for (const doc of documents) {
      const content = doc.content || '';
      const metadata = JSON.stringify(doc.metadata || {});
      
      // Estimate the length of this document in the array
      const thisDocLength = content.length + metadata.length + 10; // +10 for formatting
      
      if (totalChars + thisDocLength > maxChars) {
        break;
      }

      contextItems.push({ content, metadata: doc.metadata || {} });
      totalChars += thisDocLength;
    }

    return JSON.stringify(contextItems);
  }

  /**
   * Creates a context string optimized for specific query types
   */
  buildOptimizedContext(query: string, documents: Document[], options: ContextBuilderOptions = {}): string {
    // Simplified implementation - could be enhanced with query type detection
    return this.buildContext(documents, options);
  }
}

export default ContextBuilderService; 