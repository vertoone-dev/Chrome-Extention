/**
 * @module annotator
 * Pure canvas drawing functions for annotating GuideSnap screenshots.
 * All functions work with both OffscreenCanvas and regular HTMLCanvasElement.
 */

/**
 * Annotates a screenshot with all annotations defined on a step.
 * Returns a new data URL with all overlays applied.
 * @param {string} screenshotDataUrl - Original screenshot data URL
 * @param {import('./guide-model.js').Step} step - Step with annotation data
 * @returns {Promise<string>} Annotated screenshot as a data URL
 */
export async function annotateStep(screenshotDataUrl, step) {
  const img = await loadImageFromDataUrl(screenshotDataUrl);
  const width = img.width;
  const height = img.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Draw the original screenshot
  ctx.drawImage(img, 0, 0);

  const { annotation, index } = step;

  // Apply spotlight
  if (annotation?.spotlight) {
    const { x, y, radius } = annotation.spotlight;
    drawSpotlight(ctx, x, y, radius, width, height);
  }

  // Draw click pulse at interaction point
  if (step.meta?.x && step.meta?.y) {
    drawClickPulse(ctx, step.meta.x, step.meta.y);
  }

  // Draw arrows
  if (annotation?.arrows?.length) {
    for (const arrow of annotation.arrows) {
      drawArrow(ctx, arrow.fromX, arrow.fromY, arrow.toX, arrow.toY, arrow.color);
    }
  }

  // Draw text callouts
  if (annotation?.textCallouts?.length) {
    for (const callout of annotation.textCallouts) {
      drawTextCallout(ctx, callout.text, callout.x, callout.y, callout.options);
    }
  }

  // Draw zoom region
  if (annotation?.zoomRegion) {
    await drawZoomRegion(ctx, annotation.zoomRegion, screenshotDataUrl);
  }

  // Draw step badge
  drawStepBadge(ctx, index + 1);

  return canvasToDataUrl(canvas);
}

/**
 * Draws a spotlight effect: darkens the entire canvas except a circular area.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Center X of spotlight
 * @param {number} y - Center Y of spotlight
 * @param {number} radius - Spotlight radius in pixels
 * @param {number} canvasWidth - Full canvas width
 * @param {number} canvasHeight - Full canvas height
 */
export function drawSpotlight(ctx, x, y, radius, canvasWidth, canvasHeight) {
  ctx.save();

  // Draw dark overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Cut out the spotlight circle
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Add a subtle glow ring
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius + 1, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draws a red pulse circle at the click point.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - Click X
 * @param {number} y - Click Y
 */
export function drawClickPulse(ctx, x, y) {
  ctx.save();

  // Outer pulse ring
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, 20, 0, Math.PI * 2);
  ctx.stroke();

  // Inner solid circle
  ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws an arrow from one point to another.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} fromX - Start X
 * @param {number} fromY - Start Y
 * @param {number} toX - End X
 * @param {number} toY - End Y
 * @param {string} [color='#ef4444'] - Arrow color
 */
export function drawArrow(ctx, fromX, fromY, toX, toY, color = '#ef4444') {
  const headLength = 14;
  const angle = Math.atan2(toY - fromY, toX - fromX);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';

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
 * Draws a text callout box at the specified position.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Callout text
 * @param {number} x - Top-left X
 * @param {number} y - Top-left Y
 * @param {Object} [options={}] - Style options
 * @param {string} [options.bgColor='rgba(0,0,0,0.8)'] - Background color
 * @param {string} [options.textColor='#ffffff'] - Text color
 * @param {number} [options.fontSize=14] - Font size in pixels
 * @param {number} [options.padding=10] - Inner padding
 * @param {number} [options.maxWidth=300] - Max width before wrapping
 */
export function drawTextCallout(ctx, text, x, y, options = {}) {
  const {
    bgColor = 'rgba(0, 0, 0, 0.8)',
    textColor = '#ffffff',
    fontSize = 14,
    padding = 10,
    maxWidth = 300,
  } = options;

  ctx.save();
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  // Wrap text into lines
  const lines = wrapText(ctx, text, maxWidth - padding * 2);
  const lineHeight = fontSize * 1.4;
  const boxWidth = Math.min(
    maxWidth,
    Math.max(...lines.map((l) => ctx.measureText(l).width)) + padding * 2
  );
  const boxHeight = lines.length * lineHeight + padding * 2;
  const cornerRadius = 6;

  // Background
  ctx.fillStyle = bgColor;
  roundRect(ctx, x, y, boxWidth, boxHeight, cornerRadius);
  ctx.fill();

  // Text
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, x + padding, y + padding + i * lineHeight);
  });

  ctx.restore();
}

/**
 * Draws a step number badge in the top-left corner.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} stepNumber - 1-based step number
 */
export function drawStepBadge(ctx, stepNumber) {
  const size = 32;
  const margin = 12;
  const x = margin + size / 2;
  const y = margin + size / 2;

  ctx.save();

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  // Circle
  ctx.fillStyle = '#6366f1';
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Reset shadow for text
  ctx.shadowColor = 'transparent';

  // Number
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(stepNumber), x, y);

  ctx.restore();
}

/**
 * Crops and magnifies a region of the screenshot, drawing it as an inset.
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} region - Zoom region definition
 * @param {number} region.x - Source X
 * @param {number} region.y - Source Y
 * @param {number} region.width - Source width
 * @param {number} region.height - Source height
 * @param {number} [region.scale=2] - Magnification factor
 * @param {string} screenshotDataUrl - Original screenshot for source pixels
 */
export async function drawZoomRegion(ctx, region, screenshotDataUrl) {
  const { x, y, width, height, scale = 2 } = region;
  const img = await loadImageFromDataUrl(screenshotDataUrl);

  const zoomWidth = width * scale;
  const zoomHeight = height * scale;

  // Position the zoomed inset in the bottom-right corner with margin
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const margin = 16;
  const destX = canvasWidth - zoomWidth - margin;
  const destY = canvasHeight - zoomHeight - margin;

  ctx.save();

  // Border
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 3;
  roundRect(ctx, destX - 2, destY - 2, zoomWidth + 4, zoomHeight + 4, 8);
  ctx.stroke();

  // Clipped zoom
  ctx.beginPath();
  roundRect(ctx, destX, destY, zoomWidth, zoomHeight, 6);
  ctx.clip();
  ctx.drawImage(img, x, y, width, height, destX, destY, zoomWidth, zoomHeight);

  ctx.restore();
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Loads an image from a data URL, returning an object usable with drawImage.
 * @param {string} dataUrl
 * @returns {Promise<ImageBitmap|HTMLImageElement>}
 */
async function loadImageFromDataUrl(dataUrl) {
  if (typeof createImageBitmap !== 'undefined') {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for annotation'));
    img.src = dataUrl;
  });
}

/**
 * Creates a canvas appropriate for the current environment.
 * @param {number} width
 * @param {number} height
 * @returns {OffscreenCanvas|HTMLCanvasElement}
 */
function createCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Converts a canvas to a PNG data URL string.
 * @param {OffscreenCanvas|HTMLCanvasElement} canvas
 * @returns {Promise<string>}
 */
async function canvasToDataUrl(canvas) {
  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(/** @type {string} */ (reader.result));
      reader.onerror = () => reject(new Error('Failed to read canvas blob'));
      reader.readAsDataURL(blob);
    });
  }
  return canvas.toDataURL('image/png');
}

/**
 * Draws a rounded rectangle path (does NOT fill or stroke).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r - Corner radius
 */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  // Fallback
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Wraps text into multiple lines to fit within maxWidth.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]} Array of text lines
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}
