export type MessageStatus = 'complete' | 'error' | 'loading' | 'streaming' | 'thinking';

export type MessageRole = 'user' | 'assistant' | 'error' | 'system';

export interface BaseMetadata {
  model?: string;
  tokens?: number;
  time?: number;
  visualization?: {
    type: string;
    config: Record<string, unknown>;
  };
  suggestions?: string[];
  structuredResponse?: any;
  isAnalytical?: boolean;
  [key: string]: unknown;
}

export interface MessageMetadata extends BaseMetadata {
  streaming?: boolean;
  progress?: number;
  estimatedTime?: number;
  contextLength?: number;
  responseQuality?: number;
  
  // Flags for controlling message display
  suppressDirectDisplay?: boolean;
  structuredContentOnly?: boolean;
  suppressDuplicateDisplay?: boolean;
  useStructuredDisplay?: boolean;
  
  // Document-specific fields
  content_type?: string;
  filename?: string;
  source_type?: string;
  document_id?: string;
  file_type?: 'pdf' | 'excel' | 'csv' | 'docx' | 'text';
  document_metadata?: Record<string, any>;
  
  codeBlocks?: {
    language: string;
    code: string;
  }[];
  links?: {
    url: string;
    title: string;
    description?: string;
  }[];
  attachments?: {
    type: 'image' | 'file' | 'code';
    url: string;
    name: string;
    size?: number;
    preview?: string;
  }[];
  emotions?: {
    type: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  metadata?: MessageMetadata;
  timestamp?: number;
  reactions?: {
    type: string;
    count: number;
    reacted: boolean;
    users?: {
      id: string;
      name: string;
      avatar?: string;
    }[];
  }[];
  threadId?: string;
  parentMessageId?: string;
  isEdited?: boolean;
  editHistory?: {
    content: string;
    timestamp: number;
  }[];
  isPinned?: boolean;
  isBookmarked?: boolean;
  readBy?: {
    userId: string;
    timestamp: number;
  }[];
}

export interface ChatResponse {
  message: {
    content: string;
    metadata?: MessageMetadata;
  };
  streamingUrl?: string;
}

export interface ChatApi {
  getChatHistory: (sessionId: string) => Promise<ChatMessage[]>;
  sendMessage: (sessionId: string, message: string, dataSource?: string) => Promise<ChatResponse>;
  regenerateMessage: (messageId: string) => Promise<{ content: string; metadata?: MessageMetadata }>;
  reactToMessage?: (messageId: string, reaction: string) => Promise<void>;
  cancelGeneration?: () => Promise<void>;
}

export interface ChatSettings {
  model: string;
  temperature: number;
  streaming: boolean;
  contextLength: number;
  maxTokens?: number;
  stopSequences?: string[];
  systemPrompt?: string;
}

export interface ChatService {
  sendMessage(content: string, settings: ChatSettings): Promise<{
    content: string;
    metadata?: MessageMetadata;
  }>;
}

export interface ChatUIConfig {
  showTimestamps?: boolean;
  showAvatars?: boolean;
  showMetadata?: boolean;
  showReactions?: boolean;
  enableCopy?: boolean;
  enableRegenerate?: boolean;
  enableStreaming?: boolean;
  enableThreading?: boolean;
  enableEditing?: boolean;
  enablePinning?: boolean;
  enableBookmarks?: boolean;
  enableReadReceipts?: boolean;
  enableTypingIndicators?: boolean;
  enableCodeHighlighting?: boolean;
  enableMarkdownSupport?: boolean;
  enableFileAttachments?: boolean;
  enableEmojis?: boolean;
  enableMentions?: boolean;
  theme?: 'light' | 'dark' | 'system';
  accentColor?: string;
  fontFamily?: string;
  messageSpacing?: 'compact' | 'comfortable' | 'spacious';
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  isMobile?: boolean;
  animations?: {
    messageTransition?: boolean;
    typingIndicator?: boolean;
    scrollBehavior?: 'smooth' | 'auto';
  };
  messageActions?: {
    copy?: boolean;
    regenerate?: boolean;
    react?: boolean;
    edit?: boolean;
    delete?: boolean;
    pin?: boolean;
    bookmark?: boolean;
    share?: boolean;
    reply?: boolean;
  };
}

export interface ComposerProps {
  onSubmit: (message: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  isGenerating?: boolean;
  streaming?: boolean;
  suggestions?: string[];
  mentionableUsers?: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  allowAttachments?: boolean;
  allowVoiceInput?: boolean;
  maxAttachmentSize?: number;
  supportedFileTypes?: string[];
  className?: string;
  isMobile?: boolean;
}

export interface AssistantMessageProps {
  message: ChatMessage;
  onCopy: () => void;
  onReload: () => void;
  onPin?: () => void;
  onBookmark?: () => void;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onReact?: (reaction: string) => void;
  onReply?: () => void;
  isRunning: boolean;
  showAvatar?: boolean;
  showMetadata?: boolean;
  showReactions?: boolean;
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  accentColor?: string;
  isInGroup?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isMobile?: boolean;
}

export interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (content: string) => void;
  onDelete?: () => void;
  onReact?: (reaction: string) => void;
  onReply?: () => void;
  onPin?: () => void;
  onBookmark?: () => void;
  showAvatar?: boolean;
  showMetadata?: boolean;
  showReactions?: boolean;
  messageAlignment?: 'left' | 'right';
  bubbleStyle?: 'modern' | 'classic' | 'minimal';
  accentColor?: string;
  isInGroup?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isMobile?: boolean;
}

export interface DataSource {
  id: string;
  name: string;
  icon: string;
  type: 'internal' | 'customer';
  description?: string;
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
  onSettingsClick?: () => void;
  onClearChat: () => void;
  onCancelGeneration?: () => void;
  isGenerating: boolean;
  onSubmit: (message: string, attachments?: File[]) => void;
  settings?: ChatSettings;
  uiConfig: ChatUIConfig;
  participants?: {
    id: string;
    name: string;
    avatar?: string;
    isTyping?: boolean;
  }[];
  isMobile?: boolean;
} 