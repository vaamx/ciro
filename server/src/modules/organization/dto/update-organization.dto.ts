import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
  
  @IsBoolean()
  @IsOptional()
  removeLogo?: boolean; // Flag to explicitly remove logo
} 