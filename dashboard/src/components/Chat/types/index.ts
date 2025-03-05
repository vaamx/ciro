import { type MessageStatus as AssistantMessageStatus } from '@assistant-ui/react';
import type { ModelType } from './models';

export type { ModelType } from './models';
export type MessageStatus = AssistantMessageStatus | 'complete' | 'error' | 'loading';

export type MessageRole = 'user' | 'assistant' | 'error';

export type MessageMetadata = {
  visualization?: {
    type: string;
    config: Record<string, unknown>;
  };
  [key: string]: unknown;
};

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'error';
  content: string;
  timestamp: number;
  status?: 'pending' | 'complete' | 'error';
  metadata?: {
    model?: ModelType;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

export interface MessageProps {
  children: React.ReactNode;
  onCopy?: () => void;
  onReload?: () => void;
}

export interface ComposerProps {
  onSubmit: (message: string, attachments?: File[]) => void;
  placeholder?: string;
  isGenerating?: boolean;
  disabled?: boolean;
  streaming?: boolean;
  suggestions?: string[];
  mentionableUsers?: Array<{ id: string; name: string; avatar?: string }>;
  allowAttachments?: boolean;
  allowVoiceInput?: boolean;
  maxAttachmentSize?: number;
  supportedFileTypes?: string[];
}

export interface MessagesProps {
  messages: ChatMessage[];
  onCopyMessage?: (message: ChatMessage) => void;
  onReloadMessage?: (message: ChatMessage) => void;
}

export interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface DataSource {
  id: string;
  name: string;
  icon: string;
  type: 'internal' | 'customer';
  description?: string;
}

export interface ChatSettings {
  model: ModelType;
  temperature?: number;
  systemPrompt?: string;
  stream?: boolean;
}

export interface ChatService {
  generateResponse: (messages: ChatMessage[], settings: ChatSettings) => Promise<ChatMessage>;
  streamResponse: (messages: ChatMessage[], settings: ChatSettings) => AsyncGenerator<ChatMessage>;
} 