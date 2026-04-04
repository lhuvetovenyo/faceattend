// Type stub for @vladmandic/face-api loaded via CDN
declare module "@vladmandic/face-api" {
  export const nets: {
    tinyFaceDetector: { loadFromUri(url: string): Promise<void> };
    faceLandmark68TinyNet: { loadFromUri(url: string): Promise<void> };
    faceRecognitionNet: { loadFromUri(url: string): Promise<void> };
  };

  export class TinyFaceDetectorOptions {
    constructor(options?: { inputSize?: number; scoreThreshold?: number });
  }

  interface WithFaceDescriptor {
    withFaceDescriptor(): Promise<{ descriptor: Float32Array } | undefined>;
  }

  interface WithFaceLandmarks extends WithFaceDescriptor {
    withFaceLandmarks(useTinyModel?: boolean): WithFaceDescriptor;
  }

  export function detectSingleFace(
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
    options: TinyFaceDetectorOptions,
  ): WithFaceLandmarks;

  export function euclideanDistance(a: Float32Array, b: Float32Array): number;
}
