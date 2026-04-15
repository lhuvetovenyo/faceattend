// TypeScript declarations for window.faceapi global
// Loaded via <script> tag from jsDelivr CDN (@vladmandic/face-api UMD bundle)

export interface FaceDetectionWithDescriptor {
  descriptor: Float32Array;
  detection: {
    score: number;
    box: { x: number; y: number; width: number; height: number };
  };
}

export interface SsdMobilenetv1Opts {
  minConfidence?: number;
  maxResults?: number;
}

export interface FaceApiNets {
  ssdMobilenetv1: {
    loadFromUri(uri: string): Promise<void>;
    isLoaded: boolean;
  };
  faceLandmark68Net: {
    loadFromUri(uri: string): Promise<void>;
    isLoaded: boolean;
  };
  faceRecognitionNet: {
    loadFromUri(uri: string): Promise<void>;
    isLoaded: boolean;
  };
}

export interface FaceDetectionChain {
  withFaceLandmarks(useTinyModel?: boolean): {
    withFaceDescriptor(): Promise<FaceDetectionWithDescriptor | undefined>;
  };
}

export interface FaceApiGlobal {
  nets: FaceApiNets;
  SsdMobilenetv1Options: new (opts?: SsdMobilenetv1Opts) => object;
  detectSingleFace(
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    options: object,
  ): FaceDetectionChain;
  euclideanDistance(a: Float32Array, b: Float32Array): number;
  env: {
    monkeyPatch(api: {
      Canvas?: unknown;
      Image?: unknown;
      ImageData?: unknown;
      Video?: unknown;
      createCanvasElement?: unknown;
      createImageElement?: unknown;
    }): void;
  };
}

declare global {
  interface Window {
    faceapi: FaceApiGlobal | undefined;
  }
}
