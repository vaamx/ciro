declare module 'mammoth' {
    interface ConversionResult {
        value: string;
        messages: any[];
    }

    interface Options {
        path?: string;
        buffer?: Buffer;
        arrayBuffer?: ArrayBuffer;
    }

    export function extractRawText(options: Options): Promise<ConversionResult>;
    export function convertToHtml(options: Options): Promise<ConversionResult>;
    export function convertToMarkdown(options: Options): Promise<ConversionResult>;
} 