import { IsOptional, IsString } from 'class-validator';

export class SearchQueryParamsDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsString()
  @IsOptional()
  fileIds?: string;

  @IsString()
  @IsOptional()
  limit?: string;

  @IsString()
  @IsOptional()
  userId?: string;
} 