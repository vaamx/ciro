import { IsString, IsNotEmpty, IsOptional, IsInt, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  organization_id?: number;

  // Add other potential fields like tags if needed
  // @IsArray()
  // @IsString({ each: true })
  // @IsOptional()
  // tags?: string[];
} 