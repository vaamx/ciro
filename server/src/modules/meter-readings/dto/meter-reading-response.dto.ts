import { ReadingType } from '@prisma/client';

export class MeterReadingResponseDto {
  id: number;
  customerId: number;
  readingDate: string;
  readingValue: number;
  demandReading?: number;
  readingType: ReadingType;
  meterNumber?: string;
  notes?: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;

  // Customer information
  customer?: {
    id: number;
    name: string;
    accountNumber: string;
    client: {
      id: number;
      name: string;
    };
  };
} 