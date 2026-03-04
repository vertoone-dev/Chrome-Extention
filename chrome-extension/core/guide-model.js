/**
 * @module guide-model
 * Data schema definitions and factory functions for GuideSnap guides and steps.
 */

/**
 * @typedef {Object} Annotation
 * @property {Object|null} spotlight - Spotlight region {x, y, radius}
 * @property {Array<Object>} arrows - Arrow annotations [{fromX, fromY, toX, toY, color}]
 * @property {Array<Object>} textCallouts - Text callouts [{text, x, y, options}]
 * @property {Object|null} zoomRegion - Zoom region {x, y, width, height, scale}
 */

/**
 * @typedef {Object} StepMeta
 * @property {number} x - Click x coordinate
 * @property {number} y - Click y coordinate
 * @property {string} tag - HTML tag of the interacted element
 * @property {string} text - Text content of the element
 * @property {string} url - Page URL at time of capture
 * @property {string} pageTitle - Page title at time of capture
 * @property {string} timestamp - ISO timestamp of capture
 */

/**
 * @typedef {Object} Step
 * @property {string} id - Unique identifier (UUID)
 * @property {number} index - Zero-based step index
 * @property {string} screenshotDataUrl - Base64-encoded screenshot data URL
 * @property {Annotation} annotation - Annotation data for this step
 * @property {string} description - Human-readable step description
 * @property {StepMeta} meta - Metadata about the captured interaction
 */

/**
 * @typedef {Object} Guide
 * @property {string} id - Unique identifier (UUID)
 * @property {string} title - Guide title
 * @property {string} createdAt - ISO 8601 creation timestamp
 * @property {string} updatedAt - ISO 8601 last-updated timestamp
 * @property {Array<Step>} steps - Ordered array of steps
 * @property {string|null} thumbnail - Data URL of first step screenshot
 */

/**
 * Generates a UUID v4 string.
 * @returns {string} A new UUID
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a new empty guide with the given title.
 * @param {string} title - The guide title
 * @returns {Guide} A new guide object
 */
export function createGuide(title) {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: title || 'Untitled Guide',
    createdAt: now,
    updatedAt: now,
    steps: [],
    thumbnail: null,
  };
}

/**
 * Creates a new step object.
 * @param {number} index - Zero-based step index
 * @param {string} screenshotDataUrl - Base64-encoded screenshot data URL
 * @param {Partial<StepMeta>} [meta={}] - Optional metadata about the interaction
 * @returns {Step} A new step object
 */
export function createStep(index, screenshotDataUrl, meta = {}) {
  return {
    id: generateId(),
    index,
    screenshotDataUrl: screenshotDataUrl || '',
    annotation: {
      spotlight: null,
      arrows: [],
      textCallouts: [],
      zoomRegion: null,
    },
    description: '',
    meta: {
      x: meta.x ?? 0,
      y: meta.y ?? 0,
      tag: meta.tag ?? '',
      text: meta.text ?? '',
      url: meta.url ?? '',
      pageTitle: meta.pageTitle ?? '',
      timestamp: meta.timestamp ?? new Date().toISOString(),
    },
  };
}

/**
 * Updates the guide's updatedAt timestamp and thumbnail from the first step.
 * @param {Guide} guide - The guide to update
 * @returns {Guide} The same guide object, mutated with new timestamp and thumbnail
 */
export function updateGuideTimestamp(guide) {
  guide.updatedAt = new Date().toISOString();
  if (guide.steps.length > 0) {
    guide.thumbnail = guide.steps[0].screenshotDataUrl;
  }
  return guide;
}
