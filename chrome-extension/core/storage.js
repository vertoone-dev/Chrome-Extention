/**
 * @module storage
 * Chrome storage.local CRUD wrapper for GuideSnap guides.
 *
 * Storage layout (to stay within per-item size limits):
 *   guide_meta_{id}  → { id, title, createdAt, updatedAt, stepCount, thumbnail }
 *   guide_steps_{id} → Step[]
 *   guide_ids        → string[]  (index of all guide IDs)
 */

/* global chrome */

const KEY_INDEX = 'guide_ids';
const metaKey = (id) => `guide_meta_${id}`;
const stepsKey = (id) => `guide_steps_${id}`;

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Returns the array of all stored guide IDs.
 * @returns {Promise<string[]>}
 */
export async function getAllGuideIds() {
  const result = await chrome.storage.local.get(KEY_INDEX);
  return result[KEY_INDEX] || [];
}

/**
 * Persists the guide ID index.
 * @param {string[]} ids
 * @returns {Promise<void>}
 */
async function setGuideIds(ids) {
  await chrome.storage.local.set({ [KEY_INDEX]: ids });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Saves a complete guide (metadata + steps) to storage.
 * @param {import('./guide-model.js').Guide} guide - The guide to save
 * @returns {Promise<void>}
 */
export async function saveGuide(guide) {
  if (!guide || !guide.id) {
    throw new Error('saveGuide: guide must have an id');
  }

  const meta = {
    id: guide.id,
    title: guide.title,
    createdAt: guide.createdAt,
    updatedAt: guide.updatedAt,
    stepCount: guide.steps.length,
    thumbnail: guide.thumbnail,
  };

  await chrome.storage.local.set({
    [metaKey(guide.id)]: meta,
    [stepsKey(guide.id)]: guide.steps,
  });

  // Update the index
  const ids = await getAllGuideIds();
  if (!ids.includes(guide.id)) {
    ids.push(guide.id);
    await setGuideIds(ids);
  }
}

/**
 * Retrieves a full guide (metadata + steps) by ID.
 * @param {string} id - Guide ID
 * @returns {Promise<import('./guide-model.js').Guide|null>} The guide or null if not found
 */
export async function getGuide(id) {
  if (!id) {
    throw new Error('getGuide: id is required');
  }

  const result = await chrome.storage.local.get([metaKey(id), stepsKey(id)]);
  const meta = result[metaKey(id)];
  const steps = result[stepsKey(id)];

  if (!meta) return null;

  return {
    id: meta.id,
    title: meta.title,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    steps: steps || [],
    thumbnail: meta.thumbnail,
  };
}

/**
 * Returns an array of guide summaries (without full step data) for listing.
 * @returns {Promise<Array<{id: string, title: string, stepCount: number, createdAt: string, thumbnail: string|null}>>}
 */
export async function listGuides() {
  const ids = await getAllGuideIds();
  if (ids.length === 0) return [];

  const keys = ids.map(metaKey);
  const result = await chrome.storage.local.get(keys);

  return ids
    .map((id) => result[metaKey(id)])
    .filter(Boolean)
    .map((meta) => ({
      id: meta.id,
      title: meta.title,
      stepCount: meta.stepCount,
      createdAt: meta.createdAt,
      thumbnail: meta.thumbnail,
    }));
}

/**
 * Deletes a guide and its steps from storage.
 * @param {string} id - Guide ID to delete
 * @returns {Promise<void>}
 */
export async function deleteGuide(id) {
  if (!id) {
    throw new Error('deleteGuide: id is required');
  }

  await chrome.storage.local.remove([metaKey(id), stepsKey(id)]);

  const ids = await getAllGuideIds();
  const updated = ids.filter((gid) => gid !== id);
  await setGuideIds(updated);
}

/**
 * Merges partial updates into an existing guide.
 * @param {string} id - Guide ID to update
 * @param {Partial<import('./guide-model.js').Guide>} updates - Fields to merge
 * @returns {Promise<import('./guide-model.js').Guide|null>} The updated guide or null if not found
 */
export async function updateGuide(id, updates) {
  const guide = await getGuide(id);
  if (!guide) return null;

  if (updates.title !== undefined) guide.title = updates.title;
  if (updates.steps !== undefined) guide.steps = updates.steps;
  if (updates.thumbnail !== undefined) guide.thumbnail = updates.thumbnail;

  guide.updatedAt = new Date().toISOString();

  await saveGuide(guide);
  return guide;
}

/**
 * Returns a full guide as a JSON string for export.
 * @param {string} id - Guide ID
 * @returns {Promise<string|null>} JSON string or null if guide not found
 */
export async function exportGuideJSON(id) {
  const guide = await getGuide(id);
  if (!guide) return null;
  return JSON.stringify(guide, null, 2);
}

/**
 * Parses a JSON string and saves the guide to storage.
 * Assigns a new ID to avoid collisions with existing guides.
 * @param {string} jsonString - JSON representation of a guide
 * @returns {Promise<import('./guide-model.js').Guide>} The imported guide
 */
export async function importGuideJSON(jsonString) {
  let guide;
  try {
    guide = JSON.parse(jsonString);
  } catch (err) {
    throw new Error(`importGuideJSON: invalid JSON – ${err.message}`);
  }

  if (!guide || !guide.title || !Array.isArray(guide.steps)) {
    throw new Error('importGuideJSON: JSON does not match guide schema');
  }

  // Preserve original data but ensure required fields exist
  guide.updatedAt = new Date().toISOString();
  guide.thumbnail =
    guide.steps.length > 0 ? guide.steps[0].screenshotDataUrl : null;

  await saveGuide(guide);
  return guide;
}
