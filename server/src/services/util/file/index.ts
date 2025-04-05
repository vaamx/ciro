/**
 * File services module
 */

// We have two FileService implementations - export them with distinct names
export { FileService as LegacyFileService } from './FileService';
export * from './file-upload.service';
export * from './local-file.service';

// Main file service export - give this one priority by naming it simply FileService
import { FileService as DefaultFileService } from './file.service';
export { DefaultFileService as FileService };
