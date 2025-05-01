import { IsNotEmpty, IsArray, ArrayMinSize, IsString } from 'class-validator';

export class CreateEmbeddingsDto {
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tables!: string[];
} 