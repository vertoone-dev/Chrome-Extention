/**
 * @module recorder
 * Recording state machine for GuideSnap.
 *
 * States: IDLE → RECORDING ⇄ PAUSED → STOPPED → EDITING → IDLE
 */

import { createGuide, createStep, updateGuideTimestamp } from './guide-model.js';

/* global chrome */

/** @enum {string} */
export const RecorderState = Object.freeze({
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  EDITING: 'EDITING',
});

/** @type {RecorderState} */
let state = RecorderState.IDLE;

/** @type {import('./guide-model.js').Guide|null} */
let currentGuide = null;

/** @type {number|null} */
let activeTabId = null;

/** @type {Set<Function>} */
const listeners = new Set();

// ─── State helpers ───────────────────────────────────────────────────────────

/**
 * Notifies all registered listeners of a state change.
 * @param {RecorderState} newState
 */
function setState(newState) {
  state = newState;
  for (const fn of listeners) {
    try {
      fn(state);
    } catch {
      /* listener errors must not break the recorder */
    }
  }
}

/**
 * Returns the current recorder state.
 * @returns {RecorderState}
 */
export function getState() {
  return state;
}

/**
 * Register a callback to be invoked whenever the recorder state changes.
 * @param {Function} fn - Callback receiving the new state string
 * @returns {Function} Unsubscribe function
 */
export function onStateChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── Recording lifecycle ─────────────────────────────────────────────────────

/**
 * Starts a new recording session for the given tab.
 * @param {number} tabId - Chrome tab ID to record
 * @param {string} [title] - Optional guide title
 * @returns {import('./guide-model.js').Guide} The newly created guide
 * @throws {Error} If already recording
 */
export function startRecording(tabId, title) {
  if (state !== RecorderState.IDLE && state !== RecorderState.STOPPED) {
    throw new Error(`Cannot start recording in ${state} state`);
  }

  activeTabId = tabId;
  currentGuide = createGuide(title || 'Untitled Guide');
  setState(RecorderState.RECORDING);

  notifyContentScript('recording-started');

  return currentGuide;
}

/**
 * Pauses the current recording.
 * @throws {Error} If not currently recording
 */
export function pauseRecording() {
  if (state !== RecorderState.RECORDING) {
    throw new Error(`Cannot pause in ${state} state`);
  }
  setState(RecorderState.PAUSED);
  notifyContentScript('recording-paused');
}

/**
 * Resumes a paused recording.
 * @throws {Error} If not currently paused
 */
export function resumeRecording() {
  if (state !== RecorderState.PAUSED) {
    throw new Error(`Cannot resume in ${state} state`);
  }
  setState(RecorderState.RECORDING);
  notifyContentScript('recording-resumed');
}

/**
 * Stops the current recording.
 * @returns {import('./guide-model.js').Guide|null} The completed guide, or null
 * @throws {Error} If not recording or paused
 */
export function stopRecording() {
  if (state !== RecorderState.RECORDING && state !== RecorderState.PAUSED) {
    throw new Error(`Cannot stop in ${state} state`);
  }

  setState(RecorderState.STOPPED);
  notifyContentScript('recording-stopped');

  if (currentGuide) {
    updateGuideTimestamp(currentGuide);
  }
  return currentGuide;
}

/**
 * Resets the recorder back to IDLE, clearing the in-progress guide.
 */
export function resetRecording() {
  currentGuide = null;
  activeTabId = null;
  setState(RecorderState.IDLE);
}

/**
 * Transitions the recorder into EDITING state.
 * @throws {Error} If not in STOPPED state
 */
export function startEditing() {
  if (state !== RecorderState.STOPPED) {
    throw new Error(`Cannot edit in ${state} state`);
  }
  setState(RecorderState.EDITING);
}

// ─── Step management ─────────────────────────────────────────────────────────

/**
 * Adds a step to the current in-progress guide.
 * @param {Object} stepData - Data for the new step
 * @param {string} stepData.screenshotDataUrl - Screenshot data URL
 * @param {Object} [stepData.meta] - Step metadata
 * @returns {import('./guide-model.js').Step} The created step
 * @throws {Error} If not recording
 */
export function addStep(stepData) {
  if (state !== RecorderState.RECORDING) {
    throw new Error(`Cannot add step in ${state} state`);
  }
  if (!currentGuide) {
    throw new Error('No active guide');
  }

  const index = currentGuide.steps.length;
  const step = createStep(index, stepData.screenshotDataUrl, stepData.meta);

  if (stepData.description) {
    step.description = stepData.description;
  }

  currentGuide.steps.push(step);
  updateGuideTimestamp(currentGuide);

  return step;
}

/**
 * Returns the in-progress guide (may be null if not recording).
 * @returns {import('./guide-model.js').Guide|null}
 */
export function getCurrentGuide() {
  return currentGuide;
}

/**
 * Returns the active tab ID being recorded.
 * @returns {number|null}
 */
export function getActiveTabId() {
  return activeTabId;
}

// ─── Message passing ─────────────────────────────────────────────────────────

/**
 * Sends a message to the content script in the active tab.
 * @param {string} action - The action identifier
 * @param {Object} [payload={}] - Additional data
 */
function notifyContentScript(action, payload = {}) {
  if (activeTabId == null) return;

  try {
    chrome.tabs.sendMessage(activeTabId, {
      type: 'GUIDESNAP_RECORDER',
      action,
      ...payload,
    });
  } catch {
    // Tab may have been closed or navigated away — fail silently
  }
}
