import { IsString, IsOptional } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
  
  // Add other optional fields like tags if needed
  // @IsArray()
  // @IsString({ each: true })
  // @IsOptional()
  // tags?: string[];
} 