import type { FaceApiGlobal } from "./faceApiTypes";

export type FaceApi = FaceApiGlobal;

// Pinned version for stable model weights
export const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/model";

// Track whether model weights have already been loaded (module-level singleton)
let modelsLoadedGlobally = false;
let loadingPromise: Promise<FaceApi | null> | null = null;

/**
 * Returns the face-api.js global after the CDN script has loaded AND
 * model weights (SSD MobileNet V1 + FaceNet) have been downloaded.
 *
 * - Polls window.faceapi for up to 15s (CDN script load time)
 * - Then loads model weights from jsDelivr CDN (up to 3 retries)
 * - Returns null only if faceapi never appears OR all retries fail
 * - Singleton: multiple callers share the same loading promise
 */
export async function getFaceApi(): Promise<FaceApi | null> {
  // Already fully loaded — return immediately
  if (modelsLoadedGlobally && window.faceapi) {
    return window.faceapi as FaceApi;
  }

  // Deduplicate concurrent calls
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = _loadFaceApi();
  const result = await loadingPromise;
  // Reset promise so re-tries after failure can re-attempt
  if (!result) {
    loadingPromise = null;
  }
  return result;
}

async function _loadFaceApi(): Promise<FaceApi | null> {
  // Step 1: Wait for window.faceapi to appear (CDN script load)
  const fa = await _waitForGlobal(15000);
  if (!fa) {
    console.error(
      "[FaceAttend] face-api.js CDN script did not load within 15s. " +
        "Check network connection and that the <script> tag is present in index.html.",
    );
    return null;
  }

  // Step 2: Load model weights with retries
  const loaded = await _loadModels(fa, 3);
  if (!loaded) {
    return null;
  }

  modelsLoadedGlobally = true;
  console.info("[FaceAttend] face-api models loaded successfully ✓");
  return fa;
}

/** Poll window.faceapi until it appears or timeout expires */
function _waitForGlobal(timeoutMs: number): Promise<FaceApi | null> {
  if (window.faceapi) {
    return Promise.resolve(window.faceapi as FaceApi);
  }

  return new Promise((resolve) => {
    let elapsed = 0;
    const interval = setInterval(() => {
      if (window.faceapi) {
        clearInterval(interval);
        resolve(window.faceapi as FaceApi);
        return;
      }
      elapsed += 200;
      if (elapsed >= timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 200);
  });
}

/** Load SSD MobileNet V1 + FaceNet weights, with retry logic */
async function _loadModels(fa: FaceApi, maxRetries: number): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.info(
        `[FaceAttend] Loading face-api models (attempt ${attempt}/${maxRetries})...`,
      );

      // Skip networks already loaded (e.g. hot-reload scenarios)
      const loads: Promise<void>[] = [];
      if (!fa.nets.ssdMobilenetv1.isLoaded) {
        loads.push(fa.nets.ssdMobilenetv1.loadFromUri(MODEL_URL));
      }
      if (!fa.nets.faceLandmark68Net.isLoaded) {
        loads.push(fa.nets.faceLandmark68Net.loadFromUri(MODEL_URL));
      }
      if (!fa.nets.faceRecognitionNet.isLoaded) {
        loads.push(fa.nets.faceRecognitionNet.loadFromUri(MODEL_URL));
      }

      await Promise.all(loads);
      return true;
    } catch (err) {
      console.error(`[FaceAttend] Model load attempt ${attempt} failed:`, err);
      if (attempt < maxRetries) {
        // Back off before retrying
        await _sleep(1000 * attempt);
      }
    }
  }

  console.error(
    "[FaceAttend] All model load attempts failed. Falling back to manual mode.",
  );
  return false;
}

function _sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
