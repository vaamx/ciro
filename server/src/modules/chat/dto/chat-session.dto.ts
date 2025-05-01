import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsArray, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChatSessionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsNumber()
  @IsOptional()
  organization_id?: number;

  @IsString()
  @IsOptional()
  dashboard_id?: string;
}

export class UpdateChatSessionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class ChatMessageDto {
  @IsString()
  role!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class AddMessagesToHistoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

// Response DTOs (for documentation and typing)
export interface ChatSessionResponseDto {
  id: string;
  title: string;
  user_id: string;
  organization_id?: number | null;
  dashboard_id?: string;
  created_at: Date;
  updated_at: Date;
  last_message?: string;
  message_count?: number;
  is_active?: boolean;
  metadata?: any;
} 