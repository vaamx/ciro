import type { ChatMessage, ChatSettings, ChatUIConfig, ComposerProps, AssistantMessageProps, UserMessageProps } from '../types';
import type { ForwardRefExoticComponent, RefAttributes } from 'react';

export interface TypingIndicatorProps {
  participants: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
}

export interface MessageGroupProps {
  messages: ChatMessage[];
  isLastGroup: boolean;
  onRegenerate: (message: ChatMessage) => void;
  onCopy: (message: ChatMessage) => void;
  onPin?: (message: ChatMessage) => void;
  onBookmark?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage, newContent: string) => void;
  onDelete?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage, reaction: string) => void;
  onReply?: (message: ChatMessage) => void;
  showMetadata?: boolean;
  showAvatar?: boolean;
  showReactions?: boolean;
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  accentColor?: string;
}

export interface ThreadProps {
  messages: ChatMessage[];
  onMessageRegenerate: (message: ChatMessage) => void;
  onMessageCopy: (message: ChatMessage) => void;
  onMessagePin?: (message: ChatMessage) => void;
  onMessageBookmark?: (message: ChatMessage) => void;
  onMessageEdit?: (message: ChatMessage, newContent: string) => void;
  onMessageDelete?: (message: ChatMessage) => void;
  onMessageReact?: (message: ChatMessage, reaction: string) => void;
  onMessageReply?: (message: ChatMessage) => void;
  onClose: () => void;
  onSettingsClick: () => void;
  onClearChat: () => void;
  isGenerating: boolean;
  onSubmit: (message: string, attachments?: File[]) => void;
  settings: ChatSettings;
  uiConfig: ChatUIConfig;
  participants?: {
    id: string;
    name: string;
    avatar?: string;
    isTyping?: boolean;
  }[];
}

export interface ThreadHeaderProps {
  onClose: () => void;
  onSettingsClick: () => void;
  onClearChat: () => void;
  onCancelGeneration?: () => void;
  isGenerating?: boolean;
  participants?: {
    id: string;
    name: string;
    avatar?: string;
    isTyping?: boolean;
  }[];
  settings: ChatSettings;
  uiConfig: ChatUIConfig;
}

declare module './TypingIndicator' {
  export const TypingIndicator: React.FC<TypingIndicatorProps>;
}

declare module './MessageGroup' {
  export const MessageGroup: React.FC<MessageGroupProps>;
}

declare module './AssistantMessage' {
  export const AssistantMessage: React.FC<AssistantMessageProps>;
}

declare module './UserMessage' {
  export const UserMessage: React.FC<UserMessageProps>;
}

declare module './ErrorMessage' {
  export const ErrorMessage: React.FC<{ message: ChatMessage }>;
}

declare module './Thread' {
  export const Thread: ForwardRefExoticComponent<ThreadProps & RefAttributes<HTMLDivElement>>;
}

declare module './ThreadHeader' {
  export const ThreadHeader: React.FC<ThreadHeaderProps>;
}

declare module './Composer' {
  export const Composer: React.FC<ComposerProps>;
} 