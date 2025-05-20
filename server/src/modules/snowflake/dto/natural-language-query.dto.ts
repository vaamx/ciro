import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class NaturalLanguageQueryDto {
  @IsNotEmpty()
  @IsString()
  query!: string;

  @IsOptional()
  @IsObject()
  options?: Record<string, any>;
} 