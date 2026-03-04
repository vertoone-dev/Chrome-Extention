/**
 * Image and data URL utility functions for GuideSnap.
 * @module image-utils
 */

/**
 * Converts a data URL to a Blob.
 * @param {string} dataUrl - The data URL string.
 * @returns {Blob} The resulting Blob object.
 */
export function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mime });
}

/**
 * Converts a Blob to a data URL.
 * @param {Blob} blob - The Blob to convert.
 * @returns {Promise<string>} Resolves with the data URL string.
 */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to convert Blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Compresses and optionally resizes an image represented as a data URL.
 * @param {string} dataUrl - The source image data URL.
 * @param {number} [quality=0.7] - JPEG quality (0–1).
 * @param {number} [maxWidth=1920] - Maximum width in pixels; the image is scaled proportionally if wider.
 * @returns {Promise<string>} Resolves with the compressed image as a data URL.
 */
export async function compressImage(dataUrl, quality = 0.7, maxWidth = 1920) {
  const img = await _loadImage(dataUrl);

  let { width, height } = img;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return blobToDataUrl(blob);
}

/**
 * Returns the dimensions of an image given its data URL.
 * @param {string} dataUrl - The image data URL.
 * @returns {Promise<{width: number, height: number}>} The image dimensions.
 */
export async function getImageDimensions(dataUrl) {
  const img = await _loadImage(dataUrl);
  return { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height };
}

/**
 * Creates a thumbnail of an image, fitting within the given max dimensions while preserving aspect ratio.
 * @param {string} dataUrl - The source image data URL.
 * @param {number} [maxWidth=200] - Maximum thumbnail width.
 * @param {number} [maxHeight=200] - Maximum thumbnail height.
 * @returns {Promise<string>} Resolves with the thumbnail image as a data URL.
 */
export async function createThumbnail(dataUrl, maxWidth = 200, maxHeight = 200) {
  const img = await _loadImage(dataUrl);

  let { width, height } = img;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

/**
 * Internal helper to load an image from a source string.
 * @param {string} src - Image source URL or data URL.
 * @returns {Promise<HTMLImageElement>} Resolves with the loaded Image.
 * @private
 */
function _loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 100)}`));
    img.src = src;
  });
}
