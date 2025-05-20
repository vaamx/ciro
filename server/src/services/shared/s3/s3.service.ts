import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(S3Service.name);
  
  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    this.bucket = this.configService.get<string>('S3_BUCKET') || '';
    
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
    
    this.s3Client = new S3Client({
      region,
      credentials: accessKeyId && secretAccessKey 
        ? { accessKeyId, secretAccessKey } 
        : undefined,
    });
    
    this.logger.log(`S3Service initialized with bucket: ${this.bucket}`);
  }
  
  /**
   * Upload a file to S3
   * @param key The S3 key (path) for the file
   * @param body The file content
   * @param contentType The file MIME type
   */
  async uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    
    try {
      await this.s3Client.send(command);
      this.logger.debug(`File uploaded to S3: ${key}`);
    } catch (error) {
      this.logger.error(`Error uploading file to S3: ${key}`, error);
      throw error;
    }
  }
  
  /**
   * Get a file from S3
   * @param key The S3 key (path) for the file
   * @returns The file content as a Buffer
   */
  async getFile(key: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    try {
      const response = await this.s3Client.send(command);
      
      // Check if response.Body exists and use transformToByteArray
      if (response.Body) {
        const byteArray = await response.Body.transformToByteArray();
        return Buffer.from(byteArray);
      } else {
        throw new Error('S3 response body is empty');
      }
    } catch (error) {
      this.logger.error(`Error getting file from S3: ${key}`, error);
      throw error;
    }
  }
  
  /**
   * Generate a presigned URL for downloading a file
   * @param key The S3 key (path) for the file
   * @param expiresIn The expiration time in seconds (default: 3600)
   * @returns The presigned URL
   */
  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    try {
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      this.logger.error(`Error generating signed URL for: ${key}`, error);
      throw error;
    }
  }
  
  /**
   * Delete a file from S3
   * @param key The S3 key (path) for the file
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    
    try {
      await this.s3Client.send(command);
      this.logger.debug(`File deleted from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Error deleting file from S3: ${key}`, error);
      throw error;
    }
  }
} 