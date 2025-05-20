import { IsNotEmpty, IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';

export class FindTablesDto {
  @IsNotEmpty()
  @IsString()
  query!: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  limit?: number;
} 