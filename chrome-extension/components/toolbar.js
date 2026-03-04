/**
 * @module toolbar
 * Editor annotation toolbar component.
 */

/** @type {Array<{id: string, icon: string, label: string, toggle?: boolean, separator?: boolean}>} */
const TOOL_DEFINITIONS = [
  { id: 'spotlight', icon: '💡', label: 'Spotlight', toggle: true },
  { id: 'arrow', icon: '➡️', label: 'Draw Arrow' },
  { id: 'textCallout', icon: 'T', label: 'Add Text Callout' },
  { id: 'zoom', icon: '🔍', label: 'Zoom Region' },
  { id: '_sep1', separator: true },
  { id: 'undo', icon: '↩️', label: 'Undo' },
  { id: 'reset', icon: '🗑️', label: 'Reset' },
];

/** Maps tool IDs to their callback property names. */
const CALLBACK_MAP = {
  spotlight: 'onSpotlight',
  arrow: 'onArrow',
  textCallout: 'onTextCallout',
  zoom: 'onZoom',
  undo: 'onUndo',
  reset: 'onReset',
};

/**
 * Creates the annotation toolbar for the editor.
 * @param {Object} callbacks - { onSpotlight, onArrow, onTextCallout, onZoom, onUndo, onReset }
 * @returns {HTMLElement}
 */
export function createToolbar(callbacks = {}) {
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Annotation tools');

  for (const tool of TOOL_DEFINITIONS) {
    if (tool.separator) {
      const sep = document.createElement('div');
      sep.className = 'toolbar__separator';
      toolbar.appendChild(sep);
      continue;
    }

    const btn = document.createElement('button');
    btn.className = 'toolbar__btn';
    btn.dataset.tool = tool.id;
    btn.title = tool.label;
    btn.setAttribute('aria-label', tool.label);
    if (tool.toggle) btn.dataset.toggle = 'true';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toolbar__btn-icon';
    iconSpan.textContent = tool.icon;
    btn.appendChild(iconSpan);

    btn.addEventListener('click', () => {
      if (tool.toggle) {
        const isActive = btn.classList.toggle('toolbar__btn--active');
        const cbName = CALLBACK_MAP[tool.id];
        if (cbName && callbacks[cbName]) callbacks[cbName](isActive);
      } else {
        const cbName = CALLBACK_MAP[tool.id];
        if (cbName && callbacks[cbName]) callbacks[cbName]();
      }
    });

    toolbar.appendChild(btn);
  }

  return toolbar;
}

/**
 * Activates or deactivates a tool button on the toolbar.
 * @param {HTMLElement} toolbar - The toolbar element
 * @param {string} tool - Tool ID (e.g. 'spotlight', 'arrow')
 * @param {boolean} active - Whether the tool should be active
 */
export function setToolState(toolbar, tool, active) {
  const btn = toolbar.querySelector(`[data-tool="${tool}"]`);
  if (!btn) return;
  btn.classList.toggle('toolbar__btn--active', active);
}
