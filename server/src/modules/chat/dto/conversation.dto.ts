import { IsString, IsOptional, IsArray, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsArray()
  @IsNotEmpty()
  participants!: string[]; // Array of user IDs
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

// Response DTOs (for documentation and typing)
export class ConversationResponseDto {
  @IsUUID()
  id!: string;

  @IsString()
  title!: string;

  @IsString()
  created_by!: string;

  created_at!: Date;
  updated_at!: Date;
}

export class MessageResponseDto {
  @IsUUID()
  id!: string;

  @IsUUID()
  conversation_id!: string;

  @IsString()
  user_id!: string;

  @IsString()
  content!: string;

  @IsString()
  role!: string;

  created_at!: Date;

  @IsOptional()
  metadata?: Record<string, any>;
} 