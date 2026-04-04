export type FaceApi = any;
export const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

/**
 * Returns the face-api.js global once the CDN script has loaded.
 * Polls for up to 10 seconds, then resolves null.
 */
export async function getFaceApi(): Promise<FaceApi | null> {
  // Already loaded
  if (typeof window !== "undefined" && (window as any).faceapi) {
    return (window as any).faceapi;
  }

  // Wait for CDN script to load (up to 10s)
  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      if ((window as any).faceapi) {
        clearInterval(interval);
        resolve((window as any).faceapi);
        return;
      }
      elapsed += 200;
      if (elapsed >= 10000) {
        clearInterval(interval);
        resolve(null);
      }
    }, 200);
  });
}
