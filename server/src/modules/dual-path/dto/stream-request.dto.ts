import { IsString, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QueryOptionsDto } from './query-request.dto';

export class StreamRequestDto {
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