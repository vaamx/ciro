import { IsString, IsOptional, IsObject } from 'class-validator';

export class ProxyRequestDto {
  @IsString()
  @IsOptional()
  path?: string;

  @IsObject()
  @IsOptional()
  payload?: Record<string, any>;
}

export class ProxyResponseDto {
  data!: any;
  status!: number;
  headers?: Record<string, string>;
} 