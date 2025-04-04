declare module 'uuid' {
  export function v1(options?: any): string;
  export function v3(name: string | Buffer, namespace: string | Buffer): string;
  export function v4(options?: any): string;
  export function v5(name: string | Buffer, namespace: string | Buffer): string;
  export function parse(uuid: string): Buffer;
  export function stringify(buf: Buffer): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
} 