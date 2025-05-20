import { ChunkingOptions } from '../interfaces';

// Default numerical values
export const DEFAULT_CHUNK_SIZE = 1000;
export const DEFAULT_OVERLAP = 200;
export const DEFAULT_MIN_CHUNK_SIZE = 100;

// Default options object
export const DEFAULT_CHUNKING_OPTIONS: Required<ChunkingOptions> = {
    chunkSize: DEFAULT_CHUNK_SIZE,
    overlap: DEFAULT_OVERLAP,
    minChunkSize: DEFAULT_MIN_CHUNK_SIZE,
    maxChunkSize: DEFAULT_CHUNK_SIZE * 2, // Default max size (can be overridden)
    splitBySection: true,
    preserveParagraphs: true,
    smartChunking: true,
    respectDocumentStructure: true,
    adaptiveChunking: true,
    semanticSplitting: true
};

// Patterns for identifying section boundaries
export const SECTION_PATTERNS: RegExp[] = [
    /^#+\s+.+$/m, // Markdown headings
    /^[A-Z\s]{3,}$/m, // ALL CAPS HEADINGS
    /^[\d.]+\s+[A-Z]/, // Numbered sections like "1.2 Title"
    /^(Section|Chapter|Part)\s+\d+/i, // Explicit section markers
];

// Patterns for identifying paragraph boundaries
export const PARAGRAPH_PATTERNS: RegExp[] = [
    /\n\s*\n/, // Double newline
    /\r\n\s*\r\n/, // Windows-style double newline
]; 