declare module '@assistant-ui/react-ui' {
  export interface ThreadConfig {
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
}

declare module '@assistant-ui/react' {
  export interface TextContentPart {
    text?: string;
    [key: string]: any;
  }

  export interface ToolCallContentPart {
    toolName?: string;
    [key: string]: any;
  }
} 