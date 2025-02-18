import { type MessageStatus as AssistantMessageStatus } from '@assistant-ui/react';

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
  role: MessageRole;
  content: string;
  status: MessageStatus;
  metadata?: MessageMetadata;
}

export interface MessageProps {
  children: React.ReactNode;
  onCopy?: () => void;
  onReload?: () => void;
}

export interface ComposerProps {
  onSubmit: (message: string) => void;
  placeholder?: string;
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