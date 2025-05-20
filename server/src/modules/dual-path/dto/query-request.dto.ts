import { IsString, IsArray, IsOptional, ValidateNested, IsObject, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryOptionsDto {
  @IsOptional()
  @IsNumber()
  readonly temperature?: number;

  @IsOptional()
  @IsNumber()
  readonly maxTokens?: number;

  @IsOptional()
  @IsObject()
  readonly additionalOptions?: Record<string, any>;
}

export class QueryRequestDto {
  @IsString()
  readonly query!: string;

  @IsOptional()
  @IsArray()
  readonly dataSourceIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => QueryOptionsDto)
  readonly options?: QueryOptionsDto;
} 