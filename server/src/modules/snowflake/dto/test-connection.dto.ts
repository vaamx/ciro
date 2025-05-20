import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class TestConnectionDto {
  @IsNotEmpty()
  @IsString()
  account!: string;

  @IsNotEmpty()
  @IsString()
  username!: string;

  @IsNotEmpty()
  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  database?: string;

  @IsOptional()
  @IsString()
  schema?: string;

  @IsOptional()
  @IsString()
  warehouse?: string;

  @IsOptional()
  @IsString()
  role?: string;
} 