/**
 * Service for document processing
 */
export class DocumentProcessor {
  /**
   * Split text into chunks
   */
  public splitTextIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    if (!text) return [];
    
    const chunks: string[] = [];
    let startIndex = 0;
    
    while (startIndex < text.length) {
      // Calculate end index with overlap
      const endIndex = Math.min(startIndex + chunkSize, text.length);
      
      // Extract chunk
      const chunk = text.substring(startIndex, endIndex);
      chunks.push(chunk);
      
      // Move to next chunk with overlap
      startIndex = endIndex - overlap;
      
      // If we're near the end, just add the last chunk and break
      if (startIndex + chunkSize >= text.length) {
        if (startIndex < text.length) {
          chunks.push(text.substring(startIndex));
        }
        break;
      }
    }
    
    return chunks;
  }
  
  /**
   * Extract text from HTML
   */
  public extractTextFromHtml(html: string): string {
    if (!html) return '';
    
    // Simple HTML tag removal (for more complex cases, use a proper HTML parser)
    return html
      .replace(/<[^>]*>/g, ' ') // Replace HTML tags with spaces
      .replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
      .trim();
  }
  
  /**
   * Clean and normalize text
   */
  public cleanText(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/\r\n/g, '\n')   // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newlines
      .replace(/\s+/g, ' ')     // Replace multiple spaces with a single space
      .trim();
  }
} 