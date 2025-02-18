import { type ThreadConfig } from '@assistant-ui/react-ui';
import { type TextContentPart, type ToolCallContentPart } from '@assistant-ui/react';

interface TextProps extends TextContentPart {
  text: string;
}

const Text = ({ text }: TextProps) => (
  <div className="prose dark:prose-invert max-w-none">
    {text}
  </div>
);

const Empty = () => (
  <div className="text-gray-500 dark:text-gray-400 italic">
    No content available
  </div>
);

interface ToolFallbackProps extends ToolCallContentPart {
  toolName: string;
}

const ToolFallback = ({ toolName }: ToolFallbackProps) => (
  <div className="text-gray-500 dark:text-gray-400">
    Using tool: {toolName}
  </div>
);

export const assistantConfig: ThreadConfig = {
  assistantAvatar: {
    fallback: 'C',
    src: '/ciro-avatar.png',
  },
  assistantMessage: {
    allowReload: true,
    allowCopy: true,
    allowSpeak: false,
    components: {
      Text,
      Empty,
      ToolFallback,
    },
  },
  userMessage: {
    allowEdit: false,
  },
  composer: {
    allowAttachments: true,
  },
  strings: {
    composer: {
      input: {
        placeholder: "Type your message...",
      },
      send: {
        tooltip: "Send message",
      },
      cancel: {
        tooltip: "Cancel",
      },
      addAttachment: {
        tooltip: "Add attachment",
      },
    },
    assistantMessage: {
      reload: {
        tooltip: "Regenerate response",
      },
      copy: {
        tooltip: "Copy to clipboard",
      },
    },
    thread: {
      scrollToBottom: {
        tooltip: "Scroll to bottom",
      },
    },
  },
}; 