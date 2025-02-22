import { LocalFileType, LocalFileMetadata } from '../components/DataSources/types';

export class LocalFileService {
  private static instance: LocalFileService;
  private mockFiles: LocalFileMetadata[] = [];

  private constructor() {}

  public static getInstance(): LocalFileService {
    if (!LocalFileService.instance) {
      LocalFileService.instance = new LocalFileService();
    }
    return LocalFileService.instance;
  }

  private getFileType(filename: string): LocalFileType {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'csv':
        return 'csv';
      case 'pdf':
        return 'pdf';
      case 'xlsx':
      case 'xls':
        return 'excel';
      case 'json':
        return 'json';
      default:
        throw new Error('Unsupported file type');
    }
  }

  public async uploadFile(file: File): Promise<LocalFileMetadata> {
    try {
      // Read file content
      const content = await this.readFileContent(file);
      const records = this.countRecords(content, file.name);
      const preview = this.generatePreview(content, file.name);
      
      console.log('File content parsed:', {
        contentLength: content.length,
        recordsCount: records,
        preview: preview.slice(0, 100) // Just log first 100 chars of preview
      });
      
      // Create file metadata
      const metadata: LocalFileMetadata = {
        id: Math.random().toString(36).substring(7),
        filename: file.name,
        fileType: this.getFileType(file.name),
        size: file.size,
        uploadedAt: new Date(),
        lastModified: new Date(file.lastModified),
        status: 'ready',
        records,
        content,
        preview
      };

      // Store in mock storage
      this.mockFiles.push(metadata);
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('File uploaded with metadata:', {
        ...metadata,
        content: content.slice(0, 2), // Just log first 2 records
        records,
        preview: preview.slice(0, 100) // Just log first 100 chars of preview
      });
      
      return metadata;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  private async readFileContent(file: File): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const fileType = this.getFileType(file.name);
          
          switch (fileType) {
            case 'csv': {
              // Improved CSV parsing
              const lines = content.split('\n').filter(line => line.trim());
              const headers = lines[0].split(',').map(h => h.trim());
              const records = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim());
                return headers.reduce((obj, header, i) => {
                  obj[header] = values[i] || '';
                  return obj;
                }, {} as Record<string, string>);
              }).filter(record => Object.values(record).some(v => v));
              console.log('Parsed CSV records:', records.slice(0, 2));
              resolve(records);
              break;
            }
            case 'json': {
              const parsed = JSON.parse(content);
              const records = Array.isArray(parsed) ? parsed : [parsed];
              console.log('Parsed JSON records:', records.slice(0, 2));
              resolve(records);
              break;
            }
            case 'excel':
            case 'pdf': {
              // For demo purposes, create mock structured data
              const mockData = Array.from({ length: 10 }, (_, i) => ({
                row: i + 1,
                content: `Mock ${fileType.toUpperCase()} content for row ${i + 1}`
              }));
              console.log(`Mock ${fileType.toUpperCase()} data:`, mockData.slice(0, 2));
              resolve(mockData);
              break;
            }
            default:
              resolve([]);
          }
        } catch (error) {
          console.error('Error parsing file:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => {
        console.error('FileReader error:', reader.error);
        reject(reader.error);
      };
      
      if (this.getFileType(file.name) === 'json' || this.getFileType(file.name) === 'csv') {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  private countRecords(content: any[], filename: string): number {
    const fileType = this.getFileType(filename);
    const count = content.length;
    console.log(`Counting records for ${fileType} file:`, count);
    return count;
  }

  private generatePreview(content: any[], filename: string): string {
    const fileType = this.getFileType(filename);
    
    switch (fileType) {
      case 'csv': {
        // Create a more readable CSV preview
        const records = content.slice(0, 5);
        if (records.length === 0) return 'No records found';
        
        const headers = Object.keys(records[0]);
        const preview = [
          'CSV Preview (first 5 records):',
          '',
          headers.join(', '),
          ...records.map(record => 
            headers.map(header => record[header]).join(', ')
          )
        ].join('\n');
        
        return preview;
      }
      case 'json':
        return JSON.stringify(content.slice(0, 5), null, 2);
      case 'excel':
        return `Excel file with ${content.length} rows`;
      case 'pdf':
        return `PDF file with ${content.length} pages`;
      default:
        return 'No preview available';
    }
  }

  public async getFileData(fileId: string): Promise<{ metadata: LocalFileMetadata; content: any[]; preview: string }> {
    const metadata = this.mockFiles.find(f => f.id === fileId);
    if (!metadata) {
      throw new Error('File not found');
    }
    
    return {
      metadata,
      content: metadata.content || [],
      preview: metadata.preview || 'No preview available'
    };
  }

  public async getAllFiles(): Promise<LocalFileMetadata[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    return this.mockFiles;
  }

  public async deleteFile(fileId: string): Promise<void> {
    this.mockFiles = this.mockFiles.filter(f => f.id !== fileId);
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  public async previewFile(fileId: string): Promise<string> {
    const file = this.mockFiles.find(f => f.id === fileId);
    if (!file) {
      throw new Error('File not found');
    }
    return 'Mock preview content';
  }
} 