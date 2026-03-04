/**
 * Keyboard shortcut utility functions for GuideSnap.
 * @module shortcut-utils
 */

/** @type {Map<string, {handler: function, callback: function}>} */
const registeredShortcuts = new Map();

/**
 * Registers a keyboard shortcut listener on the document.
 *
 * The `keys` object describes the shortcut:
 * - `key` {string} — the key value (e.g. "r", "s", "F1")
 * - `ctrlKey` {boolean} (optional) — whether Ctrl must be held
 * - `shiftKey` {boolean} (optional) — whether Shift must be held
 * - `altKey` {boolean} (optional) — whether Alt must be held
 * - `metaKey` {boolean} (optional) — whether Meta/Cmd must be held
 *
 * @param {{key: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, metaKey?: boolean}} keys
 *   Shortcut definition.
 * @param {function(KeyboardEvent): void} callback - Function to call when the shortcut is triggered.
 */
export function registerShortcut(keys, callback) {
  const id = _shortcutId(keys);

  // Prevent duplicate registrations
  if (registeredShortcuts.has(id)) {
    unregisterShortcut(keys);
  }

  /** @param {KeyboardEvent} event */
  const handler = (event) => {
    if (isShortcutMatch(event, keys)) {
      event.preventDefault();
      callback(event);
    }
  };

  document.addEventListener('keydown', handler);
  registeredShortcuts.set(id, { handler, callback });
}

/**
 * Removes a previously registered keyboard shortcut listener.
 * @param {{key: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, metaKey?: boolean}} keys
 *   Shortcut definition to remove.
 */
export function unregisterShortcut(keys) {
  const id = _shortcutId(keys);
  const entry = registeredShortcuts.get(id);

  if (entry) {
    document.removeEventListener('keydown', entry.handler);
    registeredShortcuts.delete(id);
  }
}

/**
 * Checks whether a keyboard event matches a shortcut definition.
 * @param {KeyboardEvent} event - The keyboard event to test.
 * @param {{key: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, metaKey?: boolean}} keys
 *   Shortcut definition.
 * @returns {boolean} True if the event matches the shortcut.
 */
export function isShortcutMatch(event, keys) {
  if (event.key.toLowerCase() !== keys.key.toLowerCase()) {
    return false;
  }
  if (Boolean(keys.ctrlKey) !== event.ctrlKey) return false;
  if (Boolean(keys.shiftKey) !== event.shiftKey) return false;
  if (Boolean(keys.altKey) !== event.altKey) return false;
  if (Boolean(keys.metaKey) !== event.metaKey) return false;

  return true;
}

/**
 * Returns a human-readable string representation of a shortcut definition.
 * Example output: "Alt+Shift+R", "Ctrl+S".
 * @param {{key: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, metaKey?: boolean}} keys
 *   Shortcut definition.
 * @returns {string} Formatted shortcut string.
 */
export function formatShortcut(keys) {
  const parts = [];

  if (keys.ctrlKey) parts.push('Ctrl');
  if (keys.altKey) parts.push('Alt');
  if (keys.shiftKey) parts.push('Shift');
  if (keys.metaKey) parts.push('Meta');

  // Capitalize single-character keys for display
  const displayKey = keys.key.length === 1 ? keys.key.toUpperCase() : keys.key;
  parts.push(displayKey);

  return parts.join('+');
}

/**
 * Generates a unique string identifier for a shortcut definition.
 * @param {{key: string, ctrlKey?: boolean, shiftKey?: boolean, altKey?: boolean, metaKey?: boolean}} keys
 * @returns {string}
 * @private
 */
function _shortcutId(keys) {
  const mods = [
    keys.ctrlKey ? 'ctrl' : '',
    keys.altKey ? 'alt' : '',
    keys.shiftKey ? 'shift' : '',
    keys.metaKey ? 'meta' : '',
  ]
    .filter(Boolean)
    .join('+');

  return mods ? `${mods}+${keys.key.toLowerCase()}` : keys.key.toLowerCase();
}
