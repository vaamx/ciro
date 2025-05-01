import { IsNotEmpty, IsString } from 'class-validator';
 
export class ExecuteQueryDto {
  @IsNotEmpty()
  @IsString()
  query!: string;
} 