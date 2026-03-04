/**
 * Canvas drawing utility functions for GuideSnap.
 * @module canvas-utils
 */

/**
 * Draws a circle outline on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} x - Center X coordinate.
 * @param {number} y - Center Y coordinate.
 * @param {number} radius - Circle radius in pixels.
 * @param {string} [color='#FF0000'] - Stroke color.
 * @param {number} [lineWidth=2] - Stroke width in pixels.
 */
export function drawCircle(ctx, x, y, radius, color = '#FF0000', lineWidth = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws a filled circle on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} x - Center X coordinate.
 * @param {number} y - Center Y coordinate.
 * @param {number} radius - Circle radius in pixels.
 * @param {string} [color='#FF0000'] - Fill color.
 */
export function drawFilledCircle(ctx, x, y, radius, color = '#FF0000') {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

/**
 * Draws an arrow with an arrowhead from one point to another.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} fromX - Starting X coordinate.
 * @param {number} fromY - Starting Y coordinate.
 * @param {number} toX - Ending X coordinate.
 * @param {number} toY - Ending Y coordinate.
 * @param {string} [color='#FF0000'] - Stroke color.
 * @param {number} [lineWidth=2] - Stroke width in pixels.
 */
export function drawArrow(ctx, fromX, fromY, toX, toY, color = '#FF0000', lineWidth = 2) {
  const headLength = Math.max(10, lineWidth * 5);
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;

  // Shaft
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(toX, toY);
  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draws a rounded rectangle, optionally filled and/or stroked.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} x - Top-left X coordinate.
 * @param {number} y - Top-left Y coordinate.
 * @param {number} width - Rectangle width.
 * @param {number} height - Rectangle height.
 * @param {number} [radius=8] - Corner radius in pixels.
 * @param {string|null} [fillColor=null] - Fill color, or null to skip filling.
 * @param {string|null} [strokeColor=null] - Stroke color, or null to skip stroking.
 */
export function drawRoundedRect(ctx, x, y, width, height, radius = 8, fillColor = null, strokeColor = null) {
  const r = Math.min(radius, width / 2, height / 2);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Crops a region from an image data URL and returns a new data URL.
 * @param {string} imageDataUrl - Source image as a data URL.
 * @param {number} x - Crop region X offset.
 * @param {number} y - Crop region Y offset.
 * @param {number} width - Crop region width.
 * @param {number} height - Crop region height.
 * @returns {Promise<string>} A data URL of the cropped image.
 */
export async function cropImage(imageDataUrl, x, y, width, height) {
  const img = await loadImage(imageDataUrl);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to convert cropped image to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Crops and scales a region of an image to the specified output dimensions.
 * @param {string} imageDataUrl - Source image as a data URL.
 * @param {{x: number, y: number, width: number, height: number}} region - The region to extract.
 * @param {number} outputWidth - Desired output width.
 * @param {number} outputHeight - Desired output height.
 * @returns {Promise<string>} A data URL of the zoomed region.
 */
export async function zoomRegion(imageDataUrl, region, outputWidth, outputHeight) {
  const img = await loadImage(imageDataUrl);
  const canvas = new OffscreenCanvas(outputWidth, outputHeight);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, region.x, region.y, region.width, region.height, 0, 0, outputWidth, outputHeight);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to convert zoomed region to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Draws a numbered circle badge on the canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} number - The step number to display.
 * @param {number} x - Center X coordinate.
 * @param {number} y - Center Y coordinate.
 * @param {number} [size=24] - Diameter of the badge in pixels.
 */
export function addStepBadge(ctx, number, x, y, size = 24) {
  const radius = size / 2;

  ctx.save();

  // Background circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#E63946';
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Number text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.round(size * 0.55)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number), x, y);

  ctx.restore();
}

/**
 * Clears the entire canvas.
 * @param {CanvasRenderingContext2D} ctx - The canvas rendering context.
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Loads an image from a source URL and returns a Promise that resolves when loaded.
 * @param {string} src - The image source URL or data URL.
 * @returns {Promise<HTMLImageElement>} Resolves with the loaded Image element.
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src.slice(0, 100)}`));
    img.src = src;
  });
}

/**
 * Wrapper around canvas.toDataURL with configurable format and quality.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {string} [format='image/png'] - The MIME type (e.g. 'image/png', 'image/jpeg').
 * @param {number} [quality=0.92] - Quality for lossy formats (0–1).
 * @returns {string} The canvas contents as a data URL.
 */
export function canvasToDataUrl(canvas, format = 'image/png', quality = 0.92) {
  return canvas.toDataURL(format, quality);
}
