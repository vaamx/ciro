declare module 'sharp' {
  interface Sharp {
    resize(width?: number, height?: number, options?: any): Sharp;
    toBuffer(): Promise<Buffer>;
    toFile(path: string): Promise<void>;
    metadata(): Promise<any>;
    jpeg(options?: JpegOptions): Sharp;
    png(options?: PngOptions): Sharp;
    webp(options?: WebpOptions): Sharp;
    rotate(angle?: number, options?: RotateOptions): Sharp;
    composite(images: OverlayOptions[]): Sharp;
    trim(threshold?: number): Sharp;
    extract(region: Region): Sharp;
    extend(options: ExtendOptions): Sharp;
  }

  interface JpegOptions {
    quality?: number;
    progressive?: boolean;
    chromaSubsampling?: string;
    optimizeCoding?: boolean;
    mozjpeg?: boolean;
    trellisQuantisation?: boolean;
    overshootDeringing?: boolean;
    optimizeScans?: boolean;
    quantisationTable?: number;
  }

  interface PngOptions {
    progressive?: boolean;
    compressionLevel?: number;
    adaptiveFiltering?: boolean;
    palette?: boolean;
    quality?: number;
    effort?: number;
    colors?: number;
    dither?: number;
  }

  interface WebpOptions {
    quality?: number;
    alphaQuality?: number;
    lossless?: boolean;
    nearLossless?: boolean;
    smartSubsample?: boolean;
    effort?: number;
  }

  interface RotateOptions {
    background?: string | object;
  }

  interface Region {
    left: number;
    top: number;
    width: number;
    height: number;
  }

  interface ExtendOptions {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
    background?: string | object;
  }

  interface OverlayOptions {
    input: string | Buffer;
    gravity?: number;
    top?: number;
    left?: number;
    tile?: boolean;
    blend?: string;
    cutout?: boolean;
  }

  interface SharpOptions {
    failOnError?: boolean;
  }

  interface SharpConstructor {
    (input?: Buffer | string, options?: SharpOptions): Sharp;
    (options?: SharpOptions): Sharp;
  }

  const sharp: SharpConstructor;
  export = sharp;
} 