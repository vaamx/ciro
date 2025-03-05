declare module 'mime-types' {
  export function lookup(path: string): string | false;
  export function contentType(type: string): string | false;
  export function extension(type: string): string | false;
  export function charset(type: string): string | false;
  export const types: Record<string, string>;
  export const extensions: Record<string, string[]>;
} 