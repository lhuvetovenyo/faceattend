// Type re-exports for face-api global — used only for typing purposes
// The actual runtime object comes from the CDN script (window.faceapi)

export declare const nets: {
  tinyFaceDetector: { loadFromUri(url: string): Promise<void> };
  faceLandmark68TinyNet: { loadFromUri(url: string): Promise<void> };
  faceRecognitionNet: { loadFromUri(url: string): Promise<void> };
};

export declare class TinyFaceDetectorOptions {
  constructor(options?: { inputSize?: number; scoreThreshold?: number });
}

export declare function detectSingleFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement,
  options: TinyFaceDetectorOptions,
): {
  withFaceLandmarks(useTinyModel?: boolean): {
    withFaceDescriptor(): Promise<
      | {
          descriptor: Float32Array;
        }
      | undefined
    >;
  };
};

export declare function euclideanDistance(
  a: Float32Array,
  b: Float32Array,
): number;
