// Define local types instead of importing from external modules
interface ThreadConfig {
  assistantAvatar?: {
    fallback?: string;
    src?: string;
  };
  assistantMessage?: {
    allowReload?: boolean;
    allowCopy?: boolean;
    allowSpeak?: boolean;
    components?: Record<string, any>;
  };
  userMessage?: {
    allowEdit?: boolean;
  };
  composer?: {
    allowAttachments?: boolean;
  };
  strings?: {
    composer?: {
      input?: {
        placeholder?: string;
      };
      send?: {
        tooltip?: string;
      };
      cancel?: {
        tooltip?: string;
      };
      addAttachment?: {
        tooltip?: string;
      };
    };
    assistantMessage?: {
      reload?: {
        tooltip?: string;
      };
      copy?: {
        tooltip?: string;
      };
    };
    thread?: {
      scrollToBottom?: {
        tooltip?: string;
      };
    };
  };
}

interface TextContentPart {
  text: string;
}

interface ToolCallContentPart {
  toolName: string;
}

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
    src: '/ciro-avatar.svg',
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