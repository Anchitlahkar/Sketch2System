/**
 * Client-side image downscaling.
 *
 * A modern phone photo is 3-5MB and a desktop webcam frame is not much smaller, but a
 * Vercel serverless function rejects a request body over 4.5MB — and base64 inflates
 * the payload by a third, so a raw photo could not reach the API at all. Downscaling
 * before upload keeps payloads in the hundreds of kilobytes, which also cuts upload
 * time and Gemini's own decode cost.
 *
 * 1600px on the long edge preserves handwriting legibility comfortably; the model is
 * reading pen strokes, not fine print.
 */

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
const OUTPUT_MIME = 'image/jpeg';

export interface DownscaledImage {
  dataUrl: string;
  mimeType: string;
  /** Approximate encoded size in bytes, for reporting and limit checks. */
  bytes: number;
}

function approximateBytes(dataUrl: string): number {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.floor((base64.length * 3) / 4);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode that image.'));
    image.src = src;
  });
}

/** Scales a data URL down so its long edge is at most `maxDimension`. */
export async function downscaleDataUrl(
  dataUrl: string,
  maxDimension: number = MAX_DIMENSION,
): Promise<DownscaledImage> {
  const image = await loadImage(dataUrl);
  const longEdge = Math.max(image.naturalWidth, image.naturalHeight);

  // Already small enough and already JPEG: leave it alone rather than re-encoding,
  // which would only lose quality.
  if (longEdge <= maxDimension && dataUrl.startsWith(`data:${OUTPUT_MIME}`)) {
    return { dataUrl, mimeType: OUTPUT_MIME, bytes: approximateBytes(dataUrl) };
  }

  const scale = Math.min(1, maxDimension / longEdge);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);

  const out = canvas.toDataURL(OUTPUT_MIME, JPEG_QUALITY);
  return { dataUrl: out, mimeType: OUTPUT_MIME, bytes: approximateBytes(out) };
}

/** Reads a File and returns it downscaled. */
export async function downscaleFile(file: File, maxDimension: number = MAX_DIMENSION): Promise<DownscaledImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Could not read that file.'));
    };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });

  return downscaleDataUrl(dataUrl, maxDimension);
}
