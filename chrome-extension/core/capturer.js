/**
 * @module capturer
 * Screenshot capture logic for GuideSnap.
 * Wraps chrome.tabs.captureVisibleTab and produces Step objects.
 */

import { createStep } from './guide-model.js';

/* global chrome */

/**
 * Captures the visible area of the currently active tab as a PNG data URL.
 * @param {number} [windowId] - Optional window ID (defaults to current window)
 * @returns {Promise<string>} Base64-encoded PNG data URL
 * @throws {Error} If capture fails
 */
export async function captureVisibleTab(windowId) {
  try {
    const targetWindow =
      windowId !== undefined ? windowId : chrome.windows.WINDOW_ID_CURRENT;
    const dataUrl = await chrome.tabs.captureVisibleTab(targetWindow, {
      format: 'png',
      quality: 100,
    });
    return dataUrl;
  } catch (err) {
    throw new Error(
      `captureVisibleTab failed: ${err.message}. ` +
        'Ensure the extension has the "activeTab" or "tabs" permission and the tab is focusable.'
    );
  }
}

/**
 * Captures a screenshot and bundles it into a Step object.
 * @param {number} tabId - The tab being recorded
 * @param {Object} [eventData={}] - Interaction metadata from the content script
 * @param {number} [eventData.x] - Click x coordinate
 * @param {number} [eventData.y] - Click y coordinate
 * @param {string} [eventData.tag] - Target element tag name
 * @param {string} [eventData.text] - Target element text content
 * @param {string} [eventData.url] - Current page URL
 * @param {string} [eventData.pageTitle] - Current page title
 * @param {number} [eventData.stepIndex] - Override for step index
 * @param {Object} [options={}] - Capture options
 * @param {boolean} [options.fullPage=false] - If true, attempt full-page capture
 * @returns {Promise<import('./guide-model.js').Step>} A new step with the captured screenshot
 */
export async function captureStep(tabId, eventData = {}, options = {}) {
  let screenshotDataUrl;

  try {
    if (options.fullPage) {
      screenshotDataUrl = await captureFullPage(tabId);
    } else {
      screenshotDataUrl = await captureVisibleTab();
    }
  } catch (err) {
    throw new Error(
      `captureStep failed for tab ${tabId}: ${err.message}`
    );
  }

  const meta = {
    x: eventData.x ?? 0,
    y: eventData.y ?? 0,
    tag: eventData.tag ?? '',
    text: eventData.text ?? '',
    url: eventData.url ?? '',
    pageTitle: eventData.pageTitle ?? '',
    timestamp: new Date().toISOString(),
  };

  const stepIndex = eventData.stepIndex ?? 0;
  return createStep(stepIndex, screenshotDataUrl, meta);
}

/**
 * Attempts a full-page capture by scrolling and stitching viewport screenshots.
 * Falls back to a single viewport capture if scripting is unavailable.
 * @param {number} tabId - Tab to capture
 * @returns {Promise<string>} Base64-encoded PNG data URL
 */
async function captureFullPage(tabId) {
  try {
    // Gather page dimensions from the content script
    const [{ result: dimensions }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        originalScrollX: window.scrollX,
        originalScrollY: window.scrollY,
      }),
    });

    const { scrollHeight, viewportHeight, originalScrollX, originalScrollY } =
      dimensions;

    // If the page fits in one viewport, a single capture is enough
    if (scrollHeight <= viewportHeight) {
      return captureVisibleTab();
    }

    const screenshots = [];
    let currentY = 0;

    while (currentY < scrollHeight) {
      // Scroll to position
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (y) => window.scrollTo(0, y),
        args: [currentY],
      });

      // Small delay for rendering
      await delay(150);

      const dataUrl = await captureVisibleTab();
      screenshots.push({ dataUrl, y: currentY });
      currentY += viewportHeight;
    }

    // Restore original scroll position
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (x, y) => window.scrollTo(x, y),
      args: [originalScrollX, originalScrollY],
    });

    // If only one capture was taken, return it directly
    if (screenshots.length === 1) {
      return screenshots[0].dataUrl;
    }

    // Stitch screenshots together using OffscreenCanvas (or fallback)
    return stitchScreenshots(screenshots, dimensions);
  } catch (err) {
    // Fallback: just capture the visible viewport
    console.warn('Full-page capture failed, falling back to viewport:', err.message);
    return captureVisibleTab();
  }
}

/**
 * Stitches multiple viewport screenshots into a single tall image.
 * @param {Array<{dataUrl: string, y: number}>} screenshots
 * @param {{scrollWidth: number, scrollHeight: number, viewportWidth: number, viewportHeight: number}} dimensions
 * @returns {Promise<string>} Combined data URL
 */
async function stitchScreenshots(screenshots, dimensions) {
  const { scrollHeight, viewportWidth, viewportHeight } = dimensions;

  // Prefer OffscreenCanvas in service worker context
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(viewportWidth, scrollHeight)
      : createFallbackCanvas(viewportWidth, scrollHeight);

  const ctx = canvas.getContext('2d');

  for (const shot of screenshots) {
    const img = await loadImage(shot.dataUrl);
    const drawHeight = Math.min(viewportHeight, scrollHeight - shot.y);
    ctx.drawImage(img, 0, 0, viewportWidth, drawHeight, 0, shot.y, viewportWidth, drawHeight);
  }

  if (typeof canvas.convertToBlob === 'function') {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return blobToDataUrl(blob);
  }
  // Fallback for regular canvas
  return canvas.toDataURL('image/png');
}

/**
 * Creates a fallback HTMLCanvasElement (for non-service-worker contexts).
 * @param {number} width
 * @param {number} height
 * @returns {HTMLCanvasElement}
 */
function createFallbackCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Loads an image from a data URL.
 * Works with both ImageBitmap (OffscreenCanvas) and HTMLImageElement.
 * @param {string} dataUrl
 * @returns {Promise<ImageBitmap|HTMLImageElement>}
 */
async function loadImage(dataUrl) {
  if (typeof createImageBitmap !== 'undefined') {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Converts a Blob to a data URL string.
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(new Error('Failed to convert blob to data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Simple delay helper.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
